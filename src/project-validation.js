import { BADGE_SYMBOLS, UNIT_KINDS } from "./symbols.js";
import { BADGE_SIZES, MAX_LINES, MAX_LINE_POINTS, routeError, visibilityError } from "./timeline.js";
import { validatePaintStrokes } from "./paint.js";
import { DEFAULT_GROUP, normalizeGroups, normalizeCombat, validateOwnership, validateBattles, hydrateSnapshot } from "./combat.js";
import { MAX_BADGES } from "./combat.js";
export { MAX_BADGES } from "./combat.js";

const DEFAULT_BADGE_SYMBOL = "helmet";
const isBadgeSymbol = (value) => BADGE_SYMBOLS.some((symbol) => symbol.value === value);

export const DEFAULT_VIEW = {
  center: { lat: 20, lng: 0 },
  zoom: 2,
  mapTypeId: "roadmap",
  heading: 0,
};
export const EMPTY_PROJECT = { version: 7, view: DEFAULT_VIEW, groups: [DEFAULT_GROUP], badges: [], units: [], lines: [], paintStrokes: [], playbackDuration: 30, battles: [], battleAssets: {} };
export const MAX_UNITS = 500;
const MAX_PROJECT_BYTES = 24 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const imagePattern =
  /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export function checkProjectSize(project) {
  if (new Blob([JSON.stringify(project)]).size > MAX_PROJECT_BYTES) {
    throw new Error(
      "This map is larger than 24 MB. Use smaller images or remove a feature so the map can be backed up and restored.",
    );
  }
  return project;
}

export function coordinates(lat, lng) {
  if (lat === "" || lng === "" || lat == null || lng == null) return null;
  const position = { lat: Number(lat), lng: Number(lng) };
  return Number.isFinite(position.lat) &&
    Number.isFinite(position.lng) &&
    Math.abs(position.lat) <= 90 &&
    Math.abs(position.lng) <= 180
    ? position
    : null;
}


export function validateImageData(source) {
  if (typeof source !== "string" || source.length > MAX_IMAGE_BYTES * 1.4 || !imagePattern.test(source)) {
    throw new Error("Flag images must be PNG, JPEG, or WebP and no larger than 5 MB.");
  }
  return source;
}

