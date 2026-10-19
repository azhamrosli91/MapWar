// Use the same projected world copy for marker visibility and effect geometry.
export function mapViewport(projection, map) {
  const position = map.getCenter();
  const { clientWidth: width, clientHeight: height } = map.getDiv();
  if (!projection || !position || !width || !height) return null;
  const center = projection.fromLatLngToDivPixel(position);
  if (!center) return null;
  const worldWidth = projection.getWorldWidth();
  const heading = (map.getHeading() ?? 0) * Math.PI / 180;
  return {
    center, width, height,
    left: center.x - width / 2, top: center.y - height / 2,
    right: center.x + width / 2, bottom: center.y + height / 2,
    worldWidth, worldX: worldWidth * Math.cos(heading), worldY: -worldWidth * Math.sin(heading),
  };
}

export function nearestWorldPoint(point, viewport, anchor = viewport.center) {
  if (!point) return null;
  const { worldWidth, worldX, worldY } = viewport;
  const wrap = worldWidth > 0
    ? Math.round(((anchor.x - point.x) * worldX + (anchor.y - point.y) * worldY) / (worldWidth * worldWidth))
    : 0;
  return { x: point.x + wrap * worldX, y: point.y + wrap * worldY };
}

export function measureMarker(entry, container) {
  if (entry.dimensions || !container || !entry.element) return;
  // Measure once at a neutral scale, even when Google's marker is detached.
  const copy = entry.element.cloneNode(true);
  copy.style.setProperty("--badge-scale", 1);
  container.append(copy);
  const width = copy.offsetWidth;
  const height = copy.offsetHeight;
  const countWidth = copy.querySelector(".badge-troop-count")?.offsetWidth ?? 0;
  copy.remove();
  if (width && height) entry.dimensions = { width, height, padding: Math.max(50, countWidth) };
}

export function projectedMarkerBox(entry, projection, viewport) {
  if (!entry?.dimensions) return null;
  const point = nearestWorldPoint(projection.fromLatLngToDivPixel(entry.currentPosition ?? entry.marker.position), viewport);
  if (!point) return null;
  const scale = entry.displayScale ?? entry.scale;
  const width = entry.dimensions.width * scale;
  const height = entry.dimensions.height * scale;
  return { x: point.x + (entry.battleOffset ?? 0), y: point.y - height / 2, width, height };
}

export function boxIntersectsViewport(box, viewport, padding = 0) {
  return box.x + box.width / 2 + padding >= viewport.left
    && box.x - box.width / 2 - padding <= viewport.right
    && box.y + box.height / 2 + padding >= viewport.top
    && box.y - box.height / 2 - padding <= viewport.bottom;
}

