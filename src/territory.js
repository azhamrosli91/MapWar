import { EARTH_RADIUS, sphericalInterpolate } from "./geodesy.js";
import { WORLD_CAMPAIGN_ID } from "./world-campaign.js";

export const TERRITORY_DEFAULTS = { enabled: false, mode: "routes", campaign: null, cellSizeMeters: 100, opacity: 0.3, showFrontline: true, showDebugGrid: false, origin: null };
export const BADGE_TERRITORY_DEFAULTS = { captureEnabled: false, captureRadiusMeters: 100, allowNonLandCapture: false };
export const CHUNK_SIZE = 64;
export const MAX_TERRITORY_CELLS = 500000;
export const MAX_TERRITORY_EVENTS = 2000000;
export const TERRITORY_LIMIT_MESSAGE = "Territory exceeds its processing limit. Choose larger cells, a smaller capture radius, or fewer enabled routes.";
export function normalizeTerritory(value, badge = false) {
  const defaults = badge ? BADGE_TERRITORY_DEFAULTS : TERRITORY_DEFAULTS;
  const input = value ?? defaults;
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid territory settings.");
  const output = {};
  for (const [key, fallback] of Object.entries(defaults)) {
    const v = input[key] === undefined ? fallback : input[key];
    if (typeof fallback === "boolean" && typeof v !== "boolean") throw new Error(`Invalid territory ${key}.`);
    output[key] = v;
  }
  const within = (key, min, max) => { if (typeof output[key] !== "number" || !Number.isFinite(output[key]) || output[key] < min || output[key] > max) throw new Error(`Territory ${key} must be between ${min} and ${max}.`); };
  if (badge) within("captureRadiusMeters", 1, 50000);
  else {
    if (!["routes", "campaign"].includes(output.mode)) throw new Error("Choose route corridors or historical land areas.");
    if (output.campaign !== null) {
      const c = output.campaign;
      if (!c || !["malaya-1941-42-v1", WORLD_CAMPAIGN_ID].includes(c.id) || typeof c.initialGroupId !== "string" || !c.initialGroupId || typeof c.captureGroupId !== "string" || !c.captureGroupId || c.initialGroupId === c.captureGroupId || (c.hideLegacyCapturePaint !== undefined && typeof c.hideLegacyCapturePaint !== "boolean")) throw new Error("Choose different initial and capturing groups for the historical campaign.");
      if (c.id === WORLD_CAMPAIGN_ID && (typeof c.japanGroupId !== "string" || !c.japanGroupId || [c.initialGroupId, c.captureGroupId].includes(c.japanGroupId))) throw new Error("Choose three different groups for the Allies, European Axis and Japan.");
      output.campaign = { id: c.id, initialGroupId: c.initialGroupId, captureGroupId: c.captureGroupId, ...(c.id === WORLD_CAMPAIGN_ID ? { japanGroupId: c.japanGroupId } : {}), hideLegacyCapturePaint: c.hideLegacyCapturePaint ?? false };
    }
    if (output.mode === "campaign" && !output.campaign) throw new Error("Choose the historical campaign and its groups.");
    within("cellSizeMeters", 25, 5000); within("opacity", 0, 1);
    const p = output.origin;
    if (p !== null && (!p || typeof p.lat !== "number" || typeof p.lng !== "number" || !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180)) throw new Error("Invalid territory projection origin.");
    output.origin = p ? { lat: p.lat, lng: p.lng } : null;
    if (output.enabled && output.mode === "routes" && !p) throw new Error("Choose a territory projection origin by enabling territory in the editor.");
  }
  return output;
}
export function validateTerritoryGroups(territory, groups) {
  if (territory?.mode !== "campaign") return;
  const c = territory.campaign;
  for (const id of [c.initialGroupId, c.captureGroupId, ...(c.id === WORLD_CAMPAIGN_ID ? [c.japanGroupId] : [])]) if (!groups.some((g) => g.id === id)) throw new Error("Historical territory refers to a missing group.");
}
export function territoryEligible(badge) {
  return !!badge.territory?.captureEnabled && (badge.combat?.domain === "land" || !badge.combat?.domain || badge.territory.allowNonLandCapture);
}
export function chooseTerritoryOrigin(badges, fallback) {
  const points = badges.filter(territoryEligible).flatMap((b) => b.route).sort((a, b) => a.lat - b.lat || a.lng - b.lng);
  if (!points.length) return { lat: fallback.lat, lng: fallback.lng };
  const sum = points.reduce((v, p) => {
    const lat = p.lat * Math.PI / 180, lng = p.lng * Math.PI / 180;
    return [v[0] + Math.cos(lat) * Math.cos(lng), v[1] + Math.cos(lat) * Math.sin(lng), v[2] + Math.sin(lat)];
  }, [0, 0, 0]);
  return { lat: Math.atan2(sum[2], Math.hypot(sum[0], sum[1])) * 180 / Math.PI, lng: Math.atan2(sum[1], sum[0]) * 180 / Math.PI };
}
export function createTerritoryProjection(origin) {
  const r = Math.PI / 180, lat0 = origin.lat * r, lng0 = origin.lng * r;
  const s0 = Math.sin(lat0), c0 = Math.cos(lat0);
  return {
    project(p) {
      const lat = p.lat * r, dl = p.lng * r - lng0;
      const c = Math.acos(Math.max(-1, Math.min(1, s0 * Math.sin(lat) + c0 * Math.cos(lat) * Math.cos(dl))));
      const k = c < 1e-10 ? 1 : c / Math.sin(c);
      return { x: EARTH_RADIUS * k * Math.cos(lat) * Math.sin(dl), y: EARTH_RADIUS * k * (c0 * Math.sin(lat) - s0 * Math.cos(lat) * Math.cos(dl)) };
    },
    unproject(x, y) {
      const rho = Math.hypot(x, y), c = rho / EARTH_RADIUS;
      if (rho < 1e-8) return { ...origin };
      const lat = Math.asin(Math.max(-1, Math.min(1, Math.cos(c) * s0 + y * Math.sin(c) * c0 / rho)));
      const lng = lng0 + Math.atan2(x * Math.sin(c), rho * c0 * Math.cos(c) - y * s0 * Math.sin(c));
      return { lat: lat / r, lng: ((lng / r + 180) % 360 + 360) % 360 - 180 };
    },
  };
}
export const cellKey = (x, y) => `${x},${y}`;
export const chunkKey = (x, y) => `${Math.floor(x / CHUNK_SIZE)},${Math.floor(y / CHUNK_SIZE)}`;
export const lexical = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export function projectedRoutePoint(projection, a, b, fraction) {
  return projection.project(sphericalInterpolate(a, b, fraction));
}
