import { countryPath } from "./territory-campaign.js";
import { cameraTransform, worldPoint } from "./territory-campaign-overlay.js";
import { WORLD_LEGEND, worldCountryState } from "./world-campaign.js";

export function createWorldCampaignOverlay(api) {
  const overlay = new api.OverlayView();
  const surface = document.createElement("div");
  surface.className = "territory-overlay";
  const canvas = document.createElement("canvas");
  surface.append(canvas);
  const ctx = canvas.getContext("2d");
  const status = document.createElement("div");
  status.className = "territory-status";
  status.setAttribute("role", "status");
  status.textContent = "Preparing worldwide WWII territories…";
  const legend = document.createElement("div");
  legend.className = "territory-legend world-territory-legend";
  legend.title = "Country-scale WWII alignment and occupation milestones on modern coastlines and borders. Divided areas do not show exact frontlines. European Axis includes Italy and partners; Japan includes aligned Thailand. Allied control after surrender does not imply membership.";
  const swatches = WORLD_LEGEND.map(([, label]) => {
    const item = document.createElement("span"), swatch = document.createElement("i");
    item.append(swatch, label); legend.append(item);
    return swatch;
  });
  const note = document.createElement("small");
  note.textContent = "WWII overview · modern borders · schematic control";
  legend.append(note);
  const controller = new AbortController();
  let config, groups = [], paths, time = 0, frame = 0, disposed = false, loading, failure;
  let pending = [];
  function schedule() { if (!disposed && !frame) frame = requestAnimationFrame(draw); }
  function fail(error) {
    failure = error;
    status.hidden = false;
    status.className = "territory-error";
    status.setAttribute("role", "alert");
    status.textContent = error.message;
    for (const waiter of pending.splice(0)) waiter.reject(error);
  }
  function ready() {
    if (failure) return Promise.reject(failure);
    if (disposed) return Promise.reject(new Error("Territory overlay closed."));
    return new Promise((resolve, reject) => { pending.push({ resolve, reject }); schedule(); });
  }
  function draw() {
    frame = 0;
    if (disposed || !paths || !config) return;
    try {
      const projection = overlay.getProjection();
      const width = api.map.getDiv().clientWidth, height = api.map.getDiv().clientHeight;
      if (!projection || !width || !height) return;
      const origin = projection.fromContainerPixelToLatLng(new window.google.maps.Point(0, 0));
      const offset = projection.fromLatLngToDivPixel(origin);
      Object.assign(surface.style, { left: `${offset.x}px`, top: `${offset.y}px`, width: `${width}px`, height: `${height}px` });
      const ratio = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      legend.hidden = !config.enabled;
      if (config.enabled) {
        const transform = cameraTransform(api, projection);
        if (!transform) return;
        const { a, b, c, d, e, f } = transform;
        const scale = Math.hypot(a, b);
        const palette = Object.fromEntries(WORLD_LEGEND.map(([state, , fallback, key], index) => {
          const color = groups.find((group) => group.id === config.campaign[key])?.color ?? fallback;
          swatches[index].style.backgroundColor = color;
          return [state, color];
        }));
        // Repeat the immutable world geometry when the camera crosses the dateline.
        const copies = Math.ceil(Math.hypot(width, height) / (256 * scale)) + 1;
        for (let copy = -copies; copy <= copies; copy++) {
          ctx.setTransform(ratio * a, ratio * b, ratio * c, ratio * d, ratio * (e + copy * 256 * a), ratio * (f + copy * 256 * b));
          ctx.globalAlpha = config.opacity;
          for (const [code, path] of paths) {
            const state = worldCountryState(code, time);
            ctx.fillStyle = palette[state];
            ctx.fill(path, "evenodd");
            if (config.showFrontline && state !== "neutral") {
              ctx.strokeStyle = palette[state];
              ctx.lineWidth = 0.8 / scale;
              ctx.stroke(path);
            }
          }
        }
        ctx.globalAlpha = 1;
      }
      status.hidden = true;
      for (const waiter of pending.splice(0)) waiter.resolve();
    } catch (error) { fail(error); }
  }
  overlay.onAdd = () => { overlay.getPanes().overlayLayer.prepend(surface); api.map.getDiv().append(status, legend); schedule(); };
  overlay.draw = schedule;
  overlay.onRemove = () => { surface.remove(); status.remove(); legend.remove(); };
  overlay.setMap(api.map);
  return {
    configure(next, _badges, nextGroups, nextTime) {
      config = next; groups = nextGroups ?? []; time = nextTime;
      if (!loading) {
        loading = fetch("/territory/world-1939-45-v1.json", { signal: controller.signal }).then((response) => {
          if (!response.ok) throw new Error("Worldwide WWII boundaries could not be loaded.");
          return response.json();
        }).then((data) => {
          paths = Object.entries(data.countries).map(([code, country]) => [code, countryPath(country.geometry, worldPoint)]);
        }).catch((error) => { if (!disposed) fail(error); throw error; });
      }
      return loading.then(ready);
    },
    setTime(nextTime) { if (time !== nextTime) { time = nextTime; schedule(); } return Promise.resolve(); },
    async ready(nextTime) { time = nextTime; await loading; await ready(); },
    dispose() {
      disposed = true; controller.abort(); cancelAnimationFrame(frame);
      for (const waiter of pending.splice(0)) waiter.reject(new Error("Territory overlay closed."));
      overlay.setMap(null);
    },
  };
}