export function declutterMarkers(entries, projection, viewport) {
  if (!viewport) return;
  const candidates = entries.filter((entry) => entry.visible && entry.inViewport).map((entry) => {
    const box = projectedMarkerBox(entry, projection, viewport);
    return box ? { entry, x: box.x, bottom: box.y + box.height / 2, baseScale: entry.displayScale } : null;
  }).filter(Boolean);
  const bounds = ({ entry, x, bottom }) => {
    const width = entry.dimensions.width * entry.displayScale;
    const height = entry.dimensions.height * entry.displayScale;
    return { left: x - width / 2 - 3, right: x + width / 2 + 3, top: bottom - height - 3, bottom: bottom + 3 };
  };
  // Index screen rectangles so distant markers never need pairwise comparisons.
  const createIndex = () => {
    const cells = new Map();
    const keys = (box) => {
      const result = [];
      for (let x = Math.floor(box.left / 128); x <= Math.floor(box.right / 128); x++) {
        for (let y = Math.floor(box.top / 128); y <= Math.floor(box.bottom / 128); y++) result.push(`${x},${y}`);
      }
      return result;
    };
    return {
      overlaps(box) {
        const found = new Set();
        for (const key of keys(box)) {
          for (const item of cells.get(key) ?? []) {
            if (box.left < item.box.right && box.right > item.box.left && box.top < item.box.bottom && box.bottom > item.box.top) found.add(item.candidate);
          }
        }
        return found;
      },
      add(candidate, box) {
        const item = { candidate, box };
        for (const key of keys(box)) {
          if (!cells.has(key)) cells.set(key, []);
          cells.get(key).push(item);
        }
      },
    };
  };
  // Keep both sides of an encounter, even outside active combat playback.
  const opponents = new Set();
  const encounterIndex = createIndex();
  for (const candidate of candidates) {
    const box = bounds(candidate);
    for (const other of encounterIndex.overlaps(box)) {
      if (candidate.entry.groupId && other.entry.groupId && candidate.entry.groupId !== other.entry.groupId) {
        opponents.add(candidate);
        opponents.add(other);
      }
    }
    encounterIndex.add(candidate, box);
  }
  // Opponents stay readable with a modest reduction; other clutter can shrink further.
  for (const factor of [0.85, 0.7, 0.6, 0.5]) {
    const index = createIndex();
    const crowded = new Set();
    for (const candidate of candidates) {
      const box = bounds(candidate);
      const overlaps = index.overlaps(box);
      if (overlaps.size) {
        crowded.add(candidate);
        for (const other of overlaps) crowded.add(other);
      }
      index.add(candidate, box);
    }
    if (!crowded.size) break;
    for (const candidate of crowded) {
      candidate.entry.displayScale = candidate.baseScale * (opponents.has(candidate) ? Math.max(0.7, factor) : factor);
    }
  }
  // Keep one representative where allies still overlap, including during combat.
  // Selected markers, drafts, and the explicit show-all option remain visible.
  const groupIndex = createIndex();
  const grouped = [...candidates].sort((a, b) => Number(!!b.entry.collisionPinned) - Number(!!a.entry.collisionPinned)
    || Number(opponents.has(b)) - Number(opponents.has(a))
    || b.baseScale - a.baseScale || b.entry.stars - a.entry.stars || a.entry.id.localeCompare(b.entry.id));
  for (const candidate of grouped) {
    if (!candidate.entry.groupId) continue;
    const box = bounds(candidate);
    candidate.entry.collisionHidden = !candidate.entry.collisionPinned
      && [...groupIndex.overlaps(box)].some((other) => other.entry.groupId === candidate.entry.groupId);
    if (!candidate.entry.collisionHidden) groupIndex.add(candidate, box);
  }
  const protectedMarker = (candidate) => opponents.has(candidate) || candidate.entry.collisionProtected || !!candidate.entry.collisionPinned;
  candidates.sort((a, b) => Number(protectedMarker(b)) - Number(protectedMarker(a))
    || Number(opponents.has(a)) - Number(opponents.has(b))
    || b.baseScale - a.baseScale || b.entry.stars - a.entry.stars || a.entry.id.localeCompare(b.entry.id));
  const index = createIndex();
  for (const candidate of candidates) {
    if (candidate.entry.collisionHidden) continue;
    let box = bounds(candidate);
    if (opponents.has(candidate) && index.overlaps(box).size) {
      // Shrinking cannot separate coincident positions. Use the nearest free gap,
      // preferring the side that keeps the badge inside the current viewport.
      const originalX = candidate.x;
      const placements = [-1, 1].map((direction) => {
        candidate.x = originalX;
        let shiftedBox = bounds(candidate);
        let overlaps = index.overlaps(shiftedBox);
        while (overlaps.size) {
          const offsets = [...overlaps].map((other) => {
            const otherBox = bounds(other);
            return direction < 0 ? otherBox.left - shiftedBox.right - 1 : otherBox.right - shiftedBox.left + 1;
          });
          candidate.x += direction < 0 ? Math.min(...offsets) : Math.max(...offsets);
          shiftedBox = bounds(candidate);
          overlaps = index.overlaps(shiftedBox);
        }
        return { x: candidate.x, overflow: Math.max(0, viewport.left - shiftedBox.left) + Math.max(0, shiftedBox.right - viewport.right) };
      });
      placements.sort((a, b) => a.overflow - b.overflow || Math.abs(a.x - originalX) - Math.abs(b.x - originalX));
      candidate.x = placements[0].x;
      candidate.entry.battleOffset = (candidate.entry.battleOffset ?? 0) + candidate.x - originalX;
      box = bounds(candidate);
    }
    candidate.entry.collisionHidden = !protectedMarker(candidate) && index.overlaps(box).size > 0;
    if (!candidate.entry.collisionHidden) index.add(candidate, box);
  }
}

export function declutterLabels(entries, projection, viewport, map, container) {
  const occupied = [];
  // Stable priority keeps the same representative until more screen space opens up.
  const ranked = [...entries].sort((a, b) => Number(b.labelPinned) - Number(a.labelPinned) || a.id.localeCompare(b.id));
  for (const entry of ranked) {
    let visible = entry.labelVisible;
    if (visible && projection && viewport && container && entry.labelElement) {
      if (!entry.labelDimensions) {
        const copy = entry.labelElement.cloneNode(true);
        container.append(copy);
        entry.labelDimensions = { width: copy.offsetWidth, height: copy.offsetHeight };
        copy.remove();
      }
      const point = nearestWorldPoint(projection.fromLatLngToDivPixel(entry.label.position), viewport);
      if (point) {
        const { width, height } = entry.labelDimensions;
        // Advanced markers anchor at the bottom center of their content.
        const box = { left: point.x - width / 2 - 4, right: point.x + width / 2 + 4,
          top: point.y - height - 4, bottom: point.y + 4 };
        visible = box.right >= viewport.left && box.left <= viewport.right
          && box.bottom >= viewport.top && box.top <= viewport.bottom;
        if (visible && !entry.labelPinned) visible = !occupied.some((other) =>
          box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top);
        if (visible) occupied.push(box);
      }
    }
    const target = visible ? map : null;
    if (entry.label.map !== target) entry.label.map = target;
  }
}

export function pathIntersectsViewport(source, destination, viewport, padding = 0) {
  // Clip the segment against a padded viewport, including off-screen endpoints.
  let first = 0;
  let last = 1;
  const dx = destination.x - source.x;
  const dy = destination.y - source.y;
  const edges = [
    [-dx, source.x - viewport.left + padding],
    [dx, viewport.right - source.x + padding],
    [-dy, source.y - viewport.top + padding],
    [dy, viewport.bottom - source.y + padding],
  ];
  for (const [direction, distance] of edges) {
    if (direction === 0) {
      if (distance < 0) return false;
    } else {
      const fraction = distance / direction;
      if (direction < 0) first = Math.max(first, fraction);
      else last = Math.min(last, fraction);
      if (first > last) return false;
    }
  }
  return true;
}
