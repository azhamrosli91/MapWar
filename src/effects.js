import { effectSymbols } from "./badge.js";
import { boxIntersectsViewport, mapViewport, nearestWorldPoint, pathIntersectsViewport, projectedMarkerBox } from "./viewport.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const SHOT_MS = 260;
const SHOT_OFFSETS = [0, 75, 150, 225, 300, 375];
const FIRING_REPEAT_MS = 600;
const EFFECT_CYCLES = { booming: 1350, demolish: 1500, kills: 1250, crack: 800 };
const IMPACT_DURATION_MS = 3000;
const EFFECTS_WITH_IMPACTS = ["firing", "booming", "demolish"];
const EFFECT_STYLES = {
  booming: { fill: "#b55b24", ink: "#fff0a3", glow: "#ffb641" },
  demolish: { fill: "#715644", ink: "#fff0d1", glow: "#d2ac83" },
  kills: { fill: "#343948", ink: "#fff1c7", glow: "#c7d0e3" },
  crack: { fill: "#5e4a7d", ink: "#f8f1ff", glow: "#d8a8ff" },
};

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function createImpactSprite(effect, area = false) {
  const style = EFFECT_STYLES[effect === "firing" ? "booming" : effect];
  const symbol = effectSymbols[effect === "firing" ? "booming" : effect];
  const group = svgElement("g");
  if (area) {
    group.append(
      svgElement("circle", { r: 82, fill: style.fill, "fill-opacity": 0.22, stroke: style.glow, "stroke-width": 3 }),
      svgElement("circle", { r: 56, fill: "none", stroke: style.glow, "stroke-width": 2, "stroke-dasharray": "8 6" }),
      svgElement("circle", { r: 28, fill: "none", stroke: style.ink, "stroke-width": 1.5 }),
    );
  } else {
    group.append(
      svgElement("circle", { r: 54, fill: "none", stroke: style.glow, "stroke-width": 3 }),
      svgElement("circle", { r: 9, fill: style.fill, stroke: style.ink, "stroke-width": 1.5 }),
    );
    const glyph = svgElement("text", { x: 0, y: 1, fill: style.ink, "font-size": 20, "font-weight": 700, "font-family": "Arial, Segoe UI Symbol, Segoe UI Emoji, sans-serif", "text-anchor": "middle", "dominant-baseline": "central" });
    glyph.textContent = symbol;
    group.append(glyph);
  }
  return group;
}

function animateImpact(impact, elapsed, targetScale, destination) {
  if (!impact) return;
  if (elapsed < 0 || elapsed >= IMPACT_DURATION_MS) {
    impact.setAttribute("opacity", 0);
    return;
  }
  const progress = elapsed / IMPACT_DURATION_MS;
  const pulse = 0.9 + Math.sin(elapsed * Math.PI * 2 / 750) * 0.12;
  const fade = progress > 0.8 ? 1 - (progress - 0.8) / 0.2 : 1;
  impact.setAttribute("opacity", fade);
  impact.setAttribute("transform", `translate(${destination.x} ${destination.y}) scale(${targetScale * pulse})`);
}

function createFiringBurst() {
  const group = svgElement("g");
  const flash = svgElement("g");
  flash.append(
    svgElement("path", { d: "M0 0 8-7 10-3 26 0 10 3 8 7Z", fill: "#ffb52e", stroke: "#a65a12", "stroke-width": 0.6 }),
    svgElement("path", { d: "M0 0 9-3 20 0 9 3Z", fill: "#fffbd5" }),
  );
  const shots = SHOT_OFFSETS.map(() => {
    const shot = svgElement("g");
    const glow = svgElement("rect", { fill: "#f5a126", stroke: "#9b5618", "stroke-width": 0.7, opacity: 0.8 });
    const core = svgElement("rect", { fill: "#fff7b0" });
    shot.append(glow, core);
    group.append(shot);
    return { shot, glow, core };
  });
  group.append(flash);
  return { group, flash, shots, impact: createImpactSprite("firing") };
}

