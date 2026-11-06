import { campaignMask, compileCampaign, countryPath } from "./territory-campaign.js";

const ANCHOR = { lat: 4, lng: 102 };
const mercatorY = (lat) => {
  const radians = Math.max(-85, Math.min(85, lat)) * Math.PI / 180;
  return 128 - 128 / Math.PI * Math.log(Math.tan(Math.PI / 4 + radians / 2));
};
const originY = mercatorY(ANCHOR.lat);
// All paths live in one immutable, camera-independent Mercator coordinate system.
export const worldPoint = ({ lat, lng }) => ({ x: (lng - ANCHOR.lng) * 256 / 360, y: mercatorY(lat) - originY });
const eastStep = 256 / 360;
const northStep = mercatorY(ANCHOR.lat + 1) - originY;

export function cameraTransform(api, projection) {
  const project = (lat, lng) => projection.fromLatLngToContainerPixel(new window.google.maps.LatLng(lat, lng));
  const origin = project(ANCHOR.lat, ANCHOR.lng);
  if (!origin) return null;
  const width = projection.getWorldWidth();
  const heading = (api.map.getHeading() ?? 0) * Math.PI / 180;
  const wx = width * Math.cos(heading), wy = -width * Math.sin(heading);
  const unwrap = (point) => {
    if (!point) return null;
    const copies = width > 0 ? Math.round(((origin.x - point.x) * wx + (origin.y - point.y) * wy) / (width * width)) : 0;
    return { x: point.x + copies * wx, y: point.y + copies * wy };
  };
  const east = unwrap(project(ANCHOR.lat, ANCHOR.lng + 1));
  const north = unwrap(project(ANCHOR.lat + 1, ANCHOR.lng));
  if (!east || !north) return null;
  return { a: (east.x - origin.x) / eastStep, b: (east.y - origin.y) / eastStep,
    c: (north.x - origin.x) / northStep, d: (north.y - origin.y) / northStep, e: origin.x, f: origin.y };
}

