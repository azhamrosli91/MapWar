import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { badgeElement, setBadgeTroopCount, setFeatureEffect, unitElement } from "./badge.js";
import { coordinates } from "./data.js";
import { createEffectOverlay } from "./effects.js";
import { createPaintOverlay } from "./paint-overlay.js";
import { boxIntersectsViewport, mapViewport, measureMarker, projectedMarkerBox } from "./viewport.js";
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

const pointModes = ["placeBadge", "placeUnit", "drawLine", "addStop", "repointStop", "placeEffectTarget"];
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
  const { initialView, badges, units = [], draft, unitDraft, targetLocationStopId, selectedId, mode, preview, previewTime: initialPreviewTime, lines, lineDraft, paintStrokes = [], brush, showAllMarkers = false } = props;
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
        mapTypeControl: false, cameraControl: !live.current.renderMode, zoomControl: !live.current.renderMode, zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_CENTER }, gestureHandling: live.current.renderMode ? "none" : "greedy", keyboardShortcuts: !live.current.renderMode,
      });
      setApi({ map, Polyline, OverlayView, AdvancedMarkerElement, CollisionBehavior, spherical });
      setMapTypeId(map.getMapTypeId());
      listeners.push(map.addListener("maptypeid_changed", () => setMapTypeId(map.getMapTypeId())));
      listeners.push(map.addListener("click", (event) => {
        if (!live.current.preview && pointModes.includes(live.current.mode) && event.latLng) live.current.onPoint(event.latLng.toJSON());
      }));
      listeners.push(map.addListener("idle", () => {
        if (map.getCenter()) live.current.onView({ center: map.getCenter().toJSON(), zoom: map.getZoom(), mapTypeId: map.getMapTypeId(), heading: ((map.getHeading() ?? 0) % 360 + 360) % 360 });
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
    previewTime.current = time;
    if (!api) return;
    const projection = effectOverlay.current?.getProjection();
    const viewport = mapViewport(projection, api.map);
    const zoom = api.map.getZoom() ?? startView.zoom;
    for (const entry of markers.current.values()) {
      const visible = time == null || ((entry.showTime == null || time >= entry.showTime) && (entry.hideTime == null || time < entry.hideTime));
      entry.visible = visible;
      const sample = time == null ? null : sampleRoute(entry.route, time, api.spherical.interpolate);
      const position = sample?.position ?? entry.position;
      entry.currentPosition = typeof position.lat === "function" ? position : { lat: position.lat, lng: position.lng };
      entry.isMoving = !!sample?.moving;
      entry.displayScale = zoomAdjustedScale(sample?.scale ?? entry.scale, zoom, startView.zoom);
      const range = live.current.animationRange;
      const duration = live.current.animationDuration;
      const effectElapsed = sample?.effectStart != null && range && range.end > range.start && duration
        ? (time - sample.effectStart) / (range.end - range.start) * duration * 1000
        : 0;
      entry.sample = sample;
      entry.effectElapsed = effectElapsed;
      if (visible) measureMarker(entry, markerMeasurements.current);
      const box = viewport ? projectedMarkerBox(entry, projection, viewport) : null;
      entry.inViewport = !box || boxIntersectsViewport(box, viewport, entry.dimensions.padding * entry.displayScale);
      const rendered = visible && entry.inViewport;
      if (rendered) {
        entry.marker.position = entry.currentPosition;
        if (entry.appliedScale !== entry.displayScale) {
          entry.element.style.setProperty("--badge-scale", entry.displayScale);
          entry.appliedScale = entry.displayScale;
        }
        setBadgeTroopCount(entry.element, sample?.troopCount ?? entry.troopCount);
        setFeatureEffect(entry.element, sample?.effect ?? "none", effectElapsed, entry.isMoving);
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
    const overlay = createPaintOverlay(api, (stroke) => live.current.onPaintStroke?.(stroke));
    paintOverlay.current = overlay;
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
        const select = () => {
          if (!entry.isDraft && !live.current.preview && live.current.mode === "navigate") {
            if (entry.featureType === "unit") live.current.onUnitSelect(entry.id);
            else live.current.onSelect(entry.id);
          }
        };
        const move = () => {
          if (!entry.isDraft && !entry.route.length && !live.current.preview && live.current.mode === "navigate") {
            const p = marker.position;
            const position = typeof p.lat === "function" ? p.toJSON() : { lat: p.lat, lng: p.lng };
            if (entry.featureType === "unit") live.current.onUnitMove(entry.id, position);
            else live.current.onMove(entry.id, position);
          }
        };
        for (const [event, handler] of [["gmp-click", select], ["gmp-dragend", move]]) {
          marker.addEventListener(event, handler);
          entry.listeners.push(() => marker.removeEventListener(event, handler));
        }
        markers.current.set(badge.id, entry);
      }
      entry.isDraft = !!badge.isDraft;
      entry.id = badge.id;
      entry.featureType = badge.featureType;
      entry.troopCount = badge.troopCount ?? 0;
      entry.position = { lat: badge.lat, lng: badge.lng };
      entry.showTime = badge.visibility?.showAt ? scenarioTime(badge.visibility.showAt) : null;
      entry.hideTime = badge.visibility?.hideAt ? scenarioTime(badge.visibility.hideAt) : null;
      entry.scale = BADGE_SIZES[badge.size] ?? 1;
      entry.stars = badge.featureType === "badge" ? badge.stars ?? 0 : 0;
      entry.route = badge.route.length >= 1 && !routeError(badge.route) ? compileRoute(badge.route, badge.troopCount ?? 0).map((stop) => ({ ...stop, lat: Number(stop.lat), lng: Number(stop.lng) })) : [];
      entry.marker.gmpClickable = !badge.isDraft && !preview && mode === "navigate";
      entry.marker.gmpDraggable = !badge.isDraft && !preview && mode === "navigate" && !badge.route.length;
      entry.marker.title = badge.isDraft ? "Marker preview" : `Click to edit ${badge.label ?? badge.name}`;
      entry.alwaysShow = editingMovement || preview || mode === "export" || showAllMarkers || badge.isDraft || badge.id === selectedId;
      entry.marker.collisionBehavior = entry.alwaysShow
        ? api.CollisionBehavior.REQUIRED
        : api.CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY;
      const appearance = JSON.stringify([badge.featureType, badge.flag, badge.symbol, badge.symbolImage, badge.stars, badge.troopCount, badge.label, badge.kind, badge.image, badge.color, badge.name, badge.id === selectedId, !!badge.isDraft]);
      if (entry.appearance !== appearance) {
        entry.element = badge.featureType === "unit" ? unitElement(badge, badge.id === selectedId, badge.isDraft) : badgeElement(badge, badge.id === selectedId, badge.isDraft);
        entry.marker.replaceChildren(entry.element);
        entry.appearance = appearance;
        entry.dimensions = null;
        entry.appliedScale = null;
      }
      entry.element.classList.toggle("movement-context", editingMovement && !badge.isDraft);
    }
    drawPreview(preview ? (previewTime.current ?? initialPreviewTime) : null);
  }, [api, badges, units, draft, unitDraft, selectedId, mode, preview, initialPreviewTime, showAllMarkers, editingMovement, drawPreview]);

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
          if (!live.current.preview && live.current.mode === "navigate") live.current.onLineSelect(feature.id);
        };
        const labelMove = () => {
          if (live.current.preview || live.current.lineDraft?.id !== feature.id || live.current.lineDraft.kind !== "text") return;
          const position = entry.label.position;
          live.current.onLinePath([typeof position.lat === "function" ? position.toJSON() : { lat: position.lat, lng: position.lng }]);
        };
        entry.label.addEventListener("gmp-click", labelClick);
        entry.label.addEventListener("gmp-dragend", labelMove);
        entry.listeners.push({ remove() { entry.label.removeEventListener("gmp-click", labelClick); entry.label.removeEventListener("gmp-dragend", labelMove); } });
        const path = line.getPath();
        const changed = (index) => {
          if (entry.syncing || live.current.preview || live.current.lineDraft?.id !== feature.id) return;
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
          if (live.current.preview) return;
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
      }
      entry.label.map = before && (feature.showLabel ?? textOnly) ? api.map : null;
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
  }, [api, lines, lineDraft, mode, preview, lineColor]);

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
      if (badge.id === draft?.id || badge.id === unitDraft?.id || (!editingMovement && !badge.showTrail) || badge.route.length < 2) continue;
      const path = badge.route.map((stop) => coordinates(stop.lat, stop.lng)).filter(Boolean);
      if (path.length < 2) continue;
      const line = new api.Polyline({ map: api.map, path, geodesic: true, clickable: false, strokeColor: lineColor, strokeOpacity: editingMovement ? 0.25 : 0.75, strokeWeight: editingMovement ? 2 : 3, zIndex: 5 });
      guides.push(line);
      activeGuides.set(badge.id, { line, visible: true, showTime: badge.visibility?.showAt ? scenarioTime(badge.visibility.showAt) : null, hideTime: badge.visibility?.hideAt ? scenarioTime(badge.visibility.hideAt) : null });
    }
    const activeDraft = draft ?? unitDraft;
    if (activeDraft && !preview && activeDraft.route.length) {
      const path = activeDraft.route.map((stop) => coordinates(stop.lat, stop.lng)).filter(Boolean);
      guides.push(new api.Polyline({ map: api.map, path, geodesic: true, clickable: false, strokeColor: lineColor, strokeWeight: 3, zIndex: 10 }));
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
  }, [api, badges, units, draft, unitDraft, mode, preview, lineColor, editingMovement, drawPreview]);

  useEffect(() => {
    api?.map.setOptions({ draggableCursor: !preview && (pointModes.includes(mode) || mode === "paint") ? "crosshair" : null, draggable: preview || mode !== "paint", disableDoubleClickZoom: !preview && (pointModes.includes(mode) || mode === "paint") });
  }, [api, mode, preview]);

  useImperativeHandle(ref, () => ({
    previewAt: drawPreview,
    fitAll() {
      if (!api) return;
      const points = [...[...badges, ...units].flatMap((badge) => [badge, ...badge.route]), ...lines.flatMap((line) => line.path), ...paintStrokes.flatMap((stroke) => stroke.points)];
      if (!points.length) return;
      if (points.length === 1) { api.map.setCenter({ lat: points[0].lat, lng: points[0].lng }); api.map.setZoom(10); }
      else {
        const bounds = new window.google.maps.LatLngBounds();
        points.forEach(({ lat, lng }) => bounds.extend({ lat, lng }));
        const timeline = host.current?.closest(".map-stage")?.querySelector(".timeline");
        const top = timeline ? timeline.offsetTop + timeline.offsetHeight + 16 : 80;
        api.map.fitBounds(bounds, { top, bottom: 60, left: 50, right: 70 });
      }
    },
    focus(point) {
      const position = coordinates(point.lat, point.lng);
      if (position) api?.map.panTo(position);
    },
    restore(view) { api?.map.setOptions({ ...view, heading: view.heading ?? 0, tilt: 0 }); },
    getView() {
      const center = api?.map.getCenter();
      return center ? { center: center.toJSON(), zoom: api.map.getZoom(), mapTypeId: api.map.getMapTypeId(), heading: ((api.map.getHeading() ?? 0) % 360 + 360) % 360 } : null;
    },
    setType(type) { api?.map.setMapTypeId(type); },
    rotate(angle) { if (api) api.map.setHeading(((api.map.getHeading() ?? 0) + angle + 360) % 360); },
    resetHeading() { api?.map.setHeading(0); },
  }), [api, badges, units, lines, paintStrokes, drawPreview]);

  return <div className="google-map" ref={host} aria-label="Google map with badges, equipment, lines, and routes" />;
});

export default MapCanvas;