export async function validateProject(input, normalizeImage = validateImageData) {
  if (
    !input ||
    ![1, 2, 3, 4, 5, 6, 7].includes(input.version) ||
    !Array.isArray(input.badges) ||
    input.badges.length > MAX_BADGES
  ) {
    throw new Error(
      `Choose a Malaya World War II version 1–7 file with at most ${MAX_BADGES} badges.`,
    );
  }
  const groups = normalizeGroups(input.version < 7 ? [DEFAULT_GROUP] : input.groups);
  const groupId = (feature) => input.version < 7 ? groups[0].id : feature.groupId;
  const view = input.view;
  if (
    !view ||
    typeof view.center?.lat !== "number" ||
    typeof view.center?.lng !== "number" ||
    !coordinates(view.center.lat, view.center.lng) ||
    !Number.isFinite(view.zoom) ||
    view.zoom < 0 ||
    view.zoom > 22 ||
    !["roadmap", "satellite", "hybrid", "terrain"].includes(view.mapTypeId) ||
    (view.heading !== undefined && (!Number.isFinite(view.heading) || view.heading < 0 || view.heading >= 360))
  ) {
    throw new Error("The saved map settings are invalid.");
  }
  const ids = new Set();
  const badges = [];
  for (const badge of input.badges) {
    const symbol = isBadgeSymbol(badge?.symbol)
      ? badge.symbol
      : input.version === 1 && typeof badge?.showHelmet === "boolean"
        ? badge.showHelmet
          ? DEFAULT_BADGE_SYMBOL
          : "none"
        : null;
    if (
      !badge ||
      typeof badge.id !== "string" ||
      !badge.id ||
      badge.id.length > 100 ||
      ids.has(badge.id) ||
      typeof badge.label !== "string" ||
      !badge.label.trim() ||
      badge.label.trim().length > 80 ||
      typeof badge.lat !== "number" ||
      typeof badge.lng !== "number" ||
      !coordinates(badge.lat, badge.lng) ||
      !symbol
    ) {
      throw new Error(
        "A badge has an invalid label, position, or identifier. The current map has not been replaced.",
      );
    }
    ids.add(badge.id);
    const size = input.version < 3 ? "M" : badge.size;
    const route = input.version < 3 ? [] : badge.route;
    const showTrail = input.version < 3 ? false : badge.showTrail;
    if (!Object.hasOwn(BADGE_SIZES, size) || typeof showTrail !== "boolean") throw new Error("A badge has an invalid size or trail setting.");
    const routeProblem = routeError(route);
    if (routeProblem) throw new Error(routeProblem);
    if (route.some((stop) => typeof stop.lat !== "number" || typeof stop.lng !== "number")) throw new Error("Route coordinates must be numbers.");
    const normalizedRoute = route.map(({ id, lat, lng, dateTime, size, effect, firingTargetId, targetLocation, troopCount }) => ({ id, lat, lng, dateTime, size, troopCount: troopCount ?? badge.troopCount ?? 0, effect: effect ?? "none", firingTargetId: firingTargetId || undefined, targetLocation: targetLocation ? { lat: Number(targetLocation.lat), lng: Number(targetLocation.lng) } : undefined }));
    const troopCount = badge.troopCount ?? 0;
    if (!Number.isSafeInteger(troopCount) || troopCount < 0) throw new Error("A badge has an invalid troop number.");
    const stars = input.version < 4 ? 0 : badge.stars;
    if (!Number.isInteger(stars) || stars < 0 || stars > 5) throw new Error("A badge has an invalid star count.");
    const symbolImage = input.version < 4 || !badge.symbolImage ? "" : await normalizeImage(badge.symbolImage);
    if (symbol === "custom" && !symbolImage) throw new Error("A custom badge symbol needs an image.");
    const visibility = input.version < 5 ? { showAt: "", hideAt: "" } : badge.visibility;
    const visibilityProblem = visibilityError(visibility);
    if (visibilityProblem) throw new Error(visibilityProblem);
    badges.push({
      groupId: groupId(badge),
      combat: normalizeCombat(badge.combat, badge),
      id: badge.id,
      label: badge.label.trim(),
      lat: normalizedRoute[0]?.lat ?? badge.lat,
      lng: normalizedRoute[0]?.lng ?? badge.lng,
      flag: await normalizeImage(badge.flag),
      symbol,
      symbolImage,
      stars,
      troopCount: normalizedRoute[0]?.troopCount ?? troopCount,
      size: normalizedRoute[0]?.size ?? size,
      route: normalizedRoute,
      showTrail,
      visibility: { showAt: visibility.showAt, hideAt: visibility.hideAt },
    });
  }
  const lines = input.version < 3 ? [] : input.lines;
  if (!Array.isArray(lines) || lines.length > MAX_LINES) throw new Error(`Use at most ${MAX_LINES} lines.`);
  const lineIds = new Set();
  const normalizedLines = lines.map((line) => {
    const normalized = normalizeLine(line);
    if (lineIds.has(normalized.id)) throw new Error("Line identifiers must be unique.");
    lineIds.add(normalized.id);
    return { ...normalized, groupId: groupId(line) };
  });
  const playbackDuration = input.version < 3 ? 30 : input.playbackDuration;
  if (!Number.isFinite(playbackDuration) || playbackDuration < 5 || playbackDuration > 600) throw new Error("Playback length must be between 5 and 600 seconds.");
  const inputUnits = input.version < 4 ? [] : input.units;
  if (!Array.isArray(inputUnits) || inputUnits.length > MAX_UNITS) throw new Error(`Use at most ${MAX_UNITS} equipment items.`);
  const units = [];
  for (const unit of inputUnits) {
    if (!unit || typeof unit.id !== "string" || !unit.id || unit.id.length > 100 || ids.has(unit.id) || typeof unit.name !== "string" || !unit.name.trim() || unit.name.trim().length > 80 || !UNIT_KINDS.includes(unit.kind) || !coordinates(unit.lat, unit.lng) || typeof unit.lat !== "number" || typeof unit.lng !== "number" || !Object.hasOwn(BADGE_SIZES, unit.size) || typeof unit.showTrail !== "boolean") throw new Error("An equipment item has an invalid name, kind, or position.");
    ids.add(unit.id);
    const problem = routeError(unit.route);
    if (problem) throw new Error(problem);
    if (unit.route.some((stop) => typeof stop.lat !== "number" || typeof stop.lng !== "number")) throw new Error("Route coordinates must be numbers.");
    const route = unit.route.map(({ id, lat, lng, dateTime, size, effect, firingTargetId, targetLocation, troopCount }) => ({ id, lat, lng, dateTime, size, troopCount, effect: effect ?? "none", firingTargetId: firingTargetId || undefined, targetLocation: targetLocation ? { lat: Number(targetLocation.lat), lng: Number(targetLocation.lng) } : undefined }));
    const image = unit.image ? await normalizeImage(unit.image) : "";
    const color = unit.color ?? "#ffffff";
    if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error("An equipment item has an invalid color.");
    const visibility = input.version < 5 ? { showAt: "", hideAt: "" } : unit.visibility;
    const visibilityProblem = visibilityError(visibility);
    if (visibilityProblem) throw new Error(visibilityProblem);
    units.push({ id: unit.id, name: unit.name.trim(), kind: unit.kind, image, color, lat: route[0]?.lat ?? unit.lat, lng: route[0]?.lng ?? unit.lng, size: route[0]?.size ?? unit.size, route, showTrail: unit.showTrail, visibility: { showAt: visibility.showAt, hideAt: visibility.hideAt } });
  }
  for (let index = 0; index < units.length; index++) {
    units[index].groupId = groupId(inputUnits[index]);
    units[index].quantity = inputUnits[index].quantity ?? 1;
    units[index].combat = normalizeCombat(inputUnits[index].combat, inputUnits[index]);
  }
  const result = clearInvalidFiringTargets({
    version: 7,
    groups,
    view: {
      center: { lat: view.center.lat, lng: view.center.lng },
      zoom: view.zoom,
      mapTypeId: view.mapTypeId,
      heading: view.heading ?? 0,
    },
    badges,
    units,
    lines: normalizedLines,
    paintStrokes: validatePaintStrokes(input.version < 6 ? [] : input.paintStrokes).map((stroke) => ({ ...stroke, groupId: groupId(stroke) })),
    playbackDuration,
    battles: input.version < 7 ? [] : input.battles ?? [],
    battleAssets: input.version < 7 ? {} : input.battleAssets ?? {},
  });
  validateOwnership(result);
  validateBattles(result);
  for (const replay of result.battles) {
    const snapshot = hydrateSnapshot(replay, result.battleAssets);
    await validateProject({ ...snapshot, version: 7, view: result.view, playbackDuration, battles: [], battleAssets: {} }, normalizeImage);
  }
  return checkProjectSize(result);
}

