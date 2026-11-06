import { compileRoute } from "./timeline.js";
import { CHUNK_SIZE, MAX_TERRITORY_CELLS, MAX_TERRITORY_EVENTS, TERRITORY_LIMIT_MESSAGE, cellKey, chunkKey, createTerritoryProjection, lexical, projectedRoutePoint, territoryEligible } from "./territory.js";

const pause = () => new Promise((resolve) => setTimeout(resolve, 0));
const cellDistance = (p, x, y, size) => Math.hypot(Math.max(x * size - p.x, 0, p.x - (x + 1) * size), Math.max(y * size - p.y, 0, p.y - (y + 1) * size));
const compareEvents = (a, b) => a.at - b.at || lexical(a.badgeId, b.badgeId) || a.segment - b.segment || lexical(a.cell, b.cell);

// Return the interval in which a linear piece intersects a rounded cell rectangle.
function interval(pointAt, x, y, size, radius, lo, hi) {
  const distance = (t) => cellDistance(pointAt(t), x, y, size);
  let left = lo, right = hi;
  for (let i = 0; i < 35; i++) {
    const a = (2 * left + right) / 3, b = (left + 2 * right) / 3;
    if (distance(a) < distance(b)) right = b; else left = a;
  }
  const middle = (left + right) / 2;
  if (distance(middle) > radius + 1e-7) return null;
  const root = (a, b, entering) => {
    for (let i = 0; i < 48; i++) {
      const m = (a + b) / 2;
      if ((distance(m) <= radius) === entering) b = m; else a = m;
    }
    return (a + b) / 2;
  };
  return [distance(lo) <= radius ? lo : root(lo, middle, true), distance(hi) <= radius ? hi : root(middle, hi, false)];
}

export async function compileBadgeTerritory(badge, config, check = () => {}) {
  const projection = createTerritoryProjection(config.origin), size = config.cellSizeMeters;
  const radius = badge.territory.captureRadiusMeters;
  const route = compileRoute(badge.route);
  const visits = new Map();
  let operations = 0, visitCount = 0;
  const validate = (p) => {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.hypot(p.x, p.y) + radius > 3000000) throw new Error("Territory coverage must stay within 3,000 km of its fixed projection origin. Use a regional scenario or reset the origin with territory disabled.");
  };
  const add = (x, y, enter, exit, segment) => {
    const id = cellKey(x, y);
    let list = visits.get(id);
    if (!list) {
      if (visits.size >= MAX_TERRITORY_CELLS) throw new Error(TERRITORY_LIMIT_MESSAGE);
      visits.set(id, list = []);
    }
    const last = list.at(-1);
    if (last && enter <= last.exit + 0.01) last.exit = Math.max(last.exit, exit);
    else {
      if (++visitCount > MAX_TERRITORY_EVENTS) throw new Error(TERRITORY_LIMIT_MESSAGE);
      list.push({ enter, exit, segment });
    }
  };
  const enumerate = async (a, b, from, until, segment, t0, t1) => {
    const at = (f) => projectedRoutePoint(projection, a, b, f);
    const p = at(t0), q = at(t1), mid = at((t0 + t1) / 2);
    validate(p); validate(q); validate(mid);
    const deviation = Math.hypot(mid.x - (p.x + q.x) / 2, mid.y - (p.y + q.y) / 2);
    if (deviation > 0.25 || Math.hypot(q.x - p.x, q.y - p.y) > size * 4) {
      const m = (t0 + t1) / 2;
      await enumerate(a, b, from, until, segment, t0, m);
      await enumerate(a, b, from, until, segment, m, t1);
      return;
    }
    // Small conservative padding includes curved pieces; roots use the actual shared path.
    const minX = Math.floor((Math.min(p.x, q.x) - radius - 1) / size), maxX = Math.floor((Math.max(p.x, q.x) + radius + 1) / size);
    const minY = Math.floor((Math.min(p.y, q.y) - radius - 1) / size), maxY = Math.floor((Math.max(p.y, q.y) + radius + 1) / size);
    if ((maxX - minX + 1) * (maxY - minY + 1) > MAX_TERRITORY_CELLS * 4) throw new Error(TERRITORY_LIMIT_MESSAGE);
    for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
      if (++operations % 1024 === 0) { await pause(); check(); }
      const hit = interval(at, x, y, size, radius, t0, t1);
      if (hit) add(x, y, from + (until - from) * hit[0], from + (until - from) * hit[1], segment);
    }
  };
  if (!route.length) return [];
  await enumerate(route[0], route[0], route[0].time, route[0].time, 0, 0, 1);
  for (let i = 1; i < route.length; i++) {
    check();
    const a = route[i - 1], b = route[i];
    await enumerate(a, b, a.time, b.time, i, 0, 1);
  }
  const events = [];
  for (const [cell, entries] of visits) {
    const [x, y] = cell.split(",").map(Number);
    for (const entry of entries) events.push({ cell, x, y, at: Math.ceil(entry.enter), segment: entry.segment, badgeId: badge.id, owner: badge.groupId });
  }
  return events;
}

