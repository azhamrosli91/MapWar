import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { badgeElement, setBadgeTroopCount, setFeatureEffect, unitElement } from "./badge.js";
import { coordinates } from "./data.js";
import { createEffectOverlay } from "./effects.js";
import { createCommandOverlay } from "./command-overlay.js";
import { sampleBattle, remainingPath, normalizeCombat, nearestEnemy } from "./combat.js";
import { createPaintOverlay } from "./paint-overlay.js";
import { boxIntersectsViewport, declutterLabels, declutterMarkers, mapViewport, measureMarker, projectedMarkerBox } from "./viewport.js";
import { HAS_MAP_KEY, MAPS_KEY } from "./maps-config.js";
import { BADGE_SIZES, MAX_LINE_POINTS, compileRoute, scenarioNightShade, routeError, sampleRoute, scenarioTime, stopLabel } from "./timeline.js";

let libraries;
function loadMaps() {
  if (!libraries) {
    setOptions({ key: MAPS_KEY, v: "weekly" });
    libraries = Promise.all([importLibrary("maps"), importLibrary("marker"), importLibrary("geometry")]);
  }
  return libraries;
}

function curvedLinePath(points) {
  if (points.length < 3) return points;
  const projected = points.map(({ lat, lng }) => ({ x: lng, y: Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, lat)) * Math.PI / 360)) * 180 / Math.PI }));
  for (let i = 1; i < projected.length; i++) projected[i].x += Math.round((projected[i - 1].x - projected[i].x) / 360) * 360;
  const result = [];
  for (let i = 0; i < projected.length - 1; i++) {
    const a = projected[Math.max(0, i - 1)], b = projected[i], c = projected[i + 1], d = projected[Math.min(projected.length - 1, i + 2)];
    for (let step = 0; step < 24; step++) {
      const t = step / 24;
      const value = (key) => 0.5 * (2 * b[key] + (-a[key] + c[key]) * t + (2 * a[key] - 5 * b[key] + 4 * c[key] - d[key]) * t * t + (-a[key] + 3 * b[key] - 3 * c[key] + d[key]) * t * t * t);
      result.push({ lng: value("x"), lat: (2 * Math.atan(Math.exp(value("y") * Math.PI / 180)) - Math.PI / 2) * 180 / Math.PI });
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

const pointModes = ["placeBadge", "placeUnit", "drawLine", "addStop", "repointStop", "placeEffectTarget", "editMovement"];
function cameraView(map) {
  const center = map?.getCenter();
  if (!center) return null;
  const position = center.toJSON();
  // Vector maps can report an unwrapped longitude while dragging across worlds.
  position.lng = ((position.lng + 180) % 360 + 360) % 360 - 180;
  return { center: position, zoom: map.getZoom(), mapTypeId: map.getMapTypeId(), heading: ((map.getHeading() ?? 0) % 360 + 360) % 360 };
}
function zoomAdjustedScale(scale, zoom, referenceZoom) {
  const zoomDelta = zoom - referenceZoom;
  const zoomOut = Math.max(0.8, 1 - Math.max(0, -zoomDelta) * 0.05);
  const zoomIn = Math.min(1.35, 1 + Math.max(0, zoomDelta) * 0.1);
  const sizes = Object.values(BADGE_SIZES);
  const factors = [zoomIn, zoomOut, zoomOut, 1];
  if (scale <= sizes[0]) return scale * factors[0];
  for (let index = 1; index < sizes.length; index++) {
    if (scale <= sizes[index]) {
      const fraction = (scale - sizes[index - 1]) / (sizes[index] - sizes[index - 1]);
      return scale * (factors[index - 1] + (factors[index] - factors[index - 1]) * fraction);
    }
  }
  return scale;
}

const MapCanvas = forwardRef(function MapCanvas(props, ref) {
  if (props.readOnly) {
    props = { ...props, mode: "view", draft: null, unitDraft: null, lineDraft: null,
      selectedId: null, selectedIds: undefined, brush: undefined, authoringTime: undefined,
      battleForces: undefined, onFeatureContextMenu: undefined, onEffectTargetSelect: undefined };
  }
  const { initialView, badges, units = [], draft, unitDraft, targetLocationStopId, selectedId, mode, preview, playing = false, previewTime: initialPreviewTime, authoringTime, lines, lineDraft, paintStrokes = [], brush, showAllMarkers = false } = props;
  const host = useRef(null);
  const live = useRef(props);
  const markers = useRef(new Map());
  const lineEntries = useRef(new Map());
  const routeGuides = useRef(new Map());
  const effectOverlay = useRef(null);
  const paintOverlay = useRef(null);
  const markerMeasurements = useRef(null);
  const previewTime = useRef(null);
  const [startView] = useState(initialView);
  const [api, setApi] = useState(null);
  const [mapTypeId, setMapTypeId] = useState(startView.mapTypeId);
  const lineColor = ["satellite", "hybrid"].includes(mapTypeId) ? "#FFFFFF" : "#D62828";
  const editingMovement = !preview && !!(draft ?? unitDraft)?.route.length;

  useEffect(() => { live.current = props; });

  useEffect(() => {
    if (!HAS_MAP_KEY) return;
    let disposed = false;
    let map;
    let timeout;
    let authFailed = false;
    const listeners = [];
    const previousAuthFailure = window.gm_authFailure;
    window.gm_authFailure = () => {
      authFailed = true;
      clearTimeout(timeout);
      if (!disposed) live.current.onStatus("error");
      previousAuthFailure?.();
    };
    live.current.onStatus("loading");
    timeout = setTimeout(() => { if (!disposed) live.current.onStatus("error"); }, 25000);
    loadMaps().then(([{ Map: GoogleMap, Polyline, OverlayView, RenderingType }, { AdvancedMarkerElement, CollisionBehavior }, { spherical }]) => {
      if (disposed) return;
      map = new GoogleMap(host.current, {
        ...startView,
        mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() || "DEMO_MAP_ID",
        renderingType: RenderingType.VECTOR,
        heading: startView.heading ?? 0, tilt: 0,
        headingInteractionEnabled: !live.current.renderMode, tiltInteractionEnabled: false,
        clickableIcons: false, streetViewControl: false, fullscreenControl: false,
        disableDefaultUI: live.current.cleanExport || live.current.renderMode,
        mapTypeControl: false, cameraControl: !live.current.cleanExport && !live.current.renderMode && !live.current.hideNavigationControls, zoomControl: !live.current.cleanExport && !live.current.renderMode && !live.current.hideNavigationControls, zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_CENTER }, gestureHandling: live.current.renderMode ? "none" : "greedy", keyboardShortcuts: !live.current.cleanExport && !live.current.renderMode,
      });
      setApi({ map, Polyline, OverlayView, AdvancedMarkerElement, CollisionBehavior, spherical });
      if (!live.current.cleanExport && !live.current.renderMode) {
        const zoomLevel = document.createElement("div");
        zoomLevel.className = "map-zoom-level";
        zoomLevel.index = 1;
        const updateZoomLevel = () => {
          const zoom = map.getZoom() ?? startView.zoom;
          zoomLevel.textContent = `Zoom ${Number(zoom.toFixed(1))}`;
          zoomLevel.setAttribute("aria-label", `Current zoom level: ${Number(zoom.toFixed(1))}`);
        };
        updateZoomLevel();
        map.controls[window.google.maps.ControlPosition.RIGHT_CENTER].push(zoomLevel);
        listeners.push(map.addListener("zoom_changed", updateZoomLevel));
      }
      setMapTypeId(map.getMapTypeId());
      listeners.push(map.addListener("maptypeid_changed", () => setMapTypeId(map.getMapTypeId())));
      listeners.push(map.addListener("click", (event) => {
        if (!live.current.readOnly && !live.current.preview && pointModes.includes(live.current.mode) && event.latLng) live.current.onPoint(event.latLng.toJSON());
      }));
      listeners.push(map.addListener("idle", () => {
        const view = cameraView(map);
        if (view) live.current.onView(view);
      }));
      listeners.push(map.addListener("tilesloaded", () => {
        clearTimeout(timeout);
        if (!disposed && !authFailed) live.current.onStatus("ready");
      }));
    }).catch(() => {
      clearTimeout(timeout);
      if (!disposed) live.current.onStatus("error");
    });
    const activeMarkers = markers.current;
    const activeLines = lineEntries.current;
    return () => {
      disposed = true;
      clearTimeout(timeout);
      window.gm_authFailure = previousAuthFailure;
      listeners.forEach((listener) => listener.remove());
      activeMarkers.forEach((entry) => { entry.listeners.forEach((remove) => remove()); entry.marker.map = null; });
      activeMarkers.clear();
      activeLines.forEach((entry) => { entry.listeners.forEach((listener) => listener.remove()); entry.line.setMap(null); entry.rendered.setMap(null); entry.label.map = null; });
      activeLines.clear();
      if (map) window.google.maps.event.clearInstanceListeners(map);
    };
  }, [startView]);

  const drawPreview = useCallback((time) => {
    time = live.current.authoringTime ?? time;
    if (live.current.battleForces) time = live.current.battleTime;
    if (live.current.battleReplay && time == null) time = live.current.battleReplay.startAt;
    paintOverlay.current?.setTime(live.current.preview || live.current.renderMode || live.current.battleReplay ? time : null, live.current.groups);
    previewTime.current = time;
    if (!api) return;
    const battleForces = live.current.battleForces ?? (live.current.battleReplay ? sampleBattle(live.current.battleReplay, time) : null);
    const forceMap = battleForces ? new Map(battleForces.map((force) => [force.id, force])) : null;
    const projection = effectOverlay.current?.getProjection();
    const viewport = mapViewport(projection, api.map);
    const zoom = api.map.getZoom() ?? startView.zoom;
    for (const entry of markers.current.values()) {
      const force = forceMap?.get(entry.id);
      const visible = force ? force.visible : time == null || ((entry.showTime == null || time >= entry.showTime) && (entry.hideTime == null || time < entry.hideTime));
      entry.visible = visible;
      entry.collisionHidden = false;
      entry.battleOffset = 0;
      const shot = force?.shot;
      const sample = force ? { position: { lat: force.lat, lng: force.lng }, troopCount: force.count, quantity: force.count, scale: entry.scale, effect: shot ? "firing" : "none", effectStart: shot?.at, firingTargetId: shot?.targetId, moving: !!force.move } : time == null ? null : sampleRoute(entry.route, time, api.spherical.interpolate);
      const position = sample?.position ?? entry.position;
      entry.currentPosition = typeof position.lat === "function" ? position : { lat: position.lat, lng: position.lng };
      entry.isMoving = !force && !!sample?.moving;
      const scale = sample?.scale ?? entry.scale;
      const referenceZoom = live.current.referenceZoom ?? startView.zoom;
      entry.displayScale = entry.featureType === "badge" && zoom > 14
        ? zoomAdjustedScale(scale, 14, referenceZoom) * (1 + (zoom - 14) * 0.1)
        : zoomAdjustedScale(scale, zoom, referenceZoom);
      const range = live.current.animationRange;
      const duration = live.current.animationDuration;
      const effectElapsed = live.current.battleForces && sample?.effectStart != null ? (time - sample.effectStart) / (60 * (live.current.battleSpeed ?? 1)) : sample?.effectStart != null && range && range.end > range.start && duration
        ? (time - sample.effectStart) / (range.end - range.start) * duration * 1000
        : 0;
      entry.sample = sample;
      entry.effectElapsed = effectElapsed;
      const selected = (live.current.selectedIds ?? []).includes(entry.id) || entry.id === live.current.selectedId;
      entry.element.classList.toggle("badge-selected", selected);
      entry.collisionPinned = selected || entry.isDraft || live.current.showAllMarkers;
      entry.element.classList.toggle("force-defeated", !!force && force.count === 0 && force.initialCount !== 0);
      entry.element.classList.toggle("force-invalid", !!force?.invalidTerrain);
      entry.collisionProtected = !!force || entry.baseCollisionProtected;
      if (visible) measureMarker(entry, markerMeasurements.current);
      const box = viewport ? projectedMarkerBox(entry, projection, viewport) : null;
      entry.inViewport = !box || boxIntersectsViewport(box, viewport, entry.dimensions.padding * entry.displayScale);
    }
    // Resolve enemies only after every route has been sampled at the same scenario time.
    if (time != null && !forceMap) {
      const forces = [...markers.current.values()].filter((entry) => entry.visible && !entry.isDraft).map((entry) => {
        const position = entry.currentPosition;
        const count = entry.sample?.troopCount ?? entry.troopCount;
        // A badge without troop numbers still represents a force in visual playback.
        // Preserve zero after any positive route count so defeated forces stay inactive.
        const unnumbered = entry.featureType === "badge" && entry.troopCount === 0
          && !entry.route.some((stop) => stop.troopCount > 0);
        return { id: entry.id, groupId: entry.groupId, combat: entry.combat, visibility: entry.visibility,
          count: unnumbered ? 1 : count,
          lat: typeof position.lat === "function" ? position.lat() : Number(position.lat),
          lng: typeof position.lng === "function" ? position.lng() : Number(position.lng), entry };
      });
      const range = live.current.animationRange;
      const origin = range?.start ?? time;
      const timeScale = range && range.end > range.start && live.current.animationDuration
        ? live.current.animationDuration * 1000 / (range.end - range.start) : 1;
      for (const source of forces) {
        const entry = source.entry;
        // Explicit route effects retain their selected targets and timing.
        if (entry.sample?.effect && entry.sample.effect !== "none") continue;
        const target = nearestEnemy(source, forces, time);
        if (!target) continue;
        entry.collisionProtected = true;
        target.entry.collisionProtected = true;
        const interval = source.combat.interval * 1000;
        entry.sample = { ...entry.sample, effect: source.combat.type, firingTargetId: target.id,
          effectStart: origin, autoCombat: true,
          combatPhase: Math.max(0, time - origin) % interval / interval,
          firingIntervalMs: interval * timeScale };
        entry.effectElapsed = Math.max(0, time - origin) * timeScale;
      }
    }
    if (zoom <= 10.7 && viewport) {
      for (const entry of markers.current.values()) {
        const effect = entry.sample?.effect;
        if (!entry.visible || !effect || effect === "none" || effect === "surrender") continue;
        const target = markers.current.get(entry.sample.firingTargetId);
        const travel = effect === "firing" ? 635 : ({ booming: 1350, demolish: 1500, kills: 1250, crack: 800, sword: 900, archer: 1100 }[effect] ?? 0) * 0.56;
        const duration = travel + (["firing", "booming", "demolish"].includes(effect) ? 3000 : 0);
        if (!entry.sample.autoCombat && !(entry.isMoving && ["firing", "booming"].includes(effect)) && entry.effectElapsed >= duration) continue;
        entry.collisionProtected = true;
        if (target?.visible && target !== entry) target.collisionProtected = true;
      }
    }
    declutterMarkers([...markers.current.values()], projection, viewport, zoom);
    for (const entry of markers.current.values()) {
      entry.element.style.translate = `${entry.battleOffset}px 0`;
      const rendered = entry.visible && entry.inViewport && !entry.collisionHidden;
      if (rendered) {
        entry.marker.position = entry.currentPosition;
        if (entry.appliedScale !== entry.displayScale) {
          entry.element.style.setProperty("--badge-scale", entry.displayScale);
          entry.appliedScale = entry.displayScale;
        }
        setBadgeTroopCount(entry.element, entry.sample?.troopCount ?? entry.troopCount);
        setFeatureEffect(entry.element, entry.sample?.autoCombat ? "none" : entry.sample?.effect ?? "none", entry.effectElapsed, entry.isMoving);
      }
      // Apply the current frame before reattaching a marker that enters view.
      if (entry.rendered !== rendered) {
        entry.marker.map = rendered ? api.map : null;
        entry.rendered = rendered;
      }
    }
    const ranked = [...markers.current.values()].filter((entry) => entry.rendered).sort((a, b) =>
      (a.displayScale ?? a.scale) - (b.displayScale ?? b.scale) || a.stars - b.stars || b.id.localeCompare(a.id));
    ranked.forEach((entry, index) => {
      const zIndex = entry.alwaysShow ? 100000 + index : index + 1;
      if (entry.marker.zIndex !== zIndex) entry.marker.zIndex = zIndex;
    });
    effectOverlay.current?.update(markers.current, scenarioNightShade(time));
    declutterLabels([...lineEntries.current.values()], projection, viewport, api.map, markerMeasurements.current);
    for (const entry of routeGuides.current.values()) {
      const visible = time == null || ((entry.showTime == null || time >= entry.showTime) && (entry.hideTime == null || time < entry.hideTime));
      if (entry.visible !== visible) { entry.line.setVisible(visible); entry.visible = visible; }
    }
  }, [api, startView.zoom]);

  useEffect(() => {
    if (!api) return;
    const container = document.createElement("div");
    container.style.cssText = "position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;contain:layout style;";
    container.setAttribute("aria-hidden", "true");
    api.map.getDiv().append(container);
    markerMeasurements.current = container;
    return () => { markerMeasurements.current = null; container.remove(); };
  }, [api]);

  useEffect(() => {
    if (!api) return;
    const overlay = createPaintOverlay(api, (stroke) => { if (!live.current.readOnly) live.current.onPaintStroke?.(stroke); });
    paintOverlay.current = overlay;
    overlay.setTime(live.current.preview ? previewTime.current ?? live.current.previewTime : null, live.current.groups);
    return () => { paintOverlay.current = null; overlay.dispose(); };
  }, [api]);

  useEffect(() => { paintOverlay.current?.setStrokes(paintStrokes); }, [api, paintStrokes]);
  useEffect(() => { paintOverlay.current?.setBrush(brush, !preview && mode === "paint"); }, [api, brush, preview, mode]);

  useEffect(() => {
    if (!api) return;
    const overlay = createEffectOverlay(api, () => drawPreview(previewTime.current));
    effectOverlay.current = overlay;
    overlay.update(markers.current);
    return () => {
      effectOverlay.current = null;
      overlay.setMap(null);
    };
  }, [api, drawPreview]);

  useEffect(() => {
    if (!api) return;
    let frame = null;
    let disposed = false;
    const refresh = () => {
      if (frame == null && !disposed) frame = requestAnimationFrame(() => {
        frame = null;
        drawPreview(previewTime.current);
      });
    };
    const listeners = ["bounds_changed", "zoom_changed", "heading_changed", "projection_changed", "idle"]
      .map((event) => api.map.addListener(event, refresh));
    const observer = new ResizeObserver(refresh);
    observer.observe(api.map.getDiv());
    document.fonts.ready.then(() => {
      if (disposed) return;
      for (const entry of markers.current.values()) entry.dimensions = null;
      for (const entry of lineEntries.current.values()) entry.labelDimensions = null;
      refresh();
    });
    refresh();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      listeners.forEach((listener) => listener.remove());
      observer.disconnect();
    };
  }, [api, drawPreview]);

  useEffect(() => {
    if (!api) return;
    const overlay = effectOverlay.current;
    const feature = draft ?? unitDraft;
    const stop = feature?.route.find((item) => item.id === targetLocationStopId);
    const picking = !preview && mode === "placeEffectTarget" && stop?.effect === "booming" && !!stop.targetLocation;
    const position = picking ? coordinates(stop.targetLocation.lat, stop.targetLocation.lng) : null;
    overlay?.setTargetPreview(position);
    if (!picking) return;
    const move = api.map.addListener("mousemove", (event) => {
      if (event.latLng) overlay?.setTargetPreview(event.latLng.toJSON());
    });
    const restore = () => overlay?.setTargetPreview(position);
    const leave = api.map.addListener("mouseout", restore);
    const container = host.current;
    container?.addEventListener("mouseleave", restore);
    return () => {
      move.remove();
      leave.remove();
      container?.removeEventListener("mouseleave", restore);
      overlay?.setTargetPreview(null);
    };
  }, [api, draft, unitDraft, targetLocationStopId, mode, preview]);

  // Reconcile marker content only when authored badge data changes, never per frame.
  useEffect(() => {
    if (!api) return;
    const items = badges.filter((badge) => badge.id !== draft?.id).map((badge) => ({ ...badge, featureType: "badge" }));
    const draftPosition = draft && coordinates(draft.lat, draft.lng);
    if (draftPosition) items.push({ ...draft, ...draftPosition, featureType: "badge", isDraft: true });
    items.push(...units.filter((unit) => unit.id !== unitDraft?.id).map((unit) => ({ ...unit, featureType: "unit" })));
    const unitPosition = unitDraft && coordinates(unitDraft.lat, unitDraft.lng);
    if (unitPosition) items.push({ ...unitDraft, ...unitPosition, featureType: "unit", isDraft: true });
    const ids = new Set(items.map((badge) => badge.id));
    for (const [id, entry] of markers.current) {
      if (!ids.has(id)) {
        entry.listeners.forEach((remove) => remove());
        entry.marker.map = null;
        markers.current.delete(id);
      }
    }
    for (const badge of items) {
      let entry = markers.current.get(badge.id);
      if (!entry) {
        const marker = new api.AdvancedMarkerElement({ map: api.map });
        entry = { marker, listeners: [], visible: true, rendered: true };
        const select = (event) => {
          if (live.current.readOnly) return;
          if (live.current.mode === "editMovement" && !live.current.preview && !live.current.cleanExport && !live.current.renderMode) {
            event.stopPropagation();
            if (!entry.isDraft) {
              const bounds = marker.getBoundingClientRect();
              live.current.onEffectTargetSelect?.({ id: entry.id, x: bounds.left + bounds.width / 2, y: bounds.bottom, restoreFocus: () => marker.focus() });
            }
            return;
          }
          if (!entry.isDraft && !live.current.cleanExport && !live.current.renderMode && live.current.mode === "navigate") {
            if (entry.featureType === "unit") live.current.onUnitSelect(entry.id);
            else live.current.onSelect(entry.id);
          }
        };
        const consumeMovementClick = (event) => {
          if (live.current.mode === "editMovement") event.stopPropagation();
        };
        const move = () => {
          if (live.current.readOnly) return;
          if (!entry.hasRoute && !live.current.preview && live.current.mode === "navigate") {
            const p = marker.position;
            const position = typeof p.lat === "function" ? p.toJSON() : { lat: p.lat, lng: p.lng };
            if (entry.featureType === "unit") live.current.onUnitMove(entry.id, position);
            else live.current.onMove(entry.id, position);
          }
        };
        const context = (event) => {
          if (live.current.readOnly || live.current.cleanExport || live.current.renderMode || !live.current.onFeatureContextMenu) return;
          if (event.type === "keydown" && event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
          event.preventDefault();
          event.stopPropagation();
          const bounds = marker.getBoundingClientRect();
          live.current.onFeatureContextMenu({ id: entry.id, featureType: entry.featureType,
            x: event.type === "keydown" ? bounds.left + bounds.width / 2 : event.clientX,
            y: event.type === "keydown" ? bounds.bottom : event.clientY, restoreFocus: () => marker.focus() });
        };
        for (const [event, handler] of [["gmp-click", select], ["gmp-dragend", move], ["contextmenu", context], ["keydown", context], ["click", consumeMovementClick]]) {
          marker.addEventListener(event, handler);
          entry.listeners.push(() => marker.removeEventListener(event, handler));
        }
        markers.current.set(badge.id, entry);
      }
      entry.isDraft = !!badge.isDraft;
      entry.id = badge.id;
      entry.featureType = badge.featureType;
      entry.groupId = badge.groupId;
      entry.combat = normalizeCombat(badge.combat, badge);
      entry.visibility = badge.visibility;
      entry.troopCount = badge.featureType === "unit" ? badge.quantity ?? 1 : badge.troopCount ?? 0;
      entry.position = { lat: badge.lat, lng: badge.lng };
      entry.showTime = badge.visibility?.showAt ? scenarioTime(badge.visibility.showAt) : null;
      entry.hideTime = badge.visibility?.hideAt ? scenarioTime(badge.visibility.hideAt) : null;
      entry.scale = BADGE_SIZES[badge.size] ?? 1;
      entry.stars = badge.featureType === "badge" ? badge.stars ?? 0 : 0;
      entry.route = badge.route.length >= 1 && !routeError(badge.route) ? compileRoute(badge.route, entry.troopCount).map((stop) => ({ ...stop, lat: Number(stop.lat), lng: Number(stop.lng) })) : [];
      entry.hasRoute = badge.route.length > 0;
      entry.marker.gmpClickable = !props.readOnly && !badge.isDraft && (preview || mode === "navigate" || mode === "editMovement");
      entry.marker.gmpDraggable = !preview && mode === "navigate" && !entry.hasRoute;
      entry.marker.title = props.readOnly ? (badge.label ?? badge.name) : badge.isDraft ? "Marker preview" : mode === "editMovement" ? `Choose an effect targeting ${badge.label ?? badge.name}` : `Click to edit ${badge.label ?? badge.name}. Right-click for edit and movement controls.`;
      entry.alwaysShow = mode === "command" || mode === "replay" || editingMovement || preview || mode === "export" || showAllMarkers || badge.isDraft || badge.id === selectedId;
      entry.collisionProtected = mode === "command" || mode === "replay" || editingMovement || showAllMarkers || badge.isDraft || badge.id === selectedId;
      entry.baseCollisionProtected = entry.collisionProtected;
      // Our layout shrinks markers before hiding them; Google's collision pass
      // would otherwise hide markers against one another or map labels first.
      entry.marker.collisionBehavior = api.CollisionBehavior.REQUIRED;
      const appearance = JSON.stringify([badge.featureType, badge.flag, badge.symbol, badge.symbolImage, badge.stars, badge.troopCount, badge.quantity, badge.label, badge.kind, badge.image, badge.color, badge.name, badge.id === selectedId, !!badge.isDraft]);
      if (entry.appearance !== appearance) {
        entry.element = badge.featureType === "unit" ? unitElement(badge, badge.id === selectedId, badge.isDraft) : badgeElement(badge, badge.id === selectedId, badge.isDraft);
        entry.marker.replaceChildren(entry.element);
        entry.appearance = appearance;
        entry.dimensions = null;
        entry.appliedScale = null;
      }
      entry.element.style.setProperty("--group-color", live.current.groups?.find((group) => group.id === badge.groupId)?.color ?? "#3478d4");
      entry.element.classList.toggle("has-group", !!badge.groupId);
      entry.element.classList.toggle("movement-context", editingMovement && !badge.isDraft);
    }
    drawPreview(preview ? playing ? previewTime.current ?? initialPreviewTime : initialPreviewTime : null);
  }, [api, badges, units, draft, unitDraft, selectedId, mode, preview, playing, initialPreviewTime, authoringTime, showAllMarkers, editingMovement, props.groups, props.readOnly, drawPreview]);

  useEffect(() => {
    if (!api) return;
    const items = lines.filter((line) => line.id !== lineDraft?.id);
    if (lineDraft) items.push(lineDraft);
    const ids = new Set(items.map((line) => line.id));
    for (const [id, entry] of lineEntries.current) {
      if (!ids.has(id)) {
        entry.listeners.forEach((listener) => listener.remove());
        entry.line.setMap(null); entry.rendered.setMap(null); entry.label.map = null;
        lineEntries.current.delete(id);
      }
    }
    for (const feature of items) {
      let entry = lineEntries.current.get(feature.id);
      if (!entry) {
        const line = new api.Polyline({ map: api.map, path: feature.path, geodesic: false });
        entry = { label: new api.AdvancedMarkerElement({ collisionBehavior: api.CollisionBehavior.REQUIRED }), line, rendered: new api.Polyline({ map: api.map, geodesic: false }), listeners: [], syncing: false, signature: JSON.stringify(feature.path) };
        const labelClick = () => {
          if (live.current.readOnly) return;
          if (!live.current.preview && live.current.mode === "navigate") live.current.onLineSelect(feature.id);
        };
        const labelMove = () => {
          if (live.current.readOnly) return;
          if (live.current.preview || live.current.lineDraft?.id !== feature.id || live.current.lineDraft.kind !== "text") return;
          const position = entry.label.position;
          live.current.onLinePath([typeof position.lat === "function" ? position.toJSON() : { lat: position.lat, lng: position.lng }]);
        };
        entry.label.addEventListener("gmp-click", labelClick);
        entry.label.addEventListener("gmp-dragend", labelMove);
        entry.listeners.push({ remove() { entry.label.removeEventListener("gmp-click", labelClick); entry.label.removeEventListener("gmp-dragend", labelMove); } });
        const path = line.getPath();
        const changed = (index) => {
          if (live.current.readOnly || entry.syncing || live.current.preview || live.current.lineDraft?.id !== feature.id) return;
          if (path.getLength() > MAX_LINE_POINTS) {
            entry.syncing = true;
            path.removeAt(index);
            entry.syncing = false;
          }
          const points = path.getArray().map((point) => point.toJSON());
          entry.signature = JSON.stringify(points);
          live.current.onLinePath(points);
        };
        for (const event of ["insert_at", "set_at", "remove_at"]) entry.listeners.push(path.addListener(event, changed));
        const clicked = (event) => {
          if (live.current.readOnly || live.current.preview) return;
          if (live.current.lineDraft?.id === feature.id && live.current.mode === "editLine") {
            live.current.onLinePoint(typeof event.vertex === "number" ? event.vertex : null);
          } else if (live.current.mode === "navigate") live.current.onLineSelect(feature.id);
        };
        entry.listeners.push(line.addListener("click", clicked), entry.rendered.addListener("click", clicked));
        lineEntries.current.set(feature.id, entry);
      }
      const signature = JSON.stringify(feature.path);
      if (signature !== entry.signature) {
        entry.syncing = true;
        const path = entry.line.getPath();
        path.clear();
        feature.path.forEach((point) => path.push(new window.google.maps.LatLng(point)));
        entry.signature = signature;
        entry.syncing = false;
      }
      const active = feature.id === lineDraft?.id;
      entry.id = feature.id;
      entry.labelPinned = active;
      const textOnly = feature.kind === "text";
      const showLine = !textOnly && feature.showLine !== false;
      const labelPath = feature.shape === "curve" ? curvedLinePath(feature.path) : feature.path;
      const center = (labelPath.length - 1) / 2;
      const before = labelPath[Math.floor(center)];
      const after = labelPath[Math.ceil(center)];
      if (before && after) {
        entry.label.position = api.spherical.interpolate(before, after, center % 1);
        const element = document.createElement("span");
        element.className = "map-text-label";
        element.textContent = feature.name;
        element.style.color = feature.labelColor ?? lineColor;
        element.style.fontFamily = feature.labelFont ?? "sans-serif";
        element.style.fontSize = (feature.labelSize ?? 16) + "px";
        element.style.fontWeight = (feature.labelBold ?? true) ? "700" : "400";
        element.style.fontStyle = feature.labelItalic ? "italic" : "normal";
        element.style.backgroundColor = feature.labelBackground ?? "transparent";
        if (feature.labelBackground && feature.labelBackground !== "transparent") element.style.textShadow = "none";
        entry.label.replaceChildren(element);
        entry.labelElement = element;
        entry.labelDimensions = null;
      }
      entry.labelVisible = !!before && (feature.showLabel ?? textOnly);
      entry.label.title = feature.name;
      entry.label.gmpClickable = !preview && mode === "navigate";
      entry.label.gmpDraggable = !preview && active && textOnly && mode === "editLine";
      entry.label.zIndex = active ? 40 : 25;
      const curved = feature.shape === "curve";
      const editable = showLine && !preview && active && mode === "editLine";
      const icons = feature.style === "dashed" ? [{ icon: { path: "M 0,-4 L 0,4", strokeColor: lineColor, strokeOpacity: 1, strokeWeight: feature.width, scale: 1 }, offset: "0", repeat: String(feature.width * 3 + 10) + "px" }] : [];
      for (const [enabled, offset, path] of [[feature.startArrow, "0%", window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW], [feature.endArrow, "100%", window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW]]) {
        if (enabled) icons.push({ icon: { path, fillColor: lineColor, fillOpacity: 1, strokeColor: lineColor, strokeOpacity: 1, strokeWeight: 1, scale: Math.max(2, feature.width * 0.65) }, offset });
      }
      const options = {
        strokeColor: lineColor, strokeOpacity: feature.style === "dashed" ? 0 : 1,
        strokeWeight: feature.width, zIndex: active ? 30 : 20,
        clickable: !preview && (mode === "navigate" || editable), icons,
      };
      entry.line.setOptions({ ...options, editable: editable && !curved, strokeOpacity: curved ? 0 : options.strokeOpacity, icons: curved ? [] : icons, visible: showLine && (!curved || editable), zIndex: active ? 31 : 20 });
      entry.rendered.setOptions({ ...options, path: curved ? curvedLinePath(feature.path) : [], visible: showLine && curved });
    }
    drawPreview(previewTime.current);
  }, [api, lines, lineDraft, mode, preview, lineColor, drawPreview]);

  useEffect(() => {
    if (!api || preview || mode !== "drawLine" || !lineDraft?.path.length || lineDraft.kind === "text" || lineDraft.showLine === false || lineDraft.path.length >= MAX_LINE_POINTS) return;
    const icons = lineDraft.style === "dashed" ? [{ icon: { path: "M 0,-4 L 0,4", strokeColor: lineColor, strokeOpacity: 0.6, strokeWeight: lineDraft.width, scale: 1 }, offset: "0", repeat: String(lineDraft.width * 3 + 10) + "px" }] : [];
    for (const [enabled, offset, path] of [[lineDraft.startArrow, "0%", window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW], [lineDraft.endArrow, "100%", window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW]]) {
      if (enabled) icons.push({ icon: { path, fillColor: lineColor, fillOpacity: 0.6, strokeColor: lineColor, strokeOpacity: 0.6, strokeWeight: 1, scale: Math.max(2, lineDraft.width * 0.65) }, offset });
    }
    const guide = new api.Polyline({ map: api.map, geodesic: false, clickable: false, strokeColor: lineColor, strokeOpacity: lineDraft.style === "dashed" ? 0 : 0.6, strokeWeight: lineDraft.width, zIndex: 35, icons, visible: false });
    const move = api.map.addListener("mousemove", (event) => {
      if (!event.latLng) return;
      const path = [...lineDraft.path, event.latLng.toJSON()];
      guide.setPath(lineDraft.shape === "curve" ? curvedLinePath(path) : path);
      guide.setVisible(true);
    });
    const hide = () => guide.setVisible(false);
    const click = api.map.addListener("click", hide);
    const leave = api.map.addListener("mouseout", hide);
    host.current?.addEventListener("mouseleave", hide);
    const container = host.current;
    return () => {
      move.remove(); click.remove(); leave.remove();
      container?.removeEventListener("mouseleave", hide);
      guide.setMap(null);
    };
  }, [api, lineDraft, mode, preview, lineColor]);

  useEffect(() => {
    if (!api || preview || mode !== "editLine" || lineDraft?.shape !== "curve" || lineDraft.kind === "text") return;
    const handles = [];
    const removers = [];
    const points = lineDraft.path;
    const renderedPath = curvedLinePath(points);
    const addHandle = (position, index, insert) => {
      const marker = new api.AdvancedMarkerElement({ map: api.map, position, title: insert ? "Drag to add a bend" : "Drag to adjust curve point " + (index + 1), gmpDraggable: true, zIndex: 2100 });
      const label = document.createElement("span");
      label.className = "curve-point-handle" + (insert ? " curve-bend-handle" : "");
      label.textContent = insert ? "+" : String(index + 1);
      marker.append(label);
      const movedPath = () => {
        const value = marker.position;
        const position = typeof value.lat === "function" ? value.toJSON() : { lat: value.lat, lng: value.lng };
        const next = points.map((point) => ({ ...point }));
        if (insert) next.splice(index, 0, position); else next[index] = position;
        return next;
      };
      const drag = () => lineEntries.current.get(lineDraft.id)?.rendered.setPath(curvedLinePath(movedPath()));
      const end = () => {
        live.current.onLinePath(movedPath());
        live.current.onLinePoint(index);
      };
      const select = () => { if (!insert) live.current.onLinePoint(index); };
      marker.addEventListener("gmp-drag", drag);
      marker.addEventListener("gmp-dragend", end);
      removers.push(marker.addListener("click", select));
      removers.push({ remove: () => { marker.removeEventListener("gmp-drag", drag); marker.removeEventListener("gmp-dragend", end); } });
      handles.push(marker);
    };
    points.forEach((point, index) => addHandle(point, index, false));
    if (points.length < MAX_LINE_POINTS) {
      for (let i = 0; i < points.length - 1; i++) {
        const position = points.length > 2 ? renderedPath[i * 24 + 12] : api.spherical.interpolate(new window.google.maps.LatLng(points[i]), new window.google.maps.LatLng(points[i + 1]), 0.5).toJSON();
        addHandle(position, i + 1, true);
      }
    }
    return () => { removers.forEach((listener) => listener.remove()); handles.forEach((marker) => { marker.map = null; }); };
  }, [api, lineDraft, mode, preview]);

  useEffect(() => {
    if (!api) return;
    const guides = [];
    const handles = [];
    const removers = [];
    const activeGuides = routeGuides.current;
    for (const badge of [...badges, ...units]) {
      if (badge.id === draft?.id || badge.id === unitDraft?.id || (!props.showAllMovement && badge.id !== selectedId && !(props.selectedIds ?? []).includes(badge.id)) || badge.route.length < 2) continue;
      const path = badge.route.map((stop) => coordinates(stop.lat, stop.lng)).filter(Boolean);
      if (path.length < 2) continue;
      const color = props.groups?.find((group) => group.id === badge.groupId)?.color ?? "#3478d4";
      const line = new api.Polyline({ map: api.map, path, geodesic: true, clickable: false, strokeColor: color, strokeOpacity: 0.75, strokeWeight: 3, zIndex: 5 });
      guides.push(line);
      activeGuides.set(badge.id, { line, visible: true, showTime: badge.visibility?.showAt ? scenarioTime(badge.visibility.showAt) : null, hideTime: badge.visibility?.hideAt ? scenarioTime(badge.visibility.hideAt) : null });
    }
    const activeDraft = draft ?? unitDraft;
    if (activeDraft && !preview && activeDraft.route.length) {
      const path = activeDraft.route.map((stop) => coordinates(stop.lat, stop.lng)).filter(Boolean);
      const color = props.groups?.find((group) => group.id === activeDraft.groupId)?.color ?? "#3478d4";
      guides.push(new api.Polyline({ map: api.map, path, geodesic: true, clickable: false, strokeColor: color, strokeWeight: 3, zIndex: 10 }));
      activeDraft.route.forEach((stop, index) => {
        const position = coordinates(stop.lat, stop.lng);
        if (!position) return;
        const marker = new api.AdvancedMarkerElement({ map: api.map, position, title: `Drag stop ${stopLabel(index)}`, gmpDraggable: mode === "navigate", zIndex: 2000 });
        const label = document.createElement("span");
        label.className = "route-stop-marker";
        label.textContent = stopLabel(index);
        marker.append(label);
        const move = () => {
          const p = marker.position;
          live.current.onStopMove(stop.id, typeof p.lat === "function" ? p.toJSON() : { lat: p.lat, lng: p.lng });
        };
        marker.addEventListener("gmp-dragend", move);
        removers.push(() => marker.removeEventListener("gmp-dragend", move));
        handles.push(marker);
      });
    }
    drawPreview(preview ? previewTime.current : null);
    return () => {
      guides.forEach((line) => line.setMap(null));
      activeGuides.clear();
      removers.forEach((remove) => remove());
      handles.forEach((marker) => { marker.map = null; });
    };
  }, [api, badges, units, draft, unitDraft, mode, preview, selectedId, props.selectedIds, props.showAllMovement, props.groups, drawPreview]);

  useEffect(() => { drawPreview(previewTime.current); }, [props.battleForces, props.battleTime, props.battleReplay, props.selectedIds, props.groups, drawPreview]);

  useEffect(() => {
    if (!api || mode !== "command") return;
    return createCommandOverlay(api, markers, live);
  }, [api, mode]);

  useEffect(() => {
    if (!api || !draft || preview || playing || mode === "command" || props.cleanExport || props.renderMode) return;
    const center = coordinates(draft.lat, draft.lng);
    const range = normalizeCombat(draft.combat, draft).range;
    if (!center || range <= 0) return;
    const circle = new window.google.maps.Circle({
      map: api.map, center, radius: range * 1000,
      fillColor: "#ffb020", fillOpacity: 0.06,
      strokeColor: "#ffb020", strokeOpacity: 0.65, strokeWeight: 1,
      clickable: false,
    });
    return () => circle.setMap(null);
  }, [api, draft, preview, playing, mode, props.cleanExport, props.renderMode]);

  useEffect(() => {
    if (!api || mode !== "command") return;
    const shapes = [];
    for (const force of props.battleForces ?? []) {
      if (!props.selectedIds?.includes(force.id) || (force.count === 0 && force.initialCount !== 0) || !force.visible) continue;
      if (force.combat.range > 0) shapes.push(new window.google.maps.Circle({ map: api.map, center: force, radius: force.combat.range * 1000, fillOpacity: 0.04, strokeColor: "#ffb020", strokeOpacity: 0.65, strokeWeight: 1, clickable: false }));
      if (force.move) {
        const path = remainingPath(force.move, props.battleTime);
        shapes.push(new api.Polyline({ map: api.map, path, geodesic: true, strokeColor: "#ffffff", strokeWeight: 6, strokeOpacity: 0.9, clickable: false, zIndex: 41 }));
        shapes.push(new api.Polyline({ map: api.map, path, geodesic: true, strokeColor: "#d62828", strokeWeight: 3, clickable: false, zIndex: 42 }));
        shapes.push(new window.google.maps.Circle({ map: api.map, center: force.move.path.at(-1), radius: Math.max(20, 300000 / 2 ** (api.map.getZoom() ?? 2)), strokeColor: "#d62828", fillColor: "#d62828", fillOpacity: 0.5, strokeWeight: 2, clickable: false }));
      }
    }
    return () => shapes.forEach((shape) => shape.setMap(null));
  }, [api, mode, props.battleForces, props.battleTime, props.selectedIds]);

  useEffect(() => {
    api?.map.setOptions({ draggableCursor: !preview && (pointModes.includes(mode) || mode === "paint") ? "crosshair" : null, draggable: preview || mode !== "paint", disableDoubleClickZoom: !preview && (pointModes.includes(mode) || mode === "paint") });
  }, [api, mode, preview]);

  useEffect(() => {
    const showNavigation = !props.hideNavigationControls && !props.cleanExport && !props.renderMode;
    api?.map.setOptions({ cameraControl: showNavigation, zoomControl: showNavigation });
  }, [api, props.hideNavigationControls, props.cleanExport, props.renderMode]);

  useImperativeHandle(ref, () => ({
    previewAt: drawPreview,
    sampleFeature(feature, time) {
      if (!api || routeError(feature.route)) return null;
      const route = compileRoute(feature.route, feature.troopCount ?? 0).map((stop) => ({ ...stop, lat: Number(stop.lat), lng: Number(stop.lng) }));
      return sampleRoute(route, time, api.spherical.interpolate);
    },
    fitAll() {
      if (!api) return;
      const points = [...[...badges, ...units].flatMap((badge) => [badge, ...badge.route]), ...lines.flatMap((line) => line.path), ...paintStrokes.flatMap((stroke) => stroke.points)];
      if (!points.length) return;
      if (points.length === 1) { api.map.setCenter({ lat: points[0].lat, lng: points[0].lng }); api.map.setZoom(10); }
      else {
        const bounds = new window.google.maps.LatLngBounds();
        points.forEach(({ lat, lng }) => bounds.extend({ lat, lng }));
        const timeline = host.current?.closest(".map-stage")?.querySelector(".timeline");
        const previewControls = host.current?.closest(".map-stage")?.querySelector(".preview-map-controls");
        const controlsOverlayMap = previewControls && previewControls.getBoundingClientRect().bottom > api.map.getDiv().getBoundingClientRect().top;
        const top = controlsOverlayMap ? previewControls.offsetTop + previewControls.offsetHeight + 16 : !previewControls && timeline ? timeline.offsetTop + timeline.offsetHeight + 16 : 80;
        const bottom = controlsOverlayMap && timeline ? Math.max(60, api.map.getDiv().clientHeight - timeline.offsetTop + 16) : 60;
        api.map.fitBounds(bounds, { top, bottom, left: 50, right: 70 });
      }
    },
    focus(point) {
      const position = coordinates(point.lat, point.lng);
      if (position) api?.map.panTo(position);
    },
    restore(view) { api?.map.setOptions({ ...view, heading: view.heading ?? 0, tilt: 0 }); },
    getReferenceZoom() { return startView.zoom; },
    async renderFrame(view, time) {
      if (!api) throw new Error("The map is not ready for a frame.");
      const current = cameraView(api.map);
      const longitudeDelta = current ? Math.abs(((current.center.lng - view.center.lng + 540) % 360) - 180) : Infinity;
      const changed = !current || Math.abs(current.center.lat - view.center.lat) > 1e-9 || longitudeDelta > 1e-9
        || Math.abs(current.zoom - view.zoom) > 1e-7 || Math.abs(current.heading - (view.heading ?? 0)) > 1e-7
        || current.mapTypeId !== view.mapTypeId;
      if (changed) {
        api.map.setMapTypeId(view.mapTypeId);
        api.map.moveCamera({ center: view.center, zoom: view.zoom, heading: view.heading ?? 0, tilt: 0 });
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
      drawPreview(time);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    },
    getView() {
      return cameraView(api?.map);
    },
    setType(type) { api?.map.setMapTypeId(type); },
    rotate(angle) { if (api) api.map.setHeading(((api.map.getHeading() ?? 0) + angle + 360) % 360); },
    resetHeading() { api?.map.setHeading(0); },
  }), [api, badges, units, lines, paintStrokes, drawPreview, startView.zoom]);

  return <div className={`google-map${props.cleanExport || props.renderMode ? " clean-export-map" : ""}`} ref={host} aria-label="Google map with badges, equipment, lines, and routes" />;
});

export default MapCanvas;
