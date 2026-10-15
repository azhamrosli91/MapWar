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
  return { x: point.x, y: point.y - height / 2, width, height };
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
  // Try progressively smaller sizes before deciding which markers to hide.
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
    for (const candidate of crowded) candidate.entry.displayScale = candidate.baseScale * factor;
  }
  candidates.sort((a, b) => Number(b.entry.collisionProtected) - Number(a.entry.collisionProtected)
    || b.baseScale - a.baseScale || b.entry.stars - a.entry.stars || a.entry.id.localeCompare(b.entry.id));
  const index = createIndex();
  for (const candidate of candidates) {
    const box = bounds(candidate);
    candidate.entry.collisionHidden = !candidate.entry.collisionProtected && index.overlaps(box).size > 0;
    if (!candidate.entry.collisionHidden) index.add(candidate, box);
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