// Edges are chunk-local paths. Degree-four junctions deliberately stay split.
function mergeEdges(edges) {
  const byPair = new Map();
  for (const edge of edges) {
    const key = JSON.stringify([edge.a, edge.b].sort(lexical));
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key).push(edge);
  }
  const result = [];
  for (const list of byPair.values()) {
    const adjacent = new Map(), used = new Set();
    for (const [i, e] of list.entries()) for (const p of [e.p, e.q]) {
      const key = p.join(",");
      if (!adjacent.has(key)) adjacent.set(key, []);
      adjacent.get(key).push(i);
    }
    const trace = (index, start) => {
      const first = list[index], path = [start];
      let point = start;
      while (!used.has(index)) {
        used.add(index);
        const e = list[index];
        point = e.p[0] === point[0] && e.p[1] === point[1] ? e.q : e.p;
        path.push(point);
        const next = adjacent.get(point.join(","));
        if (next.length !== 2) break;
        index = next.find((i) => !used.has(i));
        if (index === undefined) break;
      }
      result.push({ a: first.a, b: first.b, path });
    };
    for (const [point, indices] of adjacent) if (indices.length !== 2) for (const i of indices) if (!used.has(i)) trace(i, point.split(",").map(Number));
    for (let i = 0; i < list.length; i++) if (!used.has(i)) trace(i, list[i].p);
  }
  return result;
}

export class TerritoryEngine {
  constructor() {
    this.cache = new Map(); this.events = []; this.chunks = new Map(); this.snapshots = [];
    this.index = 0; this.mutable = new Set(); this.snapshotBytes = 0; this.signature = "";
  }
  async configure(config, badges, check = () => {}) {
    const grid = JSON.stringify([config.origin, config.cellSizeMeters]);
    if (grid !== this.grid) this.cache.clear();
    this.grid = grid; this.config = config;
    const next = new Map();
    let total = 0;
    for (const badge of badges.filter(territoryEligible)) {
      check();
      const key = JSON.stringify([badge.route.map(({ lat, lng, dateTime }) => [lat, lng, dateTime]), badge.groupId, badge.territory, badge.combat?.domain]);
      const previous = this.cache.get(badge.id);
      const events = previous?.key === key ? previous.events : await compileBadgeTerritory(badge, config, check);
      total += events.length;
      if (total > MAX_TERRITORY_EVENTS) throw new Error(TERRITORY_LIMIT_MESSAGE);
      next.set(badge.id, { key, events });
    }
    check();
    const signature = JSON.stringify([...next].map(([id, item]) => [id, item.key]).sort((a, b) => lexical(a[0], b[0])));
    if (signature === this.signature && grid === this.previousGrid) return;
    const events = [...next.values()].flatMap((item) => item.events).sort(compareEvents);
    if (new Set(events.map((e) => e.cell)).size > MAX_TERRITORY_CELLS) throw new Error(TERRITORY_LIMIT_MESSAGE);
    let earliest = 0;
    while (earliest < this.events.length && earliest < events.length && compareEvents(this.events[earliest], events[earliest]) === 0 && this.events[earliest].owner === events[earliest].owner) earliest++;
    this.snapshots = grid === this.previousGrid ? this.snapshots.filter((s) => s.index <= earliest) : [];
    this.snapshotBytes = this.snapshots.reduce((n, s) => n + s.bytes, 0);
    this.events = events; this.cache = next; this.signature = signature; this.previousGrid = grid;
    this.chunks = new Map(); this.mutable.clear(); this.index = 0;
  }
  owner(x, y) { return this.chunks.get(chunkKey(x, y))?.get(cellKey(x, y)) ?? null; }
  async seek(time, check = () => {}, reset = false) {
    let target = 0, hi = this.events.length;
    while (target < hi) { const m = (target + hi) >>> 1; if (this.events[m].at <= time) target = m + 1; else hi = m; }
    if (target < this.index || reset) {
      const snap = this.snapshots.findLast((s) => s.index <= target);
      this.chunks = new Map(snap?.chunks ?? []); this.index = snap?.index ?? 0;
      this.mutable.clear(); reset = true;
    }
    const dirty = new Set(reset ? this.chunks.keys() : []);
    for (; this.index < target; this.index++) {
      if (this.index % 10000 === 0) { await pause(); check(); }
      const e = this.events[this.index];
      if (this.owner(e.x, e.y) !== e.owner) {
        const key = chunkKey(e.x, e.y);
        if (!this.mutable.has(key)) { this.chunks.set(key, new Map(this.chunks.get(key))); this.mutable.add(key); }
        this.chunks.get(key).set(e.cell, e.owner);
        for (const [x, y] of [[e.x, e.y], [e.x - 1, e.y], [e.x + 1, e.y], [e.x, e.y - 1], [e.x, e.y + 1]]) dirty.add(chunkKey(x, y));
      }
      if ((this.index + 1) % 10000 === 0 && !this.snapshots.some((s) => s.index === this.index + 1)) {
        const bytes = [...this.chunks.values()].reduce((n, c) => n + c.size * 64 + 128, 0);
        if (bytes <= 32 * 1024 * 1024) {
          while (this.snapshotBytes + bytes > 32 * 1024 * 1024 && this.snapshots.length) this.snapshotBytes -= this.snapshots.shift().bytes;
          this.snapshots.push({ index: this.index + 1, chunks: new Map(this.chunks), bytes }); this.snapshotBytes += bytes;
          this.snapshots.sort((a, b) => a.index - b.index); this.mutable.clear();
        }
      }
    }
    check();
    return { reset, chunks: [...dirty].map((key) => this.geometry(key)), index: this.index };
  }
  geometry(key) {
    const cells = [], edges = [];
    for (const [id, owner] of this.chunks.get(key) ?? []) {
      const [x, y] = id.split(",").map(Number);
      cells.push([x, y, owner]);
      for (const [nx, ny, p, q] of [[x + 1, y, [x + 1, y], [x + 1, y + 1]], [x, y + 1, [x, y + 1], [x + 1, y + 1]]]) {
        const other = this.owner(nx, ny);
        if (other && other !== owner) edges.push({ a: owner, b: other, p, q });
      }
    }
    return { key, cells, paths: mergeEdges(edges), size: CHUNK_SIZE };
  }
}
