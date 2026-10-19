import { distance, interpolate, longitude } from "./combat.js";

const cancelled = new Set();
const cache = new Map();
let geometry;
function edgeIndex(shapes) {
  const rows = new Map(), cells = new Map();
  for (const shape of shapes) for (const polygon of shape.type === "Polygon" ? [shape.coordinates] : shape.coordinates) for (const ring of polygon) {
    for (let i = 1; i < ring.length; i++) {
      const [x1, y1] = ring[i - 1], [x2, y2] = ring[i];
      const edge = { x1, y1, x2, y2 };
      for (let y = Math.floor(Math.min(y1, y2)); y <= Math.floor(Math.max(y1, y2)); y++) {
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y).push(edge);
        for (let x = Math.floor(Math.min(x1, x2)); x <= Math.floor(Math.max(x1, x2)); x++) {
          const key = `${x},${y}`;
          if (!cells.has(key)) cells.set(key, []);
          cells.get(key).push(edge);
        }
      }
    }
  }
  return { rows, cells };
}
async function loadGeometry() {
  if (!geometry) geometry = Promise.all(["land", "lakes"].map(async (name) => {
    const response = await fetch(`/terrain/${name}.json.gz`);
    if (!response.ok) throw new Error("Terrain data could not be loaded. Movement remains paused.");
    // Vite serves .gz with Content-Encoding; production serves the compressed file.
    const json = response.headers.get("content-encoding")?.includes("gzip")
      ? await response.json()
      : await new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).json();
    return edgeIndex(json);
  })).catch((error) => { geometry = null; throw error; });
  return geometry;
}
function inside(point, index) {
  let result = false;
  for (const { x1, y1, x2, y2 } of index.rows.get(Math.floor(point.lat)) ?? []) {
    if ((y1 > point.lat) !== (y2 > point.lat) && point.lng < (x2 - x1) * (point.lat - y1) / (y2 - y1) + x1) result = !result;
  }
  return result;
}
function terrain(point, data) {
  const key = `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
  if (cache.has(key)) return cache.get(key);
  const value = inside(point, data[0]) && !inside(point, data[1]) ? "land" : "naval";
  if (cache.size > 150000) cache.clear();
  cache.set(key, value);
  return value;
}
// Natural Earth's shoreline is less detailed than the displayed map. Resolve
// coastal endpoints locally without relaxing terrain checks along the route.
function navigableEndpoint(point, domain, data) {
  if (domain === "air" || terrain(point, data) === domain) return point;
  const metersPerLng = Math.max(1000, 111195 * Math.cos(point.lat * Math.PI / 180));
  for (const radius of [100, 250, 500, 1000, 2000, 3000]) {
    for (let index = 0; index < 32; index++) {
      const angle = index * Math.PI / 16;
      const candidate = { lat: point.lat + Math.sin(angle) * radius / 111195, lng: longitude(point.lng + Math.cos(angle) * radius / metersPerLng) };
      if (Math.abs(candidate.lat) < 89.5 && terrain(candidate, data) === domain) return candidate;
    }
  }
  return null;
}
async function routeEndpoints(request, data) {
  const start = navigableEndpoint(request.start, request.domain, data);
  if (!start) throw new Error(`Starting position must be on ${request.domain === "naval" ? "water" : "land"}.`);
  const destination = request.range ? request.destination : navigableEndpoint(request.destination, request.domain, data);
  if (!destination) throw new Error(`Destination must be on ${request.domain === "naval" ? "water" : "land"}.`);
  const path = await route({ ...request, start, destination }, data);
  if (start !== request.start) path.unshift(request.start);
  if (!request.range && destination !== request.destination) path.push(request.destination);
  return path;
}
function orient(a, b, c) { return (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng); }
function intersects(a, b, edge) {
  const c = { lng: edge.x1, lat: edge.y1 }, d = { lng: edge.x2, lat: edge.y2 };
  if (Math.max(a.lng, b.lng) < Math.min(c.lng, d.lng) || Math.min(a.lng, b.lng) > Math.max(c.lng, d.lng) || Math.max(a.lat, b.lat) < Math.min(c.lat, d.lat) || Math.min(a.lat, b.lat) > Math.max(c.lat, d.lat)) return false;
  return orient(a, b, c) * orient(a, b, d) <= 0 && orient(c, d, a) * orient(c, d, b) <= 0;
}
function validSegment(a, b, domain, data) {
  if (domain === "air") return true;
  const steps = Math.max(1, Math.ceil(distance(a, b) / 10000));
  let previous = a;
  for (let i = 1; i <= steps; i++) {
    const point = interpolate(a, b, i / steps);
    if (terrain(point, data) !== domain) return false;
    // Split world wrapping before checking longitude-based boundary tiles.
    if (Math.abs(point.lng - previous.lng) > 180) {
      const near = { lat: (previous.lat + point.lat) / 2, lng: previous.lng > 0 ? 179.999999 : -179.999999 };
      const far = { ...near, lng: -near.lng };
      if (!validSegment(previous, near, domain, data) || !validSegment(far, point, domain, data)) return false;
    } else {
      const seen = new Set();
      for (let y = Math.floor(Math.min(previous.lat, point.lat)); y <= Math.floor(Math.max(previous.lat, point.lat)); y++) for (let x = Math.floor(Math.min(previous.lng, point.lng)); x <= Math.floor(Math.max(previous.lng, point.lng)); x++) {
        for (const index of data) for (const edge of index.cells.get(`${x},${y}`) ?? []) {
          if (seen.has(edge)) continue;
          seen.add(edge);
          if (intersects(previous, point, edge)) return false;
        }
      }
    }
    previous = point;
  }
  return true;
}
class Heap {
  values = [];
  push(value) {
    let index = this.values.length; this.values.push(value);
    while (index > 0) { const parent = (index - 1) >> 1; if (this.values[parent].f <= value.f) break; this.values[index] = this.values[parent]; index = parent; }
    this.values[index] = value;
  }
  pop() {
    const first = this.values[0], last = this.values.pop();
    if (this.values.length) {
      let index = 0;
      while (index * 2 + 1 < this.values.length) {
        let child = index * 2 + 1;
        if (child + 1 < this.values.length && this.values[child + 1].f < this.values[child].f) child++;
        if (this.values[child].f >= last.f) break;
        this.values[index] = this.values[child]; index = child;
      }
      this.values[index] = last;
    }
    return first;
  }
}
async function route(request, data) {
  const { start, domain, id, range = 0 } = request;
  let destination = request.destination;
  if (domain === "air") return [start, range ? interpolate(destination, start, Math.min(1, range / Math.max(1, distance(start, destination)))) : destination];
  if (terrain(start, data) !== domain) throw new Error(`No ${domain === "naval" ? "water" : "land"} route could be found from this starting position.`);
  if (!range && terrain(destination, data) !== domain) {
    if (request.formationCenter && terrain(request.formationCenter, data) === domain) destination = request.formationCenter;
    else throw new Error(`Destination must be on ${domain === "naval" ? "water" : "land"}.`);
  }
  const end = range ? interpolate(destination, start, Math.min(1, range * 0.95 / Math.max(1, distance(start, destination)))) : destination;
  if (distance(start, destination) <= range) return [start];
  if (terrain(end, data) === domain && validSegment(start, end, domain, data)) return [start, end];
  const length = distance(start, destination), scale = Math.max(0.02, Math.cos(start.lat * Math.PI / 180));
  for (const resolution of [Math.max(1000, Math.min(10000, length / 100)), 250]) {
    const latStep = resolution / 111195, lngStep = latStep / scale;
    const pointAt = (x, y) => ({ lat: start.lat + y * latStep, lng: longitude(start.lng + x * lngStep) });
    const goalX = longitude(destination.lng - start.lng) / lngStep, goalY = (destination.lat - start.lat) / latStep;
    const margin = Math.max(20, Math.min(200, Math.ceil(length * 0.5 / resolution)));
    const heap = new Heap(), nodes = new Map(), first = { x: 0, y: 0, g: 0, f: length, parent: null, point: start };
    nodes.set("0,0", first); heap.push(first);
    let iterations = 0;
    while (heap.values.length && iterations++ < 80000) {
      if (iterations % 1000 === 0) { await new Promise((resolve) => setTimeout(resolve, 0)); if (cancelled.has(id)) throw new Error("Cancelled"); }
      const current = heap.pop();
      if (current.closed || nodes.get(`${current.x},${current.y}`) !== current) continue;
      current.closed = true;
      const remaining = distance(current.point, destination);
      if ((range && remaining <= range * 0.98) || (!range && remaining <= resolution * 1.5 && validSegment(current.point, destination, domain, data))) {
        const path = range ? [] : [destination];
        for (let node = current; node; node = node.parent) path.unshift(node.point);
        const simplified = [path[0]];
        for (let index = 1; index < path.length;) {
          let last = Math.min(path.length - 1, index + 64);
          while (last > index && !validSegment(simplified.at(-1), path[last], domain, data)) last--;
          simplified.push(path[last]); index = last + 1;
        }
        return simplified;
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const x = current.x + dx, y = current.y + dy;
        if (x < Math.min(0, goalX) - margin || x > Math.max(0, goalX) + margin || y < Math.min(0, goalY) - margin || y > Math.max(0, goalY) + margin) continue;
        const key = `${x},${y}`, previous = nodes.get(key), point = pointAt(x, y);
        if (Math.abs(point.lat) >= 89.5 || previous?.closed) continue;
        const g = current.g + distance(current.point, point);
        if (previous && previous.g <= g || terrain(point, data) !== domain || !validSegment(current.point, point, domain, data)) continue;
        const node = { x, y, g, f: g + Math.max(0, distance(point, destination) - range), parent: current, point };
        nodes.set(key, node); heap.push(node);
      }
    }
  }
  throw new Error("No navigable route was found within the routing limit. Try a closer waypoint.");
}
self.onmessage = async ({ data: request }) => {
  if (request.type === "cancel") { cancelled.add(request.id); return; }
  try {
    const data = await loadGeometry();
    const result = request.type === "classify" ? request.points.map((point) => navigableEndpoint(point, point.combat.domain, data) ? point.combat.domain : terrain(point, data)) : await routeEndpoints(request, data);
    if (!cancelled.has(request.id)) self.postMessage({ id: request.id, result });
  } catch (error) { if (!cancelled.has(request.id)) self.postMessage({ id: request.id, error: error.message }); }
  finally { cancelled.delete(request.id); }
};