// Resolve references only after both badges and symbols have been collected.
export function clearInvalidFiringTargets(project) {
  const ids = new Set([...project.badges, ...project.units].map((feature) => feature.id));
  const clean = (feature) => {
    const invalid = (stop) => stop.firingTargetId != null && (!ids.has(stop.firingTargetId) || stop.firingTargetId === feature.id);
    if (!feature.route.some(invalid)) return feature;
    return { ...feature, route: feature.route.map((stop) => {
      if (!invalid(stop)) return stop;
      const { firingTargetId: _target, ...rest } = stop;
      return rest;
    }) };
  };
  return { ...project, badges: project.badges.map(clean), units: project.units.map(clean) };
}

export function normalizeLine(line) {
  if (!line || typeof line.id !== "string" || !line.id || line.id.length > 100 || typeof line.name !== "string" || !line.name.trim() || line.name.trim().length > 80 || !["solid", "dashed"].includes(line.style) || ![3, 6, 10].includes(line.width) || !Array.isArray(line.path) || line.path.length < (line.kind === "text" ? 1 : 2) || line.path.length > MAX_LINE_POINTS || line.path.some((point) => !point || typeof point.lat !== "number" || typeof point.lng !== "number" || !coordinates(point.lat, point.lng))) {
    throw new Error(`Give your line a name, a style, and 2–${MAX_LINE_POINTS} valid points.`);
  }
  if ((line.shape !== undefined && !["straight", "curve"].includes(line.shape)) || [line.startArrow, line.endArrow].some((value) => value !== undefined && typeof value !== "boolean")) throw new Error("Choose a straight or curved line and valid arrow settings.");
  if (line.kind !== undefined && !["line", "text"].includes(line.kind)) throw new Error("Choose a line or text label.");
  if ([line.showLine, line.showLabel].some((value) => value !== undefined && typeof value !== "boolean")) throw new Error("Choose valid visibility settings.");
  if (line.labelFont !== undefined && !["sans-serif", "serif", "monospace"].includes(line.labelFont)) throw new Error("Choose a valid label font.");
  if (line.labelSize !== undefined && ![12, 16, 20, 24, 32].includes(line.labelSize)) throw new Error("Choose a valid label size.");
  if ([line.labelBold, line.labelItalic].some((value) => value !== undefined && typeof value !== "boolean")) throw new Error("Choose valid text style settings.");
  const colorPattern = /^#[0-9a-f]{6}$/i;
  if (line.labelColor !== undefined && (typeof line.labelColor !== "string" || !colorPattern.test(line.labelColor))) throw new Error("Choose a valid text color.");
  if (line.labelBackground !== undefined && line.labelBackground !== "transparent" && (typeof line.labelBackground !== "string" || !colorPattern.test(line.labelBackground))) throw new Error("Choose a valid badge background color.");
  return { groupId: line.groupId, labelFont: line.labelFont ?? "sans-serif", labelSize: line.labelSize ?? 16, labelBold: line.labelBold ?? true, labelItalic: line.labelItalic ?? false, ...(line.labelColor !== undefined ? { labelColor: line.labelColor } : {}), labelBackground: line.labelBackground ?? "transparent", kind: line.kind ?? "line", showLine: line.showLine ?? true, showLabel: line.showLabel ?? (line.kind === "text"), id: line.id, name: line.name.trim(), style: line.style, shape: line.shape ?? "straight", startArrow: line.startArrow ?? false, endArrow: line.endArrow ?? false, width: line.width, path: line.path.map(({ lat, lng }) => ({ lat, lng })) };
}