function createEffectSprite(effect, areaTarget = false) {
  const group = svgElement("g");
  const style = EFFECT_STYLES[effect];
  const trail = svgElement("rect", { x: -31, y: -2, width: 22, height: 4, rx: 2, fill: style.glow, opacity: 0.85 });
  const ring = svgElement("circle", { r: 11, fill: style.fill, stroke: style.glow, "stroke-width": 1.8 });
  const glyph = svgElement("text", { x: 0, y: 1, fill: style.ink, "font-size": 18, "font-weight": 700, "font-family": "Arial, Segoe UI Symbol, Segoe UI Emoji, sans-serif", "text-anchor": "middle", "dominant-baseline": "central" });
  glyph.textContent = effectSymbols[effect];
  group.append(trail, ring, glyph);
  const impact = EFFECTS_WITH_IMPACTS.includes(effect) ? createImpactSprite(effect, areaTarget) : null;
  return { group, trail, ring, glyph, effect, impact };
}

function markerBox(entry, projection, viewport) {
  if (!entry?.visible) return null;
  // Required markers do not collide. Their temporary map-managed visibility
  // during positioning must not make a paused/exported firing frame disappear.
  if (entry.rendered && !entry.alwaysShow && (!entry.element?.isConnected || !entry.element.checkVisibility({ visibilityProperty: true }))) return null;
  const cached = projectedMarkerBox(entry, projection, viewport);
  if (cached) return cached;
  if (!entry.element?.isConnected) return null;
  const point = nearestWorldPoint(projection.fromLatLngToDivPixel(entry.currentPosition ?? entry.marker.position), viewport);
  const width = entry.element.offsetWidth;
  const height = entry.element.offsetHeight;
  if (!point || !width || !height) return null;
  // Advanced markers are anchored at their bottom center; aim from their visual center.
  return { x: point.x, y: point.y - height / 2, width, height };
}

function edgeDistance(box, dx, dy) {
  return Math.min(dx ? box.width / (2 * Math.abs(dx)) : Infinity, dy ? box.height / (2 * Math.abs(dy)) : Infinity);
}

