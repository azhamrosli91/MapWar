export const BADGE_SIZES = { S: 0.5, M: 1, L: 1.25, XL: 1.5 };
export const ROUTE_EFFECTS = ["none", "firing", "booming", "demolish", "kills", "crack"];
export const MAX_STOPS = 200;
export const MAX_LINES = 200;
export const MAX_LINE_POINTS = 2000;

// A scenario clock uses UTC arithmetic without interpreting the user's local timezone.
export function scenarioTime(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || value.startsWith("0000")) return null;
  const time = Date.parse(`${value}:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 16) === value ? time : null;
}

export function nextHour(value) {
  const time = scenarioTime(value);
  if (time === null) return "";
  const next = new Date(time + 3600000).toISOString();
  return next.length === 24 ? next.slice(0, 16) : "";
}

export function createRouteStop(route, position = {}) {
  return {
    ...structuredClone(route.at(-1)),
    ...position,
    id: crypto.randomUUID(),
    dateTime: nextHour(route.at(-1).dateTime),
  };
}

export function stopLabel(index) {
  let label = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    label = String.fromCharCode(65 + (n - 1) % 26) + label;
  }
  return label;
}

export function routeError(route) {
  if (!Array.isArray(route) || route.length > MAX_STOPS) return `Use at most ${MAX_STOPS} route stops.`;
  let previous = -Infinity;
  const ids = new Set();
  for (const [index, stop] of route.entries()) {
    if (!stop || typeof stop.id !== "string" || !stop.id || stop.id.length > 100 || ids.has(stop.id)) return "Each route stop needs a unique identifier.";
    ids.add(stop.id);
    if (stop.lat === "" || stop.lng === "" || stop.lat == null || stop.lng == null || !Number.isFinite(Number(stop.lat)) || !Number.isFinite(Number(stop.lng)) || Math.abs(Number(stop.lat)) > 90 || Math.abs(Number(stop.lng)) > 180) return `Enter valid coordinates for stop ${stopLabel(index)}.`;
    if (stop.troopCount != null && (!Number.isSafeInteger(stop.troopCount) || stop.troopCount < 0)) return `Enter a non-negative whole troop number for stop ${stopLabel(index)}.`;
    if (!Object.hasOwn(BADGE_SIZES, stop.size)) return `Choose a size for stop ${stopLabel(index)}.`;
    if (stop.effect != null && !ROUTE_EFFECTS.includes(stop.effect)) return `Choose an effect for stop ${stopLabel(index)}.`;
    if (stop.firingTargetId != null && (typeof stop.firingTargetId !== "string" || stop.firingTargetId.length > 100)) return `Choose a valid firing target for stop ${stopLabel(index)}.`;
    if (stop.targetLocation != null && (!stop.targetLocation || typeof stop.targetLocation !== "object" || stop.targetLocation.lat === "" || stop.targetLocation.lng === "" || stop.targetLocation.lat == null || stop.targetLocation.lng == null || !Number.isFinite(Number(stop.targetLocation.lat)) || !Number.isFinite(Number(stop.targetLocation.lng)) || Math.abs(Number(stop.targetLocation.lat)) > 90 || Math.abs(Number(stop.targetLocation.lng)) > 180)) return `Enter valid target coordinates for stop ${stopLabel(index)}.`;
    const time = scenarioTime(stop.dateTime);
    if (time === null) return `Enter a valid date and time for stop ${stopLabel(index)}.`;
    if (time <= previous) return `Stop ${stopLabel(index)} must be later than the previous stop.`;
    previous = time;
  }
  return "";
}

export function visibilityError(visibility) {
  if (!visibility || typeof visibility !== "object" || typeof visibility.showAt !== "string" || typeof visibility.hideAt !== "string") return "Visibility dates are invalid.";
  const show = visibility.showAt ? scenarioTime(visibility.showAt) : null;
  const hide = visibility.hideAt ? scenarioTime(visibility.hideAt) : null;
  if (visibility.showAt && show === null) return "Enter a valid Show from date and time.";
  if (visibility.hideAt && hide === null) return "Enter a valid Hide at date and time.";
  if (show !== null && hide !== null && show >= hide) return "Hide at must be later than Show from.";
  return "";
}

export function timelineRange(badges) {
  let start = Infinity;
  let end = -Infinity;
  let events = 0;
  for (const badge of badges) {
    if (Array.isArray(badge.route) && badge.route.length >= 1 && !routeError(badge.route)) {
      const firstTime = scenarioTime(badge.route[0].dateTime);
      const lastTime = scenarioTime(badge.route.at(-1).dateTime);
      start = Math.min(start, firstTime);
      end = Math.max(end, lastTime + (badge.route.length === 1 || badge.route.at(-1).effect && badge.route.at(-1).effect !== "none" ? 60000 : 0));
      events += 2;
    }
    if (badge.visibility && !visibilityError(badge.visibility)) {
      for (const dateTime of [badge.visibility.showAt, badge.visibility.hideAt]) {
        if (!dateTime) continue;
        const time = scenarioTime(dateTime);
        start = Math.min(start, time - 60000);
        end = Math.max(end, time + 60000);
        events++;
      }
    }
  }
  if (!events) return null;
  return { start, end };
}

export function compileRoute(route, troopCount = 0) {
  return route.map((stop) => ({ ...stop, troopCount: stop.troopCount ?? troopCount, time: scenarioTime(stop.dateTime), scale: BADGE_SIZES[stop.size] }));
}

export function sampleRoute(stops, time, interpolate) {
  if (!stops.length) return null;
  if (time <= stops[0].time) return { position: stops[0], troopCount: stops[0].troopCount, scale: stops[0].scale, effect: time < stops[0].time ? "none" : stops[0].effect ?? "none", effectStart: stops[0].time, firingTargetId: stops[0].firingTargetId, targetLocation: stops[0].targetLocation };
  const last = stops.at(-1);
  if (time >= last.time) return { position: last, troopCount: last.troopCount, scale: last.scale, effect: last.effect ?? "none", effectStart: last.time, firingTargetId: last.firingTargetId, targetLocation: last.targetLocation };
  const index = stops.findIndex((stop) => stop.time > time);
  const a = stops[index - 1];
  const b = stops[index];
  const fraction = (time - a.time) / (b.time - a.time);
  return {
    position: interpolate({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }, fraction),
    troopCount: Math.round(a.troopCount + (b.troopCount - a.troopCount) * fraction),
    scale: a.scale + (b.scale - a.scale) * fraction,
    effect: a.effect ?? "none",
    effectStart: a.time,
    firingTargetId: a.firingTargetId,
    targetLocation: a.targetLocation,
    moving: time > a.time && time < b.time,
  };
}

export function formatScenarioTime(time) {
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" }).format(time);
  return `${date}, ${formatScenarioClock(time)}`;
}

export function formatScenarioClock(time) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hourCycle: "h12" }).format(time);
}

export function isScenarioNight(time) {
  if (!Number.isFinite(time)) return false;
  const hour = new Date(time).getUTCHours();
  return hour >= 18 || hour < 6;
}

export function scenarioNightShade(time) {
  if (!Number.isFinite(time)) return 0;
  const date = new Date(time);
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600 + date.getUTCMilliseconds() / 3600000;
  if (hour < 5 || hour >= 19) return 0.48;
  if (hour >= 7 && hour < 17) return 0;
  const progress = hour < 7 ? (7 - hour) / 2 : (hour - 17) / 2;
  return 0.48 * (1 - Math.cos(Math.PI * progress)) / 2;
}
