export const DEFAULT_GROUP = { id: "group-1", name: "Group 1", color: "#3478d4" };
export const COMBAT_TYPES = ["firing", "demolish", "booming", "sword", "archer"];
export const DEFAULT_COMBAT_RANGES = { firing: 1, booming: 10, sword: 0.3, demolish: 0.5, archer: 0.8 };
export const DOMAINS = ["land", "naval", "air"];
const preset = (speed, health, damage, domain = "land", targets = ["land"]) => ({ speed, range: DEFAULT_COMBAT_RANGES.firing, health, damage, domain, targets, interval: 60, type: "firing" });
export const COMBAT_PRESETS = {
  infantry: preset(5, 100, 1), tank: preset(35, 1000, 100),
  "military-truck": preset(60, 150, 0, "land", []), artillery: preset(15, 300, 120, "land", ["land", "naval"]),
  warship: preset(40, 10000, 500, "naval", DOMAINS), submarine: preset(30, 5000, 400, "naval", ["naval"]),
  boat: preset(25, 500, 20, "naval", ["naval"]), aircraft: preset(500, 500, 100, "air", DOMAINS),
  helicopter: preset(200, 400, 80, "air", DOMAINS), fortress: preset(0, 10000, 200),
  support: preset(15, 150, 0, "land", []),
};
export function defaultCombat(feature) {
  const kind = feature.kind;
  const key = ["house", "castle", "outpost"].includes(kind) ? "fortress" : ["ammunition", "supplies", "radar"].includes(kind) ? "support" : kind;
  return structuredClone(COMBAT_PRESETS[key] ?? COMBAT_PRESETS.infantry);
}
export function normalizeCombat(value, feature) {
  const combat = value ?? defaultCombat(feature);
  if (!combat || !DOMAINS.includes(combat.domain) || !Array.isArray(combat.targets) || combat.targets.some((domain) => !DOMAINS.includes(domain))) throw new Error("Choose valid movement and target domains.");
  for (const [key, min, max] of [["speed", 0, 5000], ["range", 0, 2000], ["health", 1, 1e9], ["damage", 0, 1e9], ["interval", 1, 86400]]) {
    if (!Number.isFinite(combat[key]) || combat[key] < min || combat[key] > max) throw new Error(`Combat ${key} must be between ${min} and ${max}.`);
  }
  const type = combat.type ?? "firing";
  if (!COMBAT_TYPES.includes(type)) throw new Error("Choose a valid combat type.");
  return { ...combat, type, targets: [...new Set(combat.targets)] };
}
export function normalizeGroups(groups) {
  if (!Array.isArray(groups) || !groups.length || groups.length > 100) throw new Error("Use between 1 and 100 groups.");
  const ids = new Set();
  return groups.map((group) => {
    if (!group || typeof group.id !== "string" || !group.id || group.id.length > 100 || ids.has(group.id) || typeof group.name !== "string" || !group.name.trim() || group.name.trim().length > 80 || !/^#[0-9a-f]{6}$/i.test(group.color)) throw new Error("A group has an invalid name, color, or identifier.");
    ids.add(group.id);
    return { id: group.id, name: group.name.trim(), color: group.color };
  });
}
export function validateOwnership(project) {
  const ids = new Set(normalizeGroups(project.groups).map((group) => group.id));
  for (const feature of [...project.badges, ...project.units, ...project.lines, ...project.paintStrokes]) {
    if (!ids.has(feature.groupId)) throw new Error("A map object belongs to a missing group.");
  }
  for (const feature of [...project.badges, ...project.units]) {
    normalizeCombat(feature.combat, feature);
    const count = feature.kind ? feature.quantity : feature.troopCount;
    if (!Number.isSafeInteger(count) || count < 0 || feature.kind && count > 1e9) throw new Error("Enter a non-negative whole soldier count or an equipment quantity up to 1,000,000,000.");
  }
}
export const longitude = (lng) => ((lng + 180) % 360 + 360) % 360 - 180;
export function distance(a, b) {
  const r = Math.PI / 180, x = (b.lat - a.lat) * r, y = longitude(b.lng - a.lng) * r;
  return 6371008.8 * 2 * Math.asin(Math.min(1, Math.sqrt(Math.sin(x / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(y / 2) ** 2)));
}
export function interpolate(a, b, fraction) {
  const r = Math.PI / 180, d = distance(a, b) / 6371008.8;
  if (d < 1e-10) return { lat: a.lat, lng: a.lng };
  const x = Math.sin((1 - fraction) * d) / Math.sin(d), y = Math.sin(fraction * d) / Math.sin(d);
  const ax = Math.cos(a.lat * r) * Math.cos(a.lng * r), ay = Math.cos(a.lat * r) * Math.sin(a.lng * r);
  const bx = Math.cos(b.lat * r) * Math.cos(b.lng * r), by = Math.cos(b.lat * r) * Math.sin(b.lng * r);
  return { lat: Math.atan2(x * Math.sin(a.lat * r) + y * Math.sin(b.lat * r), Math.hypot(x * ax + y * bx, x * ay + y * by)) / r, lng: longitude(Math.atan2(x * ay + y * by, x * ax + y * bx) / r) };
}
const pathMetrics = new WeakMap();
function pathSegment(path, meters) {
  let lengths = pathMetrics.get(path);
  if (!lengths) {
    lengths = [0];
    for (let index = 1; index < path.length; index++) lengths.push(lengths[index - 1] + distance(path[index - 1], path[index]));
    pathMetrics.set(path, lengths);
  }
  let low = 1, high = path.length - 1;
  while (low < high) { const middle = (low + high) >> 1; if (lengths[middle] < meters) low = middle + 1; else high = middle; }
  return { index: low, before: lengths[low - 1] ?? 0, length: (lengths[low] ?? 0) - (lengths[low - 1] ?? 0), total: lengths.at(-1) };
}
export function positionOnPath(path, meters) {
  const { index, before, length, total } = pathSegment(path, meters);
  return meters >= total || path.length === 1 ? { ...path.at(-1) } : interpolate(path[index - 1], path[index], length ? Math.max(0, (meters - before) / length) : 1);
}
export function remainingPath(move, at) {
  const meters = Math.max(0, at - move.at) / 1000 * move.speed / 3.6;
  const { index, total } = pathSegment(move.path, meters);
  return meters >= total ? [move.path.at(-1)] : [positionOnPath(move.path, meters), ...move.path.slice(index)];
}
export function isVisible(force, at) {
  const from = force.visibility?.showAt ? Date.parse(`${force.visibility.showAt}Z`) : null;
  const until = force.visibility?.hideAt ? Date.parse(`${force.visibility.hideAt}Z`) : null;
  return (from == null || at >= from) && (until == null || at < until);
}
export function canAttack(source, target, at) {
  return source.id !== target.id && source.count > 0 && target.count > 0 && !source.invalidTerrain && !target.invalidTerrain && source.groupId !== target.groupId && source.combat.damage > 0 && source.combat.range > 0 && source.combat.targets.includes(target.combat.domain) && isVisible(source, at) && isVisible(target, at);
}
// Shared range selection for route playback, including paused and exported frames.
export function nearestEnemy(source, forces, at) {
  let target = null;
  let nearest = source.combat.range * 1000;
  for (const candidate of forces) {
    if (!canAttack(source, candidate, at)) continue;
    const meters = distance(source, candidate);
    if (meters < nearest || meters === nearest && (!target || candidate.id.localeCompare(target.id) < 0)) {
      target = candidate;
      nearest = meters;
    }
  }
  return target;
}

export function isDefeated(force) {
  return force.count === 0 && force.initialCount !== 0;
}
export function initialForces(snapshot) {
  return [...snapshot.badges.map((item) => ({ ...item, featureType: "badge", count: item.troopCount })), ...snapshot.units.map((item) => ({ ...item, featureType: "unit", count: item.quantity }))].map((item) => ({ ...item, initialCount: item.count, combat: normalizeCombat(item.combat, item), health: item.count * normalizeCombat(item.combat, item).health, order: null, move: null, lastShot: -Infinity }));
}
export function compactForce(force) {
  return Object.fromEntries(["id", "lat", "lng", "count", "health", "order", "move", "shot", "invalidTerrain"].map((key) => [key, force[key] ?? null]));
}
export function advanceForce(force, at) {
  if (force.move) Object.assign(force, positionOnPath(force.move.path, Math.max(0, at - force.move.at) / 1000 * force.move.speed / 3.6));
}
export function stepBattle(session) {
  session.at += 1000;
  const at = session.at, forces = session.forces;
  const byId = new Map(forces.map((force) => [force.id, force]));
  for (const force of forces) {
    if (isDefeated(force) || !isVisible(force, at)) continue;
    advanceForce(force, at);
    if (force.move && distance(force, force.move.path.at(-1)) < 0.05) {
      force.move = null;
      if (force.order?.type === "move") force.order = null;
      session.events.push({ type: "state", at, id: force.id, patch: { lat: force.lat, lng: force.lng, move: null, order: force.order } });
    }
  }
  const damage = new Map();
  for (const force of forces) {
    if (!force.count || force.invalidTerrain || !force.combat.damage || !force.combat.range || !isVisible(force, at)) continue;
    if (force.order?.type !== "attack" && at - force.lastShot < force.combat.interval * 1000) continue;
    const manual = force.order?.type === "attack" ? byId.get(force.order.targetId) : null;
    if (force.order?.type === "attack" && (!manual || !canAttack(force, manual, at))) {
      force.order = null; force.move = null;
      session.events.push({ type: "state", at, id: force.id, patch: { order: null, move: null, lat: force.lat, lng: force.lng } });
    }
    let target = null, nearest = force.combat.range * 1000;
    const candidates = manual && canAttack(force, manual, at) ? [manual] : forces;
    for (const candidate of candidates) {
      if (!canAttack(force, candidate, at)) continue;
      const meters = distance(force, candidate);
      if (meters < nearest || meters === nearest && (!target || candidate.id.localeCompare(target.id) < 0)) { target = candidate; nearest = meters; }
    }
    if (manual && target && force.move) {
      force.move = null;
      session.events.push({ type: "state", at, id: force.id, patch: { move: null, lat: force.lat, lng: force.lng } });
    }
    if (!target || at - force.lastShot < force.combat.interval * 1000) continue;
    force.lastShot = at; force.shot = { at, targetId: target.id };
    session.events.push({ type: "fire", at, id: force.id, targetId: target.id });
    damage.set(target.id, (damage.get(target.id) ?? 0) + force.count * force.combat.damage);
  }
  for (const force of forces) {
    if (!damage.has(force.id)) continue;
    force.health = Math.max(0, force.health - damage.get(force.id));
    force.count = Math.ceil(force.health / force.combat.health);
    if (!force.count) { force.order = null; force.move = null; }
    session.events.push({ type: "state", at, id: force.id, patch: compactForce(force) });
  }
  if ((at - session.startAt) % 60000 === 0) session.checkpoints.push({ at, eventIndex: session.events.length, forces: forces.map(compactForce) });
}
export function sampleBattle(replay, at) {
  at = Math.max(replay.startAt, Math.min(replay.endAt, at));
  const checkpoint = replay.checkpoints?.findLast((item) => item.at <= at);
  const forces = initialForces(replay.snapshot);
  const byId = new Map(forces.map((force) => [force.id, force]));
  for (const saved of checkpoint?.forces ?? []) Object.assign(byId.get(saved.id) ?? {}, saved);
  for (let index = checkpoint?.eventIndex ?? 0; index < replay.events.length; index++) {
    const event = replay.events[index];
    if (event.at > at) break;
    const force = byId.get(event.id);
    if (!force) continue;
    if (event.type === "fire") force.shot = { at: event.at, targetId: event.targetId };
    else Object.assign(force, event.patch);
  }
  for (const force of forces) { advanceForce(force, at); force.visible = isVisible(force, at); }
  return forces;
}
export function replayRange(replay) { return replay ? { start: replay.startAt, end: Math.max(replay.startAt + 1000, replay.endAt) } : null; }
export function hydrateSnapshot(replay, assets = {}) {
  const snapshot = structuredClone(replay.snapshot);
  for (const force of [...snapshot.badges, ...snapshot.units]) for (const key of ["flag", "symbolImage", "image"]) {
    if (force[key]?.startsWith("asset:")) force[key] = assets[force[key].slice(6)] ?? "";
  }
  return snapshot;
}
export function storeReplay(session, project, name) {
  const assets = { ...project.battleAssets }, lookup = new Map(Object.entries(assets).map(([id, value]) => [value, id]));
  const snapshot = structuredClone(session.snapshot);
  for (const force of [...snapshot.badges, ...snapshot.units]) for (const key of ["flag", "symbolImage", "image"]) {
    if (!force[key]) continue;
    let id = lookup.get(force[key]);
    if (!id) { id = crypto.randomUUID(); assets[id] = force[key]; lookup.set(force[key], id); }
    force[key] = `asset:${id}`;
  }
  const replay = { id: session.id, name: name.trim().slice(0, 80) || "Battle replay", startAt: session.startAt, endAt: session.at, snapshot, events: structuredClone(session.events), checkpoints: structuredClone(session.checkpoints) };
  return { ...project, battleAssets: assets, battles: [...project.battles.filter((item) => item.id !== replay.id), replay] };
}

export function validateBattles(project) {
  const assets = project.battleAssets;
  if (!assets || typeof assets !== "object" || Array.isArray(assets) || !Array.isArray(project.battles) || project.battles.length > 100) throw new Error("Invalid battle recordings.");
  for (const [id, image] of Object.entries(assets)) if (!id || id.length > 100 || typeof image !== "string" || image.length > 7000000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)) throw new Error("A replay image is invalid.");
  const ids = new Set();
  const point = (p) => p && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 && Number.isFinite(p.lng) && Math.abs(p.lng) <= 180;
  for (const replay of project.battles) {
    if (!replay || typeof replay.id !== "string" || !replay.id || replay.id.length > 100 || ids.has(replay.id) || typeof replay.name !== "string" || !replay.name.trim() || replay.name.length > 80 || !Number.isSafeInteger(replay.startAt) || !Number.isSafeInteger(replay.endAt) || replay.endAt < replay.startAt || Math.abs(replay.startAt) > 8640000000000000 || Math.abs(replay.endAt) > 8640000000000000 || !Array.isArray(replay.events) || replay.events.length > 200000 || !Array.isArray(replay.checkpoints) || replay.checkpoints.length > 4000) throw new Error("A battle replay is invalid or too large.");
    ids.add(replay.id);
    const snapshot = replay.snapshot;
    if (!snapshot || !Array.isArray(snapshot.badges) || snapshot.badges.length > 500 || !Array.isArray(snapshot.units) || snapshot.units.length > 500 || !Array.isArray(snapshot.lines) || snapshot.lines.length > 200 || !Array.isArray(snapshot.paintStrokes)) throw new Error("A battle starting map is invalid.");
    validateOwnership(snapshot);
    const features = new Map();
    for (const force of [...snapshot.badges, ...snapshot.units]) {
      if (!point(force) || typeof force.id !== "string" || features.has(force.id) || !Array.isArray(force.route)) throw new Error("A battle force is invalid.");
      features.set(force.id, force);
      for (const key of ["flag", "symbolImage", "image"]) if (force[key] && (!force[key].startsWith("asset:") || !Object.hasOwn(assets, force[key].slice(6)))) throw new Error("A battle image reference is missing.");
    }
    const validTime = (at) => Number.isSafeInteger(at) && at >= replay.startAt && at <= replay.endAt;
    const validState = (state) => {
      if (!state || typeof state !== "object" || Array.isArray(state) || Object.keys(state).some((key) => !["id", "lat", "lng", "count", "health", "order", "move", "shot", "invalidTerrain"].includes(key))) return false;
      if (state.id != null && !features.has(state.id)) return false;
      if (state.lat != null && (!Number.isFinite(state.lat) || Math.abs(state.lat) > 90) || state.lng != null && (!Number.isFinite(state.lng) || Math.abs(state.lng) > 180)) return false;
      if (state.count != null && (!Number.isSafeInteger(state.count) || state.count < 0) || state.health != null && (!Number.isFinite(state.health) || state.health < 0 || state.health > Number.MAX_SAFE_INTEGER * 1e9)) return false;
      if (state.invalidTerrain != null && typeof state.invalidTerrain !== "boolean") return false;
      if (state.shot != null && (!validTime(state.shot.at) || !features.has(state.shot.targetId))) return false;
      if (state.move != null && (!validTime(state.move.at) || !Number.isFinite(state.move.speed) || state.move.speed < 0 || state.move.speed > 5000 || !Array.isArray(state.move.path) || !state.move.path.length || state.move.path.length > 2000 || state.move.path.some((p) => !point(p)))) return false;
      if (state.order != null && (!["move", "attack"].includes(state.order.type) || state.order.type === "attack" && !features.has(state.order.targetId))) return false;
      return true;
    };
    let previous = replay.startAt;
    for (const event of replay.events) {
      if (!event || !validTime(event.at) || event.at < previous || !features.has(event.id) || !["fire", "state"].includes(event.type) || event.type === "fire" && !features.has(event.targetId) || event.type === "state" && (!validState(event.patch) || event.patch.id != null && event.patch.id !== event.id)) throw new Error("A recorded battle event is invalid.");
      previous = event.at;
    }
    previous = replay.startAt;
    for (const checkpoint of replay.checkpoints) {
      if (!checkpoint || !validTime(checkpoint.at) || checkpoint.at < previous || !Number.isInteger(checkpoint.eventIndex) || checkpoint.eventIndex < 0 || checkpoint.eventIndex > replay.events.length || !Array.isArray(checkpoint.forces) || checkpoint.forces.length !== features.size || new Set(checkpoint.forces.map((force) => force.id)).size !== features.size || checkpoint.forces.some((force) => !features.has(force.id) || !validState(force)) || checkpoint.eventIndex > 0 && replay.events[checkpoint.eventIndex - 1].at > checkpoint.at || checkpoint.eventIndex < replay.events.length && replay.events[checkpoint.eventIndex].at < checkpoint.at) throw new Error("A battle checkpoint is invalid.");
      previous = checkpoint.at;
    }
  }
}