export function createCampaignTerritoryOverlay(api) {
  const overlay = new api.OverlayView();
  const surface = document.createElement("div"); surface.className = "territory-overlay";
  const canvas = document.createElement("canvas"); surface.append(canvas);
  const ctx = canvas.getContext("2d");
  const status = document.createElement("div"); status.className = "territory-status"; status.setAttribute("role", "status"); status.textContent = "Preparing historical land areas…";
  const errorBox = document.createElement("div"); errorBox.className = "territory-error"; errorBox.setAttribute("role", "alert"); errorBox.hidden = true;
  const legend = document.createElement("div"); legend.className = "territory-legend";
  legend.title = "Schematic historical areas. Thailand red represents its agreement allowing Japanese passage. Blue is the initial display color, not an assertion of Allied membership.";
  const baseline = document.createElement("span"), captured = document.createElement("span");
  const baseSwatch = document.createElement("i"), redSwatch = document.createElement("i");
  baseline.append(baseSwatch, "Initial areas"); captured.append(redSwatch, "Japanese advance / alignment"); legend.append(baseline, captured);
  let config, groups = [], campaign, time = 0, frame = 0, disposed = false, failure;
  let projected, countryPaths, ownership, peninsula;
  const masks = new Map();
  let pending = [], loading = null;
  const controller = new AbortController();
  function fail(error) {
    failure = error; status.hidden = true; errorBox.hidden = false; errorBox.textContent = error.message;
    for (const item of pending.splice(0)) item.reject(error);
  }
  function schedule() { if (!frame && !disposed) frame = requestAnimationFrame(draw); }
  function ready() {
    if (failure) return Promise.reject(failure);
    if (disposed) return Promise.reject(new Error("Territory overlay closed."));
    return new Promise((resolve, reject) => { pending.push({ resolve, reject }); schedule(); });
  }
  function draw() {
    frame = 0;
    if (disposed || !campaign || !config) return;
    try {
      const projection = overlay.getProjection();
      const width = api.map.getDiv().clientWidth, height = api.map.getDiv().clientHeight;
      if (!projection || !width || !height) return;
      const origin = projection.fromContainerPixelToLatLng(new window.google.maps.Point(0, 0));
      const offset = projection.fromLatLngToDivPixel(origin);
      surface.style.left = `${offset.x}px`; surface.style.top = `${offset.y}px`;
      surface.style.width = `${width}px`; surface.style.height = `${height}px`;
      const ratio = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
      legend.hidden = !config.enabled;
      if (config.enabled) {
        // MapCanvas fixes tilt at zero, so pan, zoom and heading are an affine transform.
        // Three map projections replace tens of thousands of per-vertex projections.
        const transform = cameraTransform(api, projection);
        if (!transform) return;
        const { a, b, c, d, e, f } = transform;
        ctx.setTransform(ratio * a, ratio * b, ratio * c, ratio * d, ratio * e, ratio * f);
        const initialColor = groups.find((g) => g.id === config.campaign.initialGroupId)?.color ?? "#3478d4";
        const captureColor = groups.find((g) => g.id === config.campaign.captureGroupId)?.color ?? "#cf4d4d";
        baseSwatch.style.backgroundColor = initialColor; redSwatch.style.backgroundColor = captureColor;
        // Replace baseline pixels before filling red so opacity is applied once.
        ctx.save(); ctx.globalAlpha = config.opacity; ctx.fillStyle = initialColor; ctx.fill(ownership, "evenodd"); ctx.restore();
        const fillCaptured = (path) => {
          ctx.save(); ctx.globalCompositeOperation = "destination-out"; ctx.fillStyle = "#000"; ctx.fill(path, "evenodd");
          ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = config.opacity; ctx.fillStyle = captureColor; ctx.fill(path, "evenodd"); ctx.restore();
        };
        if (time >= campaign.thailandChangeAt) fillCaptured(countryPaths.THA);
        for (const [name, countryId] of [["malaya", "MYS"], ["singapore", "SGP"]]) {
          const field = campaign[name];
          if (time < field.startAt) continue;
          ctx.save(); ctx.clip(countryPaths[countryId], "evenodd");
          if (time >= field.completeAt) {
            if (name === "malaya") {
              // The Malayan campaign covers the peninsula; Borneo stays at its baseline.
              fillCaptured(peninsula);
            } else fillCaptured(countryPaths.SGP);
          } else {
            let cached = masks.get(name);
            if (cached?.time !== time) {
              cached = { time, mask: campaignMask(field, projected[name], time) };
              masks.set(name, cached);
            }
            const mask = cached.mask;
            fillCaptured(mask.fill);
            if (config.showFrontline) {
              ctx.globalAlpha = 1; ctx.strokeStyle = captureColor; ctx.lineWidth = 2 / Math.hypot(a, b); ctx.lineCap = "round"; ctx.stroke(mask.border);
            }
          }
          ctx.restore();
        }
      }
      status.hidden = true;
      for (const item of pending.splice(0)) item.resolve();
    } catch (error) { fail(error); }
  }
  overlay.onAdd = () => { overlay.getPanes().overlayLayer.prepend(surface); api.map.getDiv().append(status, errorBox, legend); schedule(); };
  overlay.draw = schedule;
  overlay.onRemove = () => { surface.remove(); status.remove(); errorBox.remove(); legend.remove(); };
  overlay.setMap(api.map);
  return {
    configure(next, _badges, nextGroups, nextTime) {
      config = next; groups = nextGroups ?? []; time = nextTime;
      if (!loading) {
        loading = fetch("/territory/malaya-1941-42-v1.json", { signal: controller.signal }).then((response) => {
          if (!response.ok) throw new Error("Historical country boundaries could not be loaded.");
          return response.json();
        }).then((data) => {
          campaign = compileCampaign(data);
          countryPaths = Object.fromEntries(Object.entries(campaign.countries).map(([id, country]) => [id, countryPath(country.geometry, worldPoint)]));
          ownership = new Path2D();
          for (const path of Object.values(countryPaths)) ownership.addPath(path);
          projected = { malaya: campaign.malaya.vertices.map(worldPoint), singapore: campaign.singapore.vertices.map(worldPoint) };
          const field = campaign.malaya, grid = projected.malaya;
          peninsula = new Path2D();
          [0, field.columns, grid.length - 1, field.rows * (field.columns + 1)].forEach((id, i) => {
            if (i) peninsula.lineTo(grid[id].x, grid[id].y); else peninsula.moveTo(grid[id].x, grid[id].y);
          });
          peninsula.closePath(); schedule();
        }).catch((error) => { if (!disposed) fail(error); throw error; });
        loading.catch(() => {});
      }
      return loading.then(ready);
    },
    setTime(nextTime) {
      if (nextTime !== time) { time = nextTime; schedule(); }
      return Promise.resolve();
    },
    async ready(nextTime) {
      time = nextTime;
      await loading;
      await ready();
    },
    dispose() {
      disposed = true; controller.abort(); cancelAnimationFrame(frame);
      for (const item of pending.splice(0)) item.reject(new Error("Territory overlay closed."));
      overlay.setMap(null);
    },
  };
}
