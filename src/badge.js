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

export const BADGE_SYMBOLS = [
  { value: "none", label: "None", viewBox: "0 0 60 44", paths: [] },
  {
    value: "helmet",
    label: "Helmet",
    viewBox: "0 0 60 44",
    paths: [
      { d: "M8 29C8 15 16 7 30 7s22 8 22 22l6 3v5H2v-5l6-3Z" },
    ],
  },
  {
    value: "artillery",
    label: "Artillery",
    viewBox: "0 0 60 44",
    paths: [
      { d: "M9 12 41 5l2 6-32 8z" },
      { d: "M17 18h18l6 11H21z M22 28l-13 10v3l18-7h8v-6z" },
      {
        d: "M44 24a8 8 0 1 0 0 16a8 8 0 1 0 0-16Z M44 29a3 3 0 1 1 0 6a3 3 0 1 1 0-6Z",
        fillRule: "evenodd",
      },
    ],
  },
  {
    value: "tank",
    label: "Tank",
    viewBox: "0 0 60 44",
    paths: [
      { d: "M34 11h21v4H34z" },
      { d: "M7 28l5-8h10l7-8h12l6 8h4l6 8v8H7z" },
      {
        d: "M8 32h46v7H8z M15 33a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5Z M28 33a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5Z M41 33a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5Z",
        fillRule: "evenodd",
      },
    ],
  },
  {
    value: "person",
    label: "Person",
    viewBox: "0 0 60 44",
    paths: [
      { d: "M30 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16Z" },
      { d: "M30 22c-9 0-15 6-15 14v6h30v-6c0-8-6-14-15-14Z" },
    ],
  },
  { value: "warship", label: "Warship", viewBox: "0 0 60 44", paths: [{ d: "M4 27h52l-8 12H12z M18 26V13h20v13z M25 12V5h5v7z M40 20h12v5H40z" }] },
  {
    value: "boat", label: "Boat", viewBox: "0 0 60 44",
    paths: [{ d: "M28 2h4v26h-4Z M25 5v20H8Z M35 9l17 16H35Z M3 29h54l-9 12H14Z" }],
  },
  {
    value: "medic", label: "Medic (+)", viewBox: "0 0 60 44",
    paths: [{ d: "M24 4h12v12h12v12H36v12H24V28H12V16h12Z" }],
  },
  {
    value: "kill", label: "Kill (x)", viewBox: "0 0 60 44",
    paths: [{ d: "m17 4 13 13L43 4l7 7-13 13 13 13-7 7-13-13-13 13-7-7 13-13L10 11Z" }],
  },
  {
    value: "missing", label: "Missing (?)", viewBox: "0 0 60 44",
    paths: [{ d: "M17 13C17 5 23 2 30 2c9 0 14 5 14 12 0 6-3 9-8 12l-2 2v3h-8v-5c0-4 3-6 6-8 3-2 4-3 4-5 0-3-2-4-6-4-3 0-5 2-5 4Z M26 35h8v8h-8Z" }],
  },
  {
    value: "fortress", label: "Fortress", viewBox: "0 0 60 44",
    paths: [{ d: "M5 4h6v6h6V4h6v15h14V4h6v6h6V4h6v36H35V29a5 5 0 0 0-10 0v11H5Z M11 19h6v7h-6Z M43 19h6v7h-6Z", fillRule: "evenodd" }],
  },
  {
    value: "multiple-users", label: "Multiple User", viewBox: "0 0 60 44",
    paths: [
      { d: "M30 3a7 7 0 1 0 0 14 7 7 0 1 0 0-14Z M12 9a6 6 0 1 0 0 12 6 6 0 1 0 0-12Z M48 9a6 6 0 1 0 0 12 6 6 0 1 0 0-12Z" },
      { d: "M30 20c-8 0-13 5-13 12v9h26v-9c0-7-5-12-13-12Z M12 24C5 24 1 29 1 35v5h12v-8c0-3 1-5 2-8Z M48 24h-3c1 3 2 5 2 8v8h12v-5c0-6-4-11-11-11Z" },
    ],
  },
  {
    value: "crow", label: "Crow", viewBox: "0 0 60 44",
    paths: [{ d: "M3 35 17 20c3-5 8-7 15-6l5-6c3-4 9-4 12-1l3 4 7 3-9 3c-1 10-7 15-19 15h-4l-3 6h7v3H19l4-10-9 5Z M44 9a2 2 0 1 0 0 4 2 2 0 1 0 0-4Z", fillRule: "evenodd" }],
  },
  {
    value: "house", label: "House", viewBox: "0 0 60 44",
    paths: [{ d: "M2 21 30 2l13 9V5h8v12l7 4-5 7-5-4v17H35V28H25v13H12V24l-5 4Z" }],
  },
  {
    value: "spear", label: "Spear", viewBox: "0 0 60 44",
    paths: [{ d: "m4 37 29-23 4 5L8 42Z M32 13 56 2l-13 23-4-8Z" }],
  },
  {
    value: "gun", label: "Gun", viewBox: "0 0 60 44",
    paths: [{ d: "M5 10h38V7h5v3h8v10H33v9H21l-4 12H5l8-22H5Z M23 20l-2 5h8v-5Z", fillRule: "evenodd" }],
  },
  {
    value: "shield", label: "Shield", viewBox: "0 0 60 44",
    paths: [{ d: "M30 2 49 9v12c0 10-8 17-19 22C19 38 11 31 11 21V9Z M30 9l-12 5v7c0 6 5 11 12 15 7-4 12-9 12-15v-7Z", fillRule: "evenodd" }],
  },
  {
    value: "crossed-swords", label: "Crossed swords", viewBox: "0 0 60 44",
    paths: [{ d: "M4 2 15 5l24 24 4-4 5 5-5 5 9 9h-9l-5-5-5 5-5-5 5-5L9 10Z M56 2l-5 8-13 13-5-5L45 5Z M22 24l5 5-5 5 5 5-5 5-5-5-5 5H3l9-9-5-5 5-5 5 5Z" }],
  },
  {
    value: "aircraft", label: "Aircraft", viewBox: "0 0 60 44",
    paths: [{ d: "M27 3h6l3 14 22 12v6l-22-6-2 8 8 4v3l-12-2-12 2v-3l8-4-2-8-22 6v-6l22-12Z" }],
  },
  {
    value: "ammunition", label: "Ammunition", viewBox: "0 0 60 44",
    paths: [{ d: "M10 17 16 3l6 14v19H10Z M8 38h16v4H8Z M24 17 30 3l6 14v19H24Z M22 38h16v4H22Z M38 17 44 3l6 14v19H38Z M36 38h16v4H36Z" }],
  },
  {
    value: "supplies", label: "Supplies", viewBox: "0 0 60 44",
    paths: [{ d: "M7 7h46v34H7Z M12 12v24h36V12Z M14 14h7l9 8 9-8h7L34 25l12 9h-7l-9-6-9 6h-7l12-9Z", fillRule: "evenodd" }],
  },
  {
    value: "outpost", label: "Outpost", viewBox: "0 0 60 44",
    paths: [{ d: "M13 2h4v40h-4Z M19 3h28l-6 8 6 8H19Z M20 38h29v4H20Z" }],
  },
  { value: "helicopter", label: "Helicopter", viewBox: "0 0 60 44", paths: [{ d: "M8 4h44v3H33v7h10l8 10v8H26L9 22H2v-5h10l10 7V14h7V7H8Z M24 35h4v4h19v-4h4v7H20v-3h4Z" }] },
  { value: "submarine", label: "Submarine", viewBox: "0 0 60 44", paths: [{ d: "M13 22h35a9 9 0 0 1 0 18H13a9 9 0 0 1 0-18Z M24 12h13v8H24Z M29 4h13v4h-9v3h-4Z M2 25h4v12H2Z" }] },
  { value: "military-truck", label: "Military truck", viewBox: "0 0 60 44", paths: [{ d: "M3 9h32v22H3Z M38 16h12l8 10v9H38Z M42 19v8h11l-6-8Z", fillRule: "evenodd" }, { d: "M14 29a7 7 0 1 0 0 14 7 7 0 1 0 0-14Z M46 29a7 7 0 1 0 0 14 7 7 0 1 0 0-14Z" }] },
  { value: "missile", label: "Missile", viewBox: "0 0 60 44", paths: [{ d: "M37 5 57 2l-5 18-23 18-9-11Z M18 23l-10-1 9-10h14Z M33 35l-1 8 12-9 1-11Z M15 30l7 7-13 6-6-6Z" }] },
  { value: "radar", label: "Radar", viewBox: "0 0 60 44", paths: [{ d: "M8 5 39 29C25 42 7 29 8 5Z M27 12l16-10 3 4-16 10Z M27 32h6v6h15v4H12v-4h15Z M44 11c6 3 9 8 9 14h-4c0-5-2-8-7-11Z" }] },
  {
    value: "horse", label: "Horse", viewBox: "0 0 60 44",
    paths: [{ d: "M40 3l5 5 7 2 6 9-4 5-9-3-5 9 3 11h-6l-5-13H20l-4 13h-6l4-16-4-7-3 9H2l4-15 8 3h18l7-7Z M45 13a2 2 0 1 0 4 0 2 2 0 1 0-4 0Z", fillRule: "evenodd" }],
  },
  {
    value: "castle", label: "Castle", viewBox: "0 0 60 44",
    paths: [{ d: "M4 8h5v5h5V8h5v12h5V5h4V1h4v4h4v15h5V8h5v5h5V8h5v33H35V30a5 5 0 0 0-10 0v11H4Z M10 23h4v7h-4Z M46 23h4v7h-4Z M28 12h4v7h-4Z", fillRule: "evenodd" }],
  },
  { value: "crown", label: "Crown", viewBox: "0 0 60 44", paths: [{ d: "M5 10 18 21 30 4 42 21 55 10l-6 24H11Z M11 37h38v5H11Z" }] },
  { value: "custom", label: "Image", viewBox: "0 0 60 44", paths: [] },
];

export const UNIT_KINDS = ["tank", "warship", "artillery", "troop", ...BADGE_SYMBOLS.filter((symbol) => symbol.paths.length && !["tank", "warship", "artillery", "person"].includes(symbol.value)).map((symbol) => symbol.value), "other"];

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
