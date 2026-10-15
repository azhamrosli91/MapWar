import { BADGE_SYMBOLS } from "./symbols.js";
export { BADGE_SYMBOLS, UNIT_KINDS } from "./symbols.js";
import tankImage from "./assets/equipment/tank.png";
import boatImage from "./assets/equipment/boat.png";
import artilleryImage from "./assets/equipment/artillery.png";
import warshipImage from "./assets/equipment/warship.png";
import multipleUsersImage from "./assets/equipment/multiple-users.png";
import troopImage from "./assets/equipment/troop.png";
import helmetImage from "./assets/equipment/helmet.png";
import gunImage from "./assets/equipment/gun.png";
import fortressImage from "./assets/equipment/fortress.png";
import submarineImage from "./assets/equipment/submarine.png";
import aircraftImage from "./assets/equipment/aircraft.png";
import helicopterImage from "./assets/equipment/helicopter.png";
import ammunitionImage from "./assets/equipment/ammunition.png";
import militaryTruckImage from "./assets/equipment/military-truck.png";

export const UNIT_IMAGES = { tank: tankImage, boat: boatImage, artillery: artilleryImage, warship: warshipImage, "multiple-users": multipleUsersImage, troop: troopImage, helmet: helmetImage, gun: gunImage, fortress: fortressImage, submarine: submarineImage, aircraft: aircraftImage, helicopter: helicopterImage, ammunition: ammunitionImage, "military-truck": militaryTruckImage };

export function unitImage(unit) {
  return unit.kind === "other" ? unit.image || "" : UNIT_IMAGES[unit.kind] || "";
}

export function unitKindLabel(kind) {
  return kind === "troop" ? "Troops / Infantry" : kind === "other" ? "Uploaded image" : BADGE_SYMBOLS.find((symbol) => symbol.value === kind)?.label ?? kind;
}
export const effectSymbols = { booming: "✹", demolish: "▥", kills: "☠", crack: "ϟ" };

export const DEFAULT_BADGE_SYMBOL = "helmet";

export function isBadgeSymbol(value) {
  return BADGE_SYMBOLS.some((symbol) => symbol.value === value);
}

export function symbolMarkup(symbol) {
  if (!symbol?.paths.length) return null;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", symbol.viewBox);
  svg.setAttribute("aria-hidden", "true");
  for (const shape of symbol.paths) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", shape.d);
    path.setAttribute("fill", "currentColor");
    if (shape.fillRule) path.setAttribute("fill-rule", shape.fillRule);
    svg.append(path);
  }
  return svg;
}

export function badgeElement(badge, selected = false, draft = false) {
  const box = document.createElement("div");
  box.className = `badge${selected ? " badge-selected" : ""}${draft ? " badge-draft" : ""}`;
  const top = document.createElement("div");
  top.className = "badge-art";
  if (badge.flag) {
    const image = document.createElement("img");
    image.src = badge.flag;
    image.alt = "";
    image.draggable = false;
    top.append(image);
  }
  if (badge.symbol === "custom" && badge.symbolImage) {
    const image = document.createElement("img");
    image.className = "custom-symbol-image";
    image.src = badge.symbolImage;
    image.alt = "";
    image.draggable = false;
    top.append(image);
  } else {
    const symbol = BADGE_SYMBOLS.find((item) => item.value === badge.symbol);
    const icon = symbolMarkup(symbol);
    if (icon) top.append(icon);
  }
  const label = document.createElement("div");
  label.className = "badge-label";
  label.textContent = badge.label || "YOUR LABEL";
  const stars = document.createElement("div");
  stars.className = "badge-stars";
  stars.textContent = "★".repeat(badge.stars ?? 0);
  const effect = document.createElement("span");
  effect.className = "feature-effect";
  effect.setAttribute("aria-hidden", "true");
  const count = document.createElement("span");
  count.className = "badge-troop-count";
  box.append(top, label, stars, count, effect);
  setBadgeTroopCount(box, badge.troopCount ?? 0);
  return box;
}

export function unitElement(unit, selected = false, draft = false) {
  const box = document.createElement("div");
  box.className = `map-unit${selected ? " badge-selected" : ""}${draft ? " badge-draft" : ""}`;
  const icon = document.createElement("div");
  const imageSource = unitImage(unit);
  icon.className = `map-unit-icon${imageSource ? unit.kind === "other" ? " is-image" : " is-preset-image" : ""}`;
  icon.style.color = unit.color ?? "#ffffff";
  if (imageSource) {
    const image = document.createElement("img");
    image.src = imageSource;
    image.alt = "";
    image.draggable = false;
    icon.append(image);
  } else {
    icon.append(symbolMarkup(BADGE_SYMBOLS.find((symbol) => symbol.value === (unit.kind === "troop" ? "person" : unit.kind === "other" ? "helmet" : unit.kind))));
  }
  const label = document.createElement("span");
  label.className = "map-unit-label";
  label.textContent = unit.name || "New equipment";
  const effect = document.createElement("span");
  effect.className = "feature-effect";
  effect.setAttribute("aria-hidden", "true");
  box.append(icon, label, effect);
  return box;
}

export function setFeatureEffect(element, effect, elapsedMs = 0, repeatWhileMoving = false) {
  const target = element?.querySelector(".feature-effect");
  if (!target) return;
  if (target.dataset.effect !== effect) {
    target.dataset.effect = effect;
    target.textContent = effectSymbols[effect] ?? "";
    target.title = effect === "none" ? "" : effect;
  }
  if (effect === "none" || effect === "firing") return;
  let seconds = Math.max(0, elapsedMs) / 1000;
  const animationDuration = { booming: 1.35, demolish: 1.5, kills: 1.25, crack: 0.8 }[effect];
  const repeats = repeatWhileMoving && effect === "booming";
  if (seconds >= animationDuration && !repeats) {
    target.style.opacity = 1;
    target.style.transform = "";
    return;
  }
  if (repeats) seconds %= animationDuration;
  let opacity = 1;
  let scale = 1;
  let x = 0;
  let y = 0;
  let angle = 0;
  if (effect === "booming") {
    const phase = seconds / 1.35;
    scale = 0.65 + phase * 0.9;
    opacity = Math.max(0.2, 1 - phase * 0.85);
    angle = phase * 32;
  } else if (effect === "demolish") {
    const phase = seconds / 1.5;
    x = Math.sin(phase * Math.PI * 10) * (1 - phase) * 4;
    y = phase * 5;
    angle = Math.sin(phase * Math.PI * 8) * 12;
    opacity = 1 - phase * 0.55;
  } else if (effect === "kills") {
    const pulse = Math.sin(seconds * Math.PI * 2 / 1.25);
    scale = 1 + 0.15 * (pulse + 1) / 2;
    opacity = 0.7 + 0.3 * (pulse + 1) / 2;
  } else if (effect === "crack") {
    const phase = seconds;
    opacity = phase < 0.16 || (phase >= 0.27 && phase < 0.34) ? 1 : 0.32;
    scale = opacity === 1 ? 1.24 : 0.92;
    x = phase < 0.34 ? 3 : -2;
    angle = phase < 0.34 ? -14 : 12;
  }
  target.style.opacity = opacity;
  target.style.transform = `translate(${x}px, ${y}px) scale(${scale}) rotate(${angle}deg)`;
}

export function setBadgeTroopCount(element, troopCount) {
  const count = element.querySelector(".badge-troop-count");
  if (!count) return;
  const text = troopCount > 0 ? String(troopCount) : "";
  if (count.textContent !== text) {
    count.textContent = text;
    count.setAttribute("aria-label", `${troopCount} troops`);
  }
}