export function createEffectOverlay(api, onProjectionReady) {
  class EffectOverlay extends api.OverlayView {
    constructor() {
      super();
      this.entries = new Map();
      this.bursts = new Map();
      this.frame = null;
      this.svg = svgElement("svg", { class: "firing-overlay", width: 1, height: 1, "aria-hidden": "true" });
      this.shade = svgElement("rect", { fill: "#071322", opacity: 0, "pointer-events": "none" });
      this.svg.append(this.shade);
      this.targetPreview = createImpactSprite("booming", true);
      this.targetPreview.setAttribute("opacity", 0);
      this.svg.append(this.targetPreview);
      this.nightShade = 0;
    }

    onAdd() {
      const panes = this.getPanes();
      // This pane sits above Google's place labels. Our non-interactive SVG
      // stays below the markers, whose z-index starts at 1.
      panes.overlayMouseTarget.append(this.svg);
      // Google Maps may reveal or hide marker DOM after draw(), especially on
      // the first seek. Redraw as soon as that visibility settles, even paused.
      this.markerObserver = new MutationObserver((records) => {
        if (records.some((record) => !this.svg.contains(record.target))) this.scheduleDraw();
      });
      for (const pane of [panes.markerLayer, panes.overlayMouseTarget]) {
        this.markerObserver.observe(pane, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class", "hidden"] });
      }
    }

    setTargetPreview(position) {
      this.targetPreviewPosition = position;
      this.draw();
    }

    update(entries, nightShade = 0) {
      this.entries = entries;
      this.nightShade = nightShade;
      this.draw();
      // Marker attachment and collision visibility can settle after the map update.
      // This redraw uses the same timeline time, never a separate animation clock.
      this.scheduleDraw();
    }

    scheduleDraw() {
      if (this.frame == null) this.frame = requestAnimationFrame(() => {
        this.frame = null;
        this.draw();
      });
    }

    draw() {
      const projection = this.getProjection();
      if (!projection || !this.getMap()) return;
      const viewport = mapViewport(projection, api.map);
      if (!viewport) return;
      if (!this.projectionReady) {
        this.projectionReady = true;
        this.readyFrame = requestAnimationFrame(() => {
          this.readyFrame = null;
          onProjectionReady?.();
        });
      }
      const active = new Set();
      const boxes = new Map();
      const boxFor = (entry) => {
        if (!entry) return null;
        if (!boxes.has(entry.id)) boxes.set(entry.id, markerBox(entry, projection, viewport));
        return boxes.get(entry.id);
      };
      const { width, height, left, top } = viewport;
      // Keep the SVG viewport aligned with the visible map during pan and zoom.
      this.svg.setAttribute("width", width);
      this.svg.setAttribute("height", height);
      this.svg.setAttribute("viewBox", `${left} ${top} ${width} ${height}`);
      this.svg.style.left = `${left}px`;
      this.svg.style.top = `${top}px`;
      this.shade.setAttribute("x", left);
      this.shade.setAttribute("y", top);
      this.shade.setAttribute("width", width);
      this.shade.setAttribute("height", height);
      this.shade.setAttribute("opacity", this.nightShade);
      const previewPoint = this.targetPreviewPosition ? nearestWorldPoint(projection.fromLatLngToDivPixel(this.targetPreviewPosition), viewport) : null;
      this.targetPreview.setAttribute("opacity", previewPoint ? 0.5 : 0);
      if (previewPoint) this.targetPreview.setAttribute("transform", `translate(${previewPoint.x} ${previewPoint.y})`);
      for (const entry of this.entries.values()) {
        const effect = entry.sample?.effect;
        if (!effect || effect === "none" || !entry.visible) continue;
        if (!Number.isFinite(entry.effectElapsed)) continue;
        const repeatWhileMoving = entry.isMoving && (effect === "firing" || effect === "booming");
        const travelDuration = effect === "firing" ? SHOT_OFFSETS.at(-1) + SHOT_MS : EFFECT_CYCLES[effect] * 0.56;
        const hasImpact = EFFECTS_WITH_IMPACTS.includes(effect);
        const impactDuration = hasImpact ? IMPACT_DURATION_MS : 0;
        const animationDuration = travelDuration + impactDuration;
        if (!repeatWhileMoving && entry.effectElapsed >= animationDuration) continue;
        const targetLocation = effect === "booming" ? entry.sample.targetLocation : null;
        const target = targetLocation ? null : this.entries.get(entry.sample.firingTargetId);
        if (!targetLocation && (!target || target === entry)) continue;
        const sourceBox = boxFor(entry);
        const targetPoint = targetLocation ? nearestWorldPoint(projection.fromLatLngToDivPixel({ lat: Number(targetLocation.lat), lng: Number(targetLocation.lng) }), viewport) : null;
        const targetBox = targetLocation && targetPoint ? { x: targetPoint.x, y: targetPoint.y, width: 0, height: 0 } : boxFor(target);
        if (!sourceBox || !targetBox) continue;
        const repeatDuration = effect === "firing" ? FIRING_REPEAT_MS : animationDuration;
        const phase = repeatWhileMoving ? Math.max(0, entry.effectElapsed) % repeatDuration : Math.max(0, entry.effectElapsed);
        // Select the nearest world copy, including when a route crosses ±180°.
        const source = { ...sourceBox };
        const destination = { ...targetBox, ...nearestWorldPoint(targetBox, viewport, source) };
        const scale = entry.displayScale;
        const targetScale = Math.max(scale, target?.displayScale ?? scale);
        const impactPadding = (targetLocation ? 86 : 58) * targetScale * 1.02;
        const impactVisible = hasImpact && boxIntersectsViewport({ ...destination, width: 0, height: 0 }, viewport, impactPadding);
        if (!impactVisible && !pathIntersectsViewport(source, destination, viewport, 34 * scale)) continue;
        const x = destination.x - source.x;
        const y = destination.y - source.y;
        const markersOverlap = Math.abs(x) <= (source.width + destination.width) / 2 && Math.abs(y) <= (source.height + destination.height) / 2;
        if (markersOverlap && !hasImpact) continue;
        const distance = Math.hypot(x, y);
        const dx = distance ? x / distance : 0;
        const dy = distance ? y / distance : 0;
        const start = edgeDistance(source, dx, dy) + 4;
        const end = distance - edgeDistance(destination, dx, dy) - 4;
        const length = end - start;
        const hasTravel = Number.isFinite(length) && length > 0;
        if (!hasTravel && !hasImpact) continue;
        const eventKey = JSON.stringify([effect, entry.sample.effectStart, entry.sample.firingTargetId, targetLocation?.lat, targetLocation?.lng]);
        active.add(entry.id);
        let burst = this.bursts.get(entry.id);
        if (!burst || burst.effect !== effect || burst.eventKey !== eventKey) {
          burst?.group.remove();
          burst?.impact?.remove();
          burst = effect === "firing" ? createFiringBurst() : createEffectSprite(effect, !!targetLocation);
          burst.effect = effect;
          burst.eventKey = eventKey;
          this.bursts.set(entry.id, burst);
          this.svg.append(burst.group);
          if (burst.impact) this.svg.append(burst.impact);
        }
        if (effect !== "firing") {
          const duration = travelDuration;
          const age = phase < duration ? phase : null;
          if (age == null || !hasTravel) {
            burst.group.setAttribute("opacity", 0);
          } else {
            const progress = age / duration;
            const travel = Math.max(0, length - 14 * scale);
            const pulse = effect === "booming" ? 1 + 0.18 * Math.sin(progress * Math.PI * 4) : effect === "kills" ? 1 + 0.1 * Math.sin(progress * Math.PI * 2) : 1;
            burst.group.setAttribute("opacity", effect === "crack" && age > duration * 0.7 ? 0.55 : 1);
            burst.group.setAttribute("transform", `translate(${source.x + dx * (start + travel * progress)} ${source.y + dy * (start + travel * progress)}) rotate(${Math.atan2(y, x) * 180 / Math.PI}) scale(${scale * pulse})`);
          }
          if (hasImpact) animateImpact(burst.impact, phase - duration, Math.max(entry.displayScale, target?.displayScale ?? entry.displayScale), destination);
          continue;
        }
        if (!hasTravel) {
          burst.group.setAttribute("opacity", 0);
          animateImpact(burst.impact, phase - travelDuration, Math.max(entry.displayScale, target?.displayScale ?? entry.displayScale), destination);
          continue;
        }
        burst.group.setAttribute("opacity", 1);
        burst.group.setAttribute("transform", `translate(${source.x + dx * start} ${source.y + dy * start}) rotate(${Math.atan2(y, x) * 180 / Math.PI})`);
        const flashAge = SHOT_OFFSETS.map((offset) => phase - offset).find((age) => age >= 0 && age < 110);
        burst.flash.setAttribute("opacity", flashAge == null ? 0 : 1 - flashAge / 110);
        burst.flash.setAttribute("transform", `scale(${Math.min(scale, length / 26)})`);
        burst.shots.forEach(({ shot, glow, core }, index) => {
          const age = phase - SHOT_OFFSETS[index];
          const visible = age >= 0 && age < SHOT_MS;
          shot.setAttribute("opacity", visible ? 1 : 0);
          if (!visible) return;
          const tip = length * age / SHOT_MS;
          const tail = Math.max(0, tip - Math.min(28 * scale, length * 0.3));
          for (const [shape, thickness] of [[glow, 7 * scale], [core, 2.5 * scale]]) {
            shape.setAttribute("x", tail);
            shape.setAttribute("y", -thickness / 2);
            shape.setAttribute("width", tip - tail);
            shape.setAttribute("height", thickness);
            shape.setAttribute("rx", thickness / 2);
          }
        });
        const impactElapsed = repeatWhileMoving
          ? entry.effectElapsed < travelDuration ? -1 : (entry.effectElapsed - travelDuration) % IMPACT_DURATION_MS
          : phase - travelDuration;
        animateImpact(burst.impact, impactElapsed, Math.max(entry.displayScale, target?.displayScale ?? entry.displayScale), destination);
      }
      for (const [id, burst] of this.bursts) {
        if (active.has(id)) continue;
        burst.group.remove();
        burst.impact?.remove();
        this.bursts.delete(id);
      }
    }

    onRemove() {
      this.markerObserver?.disconnect();
      cancelAnimationFrame(this.frame);
      cancelAnimationFrame(this.readyFrame);
      this.frame = null;
      this.svg.remove();
      this.svg.replaceChildren();
      this.bursts.clear();
      this.entries = new Map();
    }
  }

  const overlay = new EffectOverlay();
  overlay.setMap(api.map);
  return overlay;
}
