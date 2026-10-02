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
