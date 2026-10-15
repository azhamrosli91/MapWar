import { formatScenarioClock, isScenarioNight } from "./timeline.js";

export const VIDEO_FPS = 30;
export const MAX_RECORDING_FRAMES = VIDEO_FPS * 600;
export const VIDEO_REQUEST_LIMIT = 32 * 1024 * 1024;

export const VIDEO_FORMATS = {
  landscape: { width: 1920, height: 1080, label: "Landscape 16:9" },
  portrait: { width: 1080, height: 1920, label: "Portrait 9:16" },
};

export function videoFrameSize(width, height, orientation) {
  const [x, y] = orientation === "portrait" ? [9, 16] : [16, 9];
  const unit = Math.max(1, Math.floor(Math.min((width - 28) / x, (height - 28) / y)));
  return { width: unit * x, height: unit * y };
}

export function videoDate(time) {
  if (!Number.isFinite(time)) return "";
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(time);
  return `${date}, ${formatScenarioClock(time)}${isScenarioNight(time) ? " ☾" : ""}`;
}
