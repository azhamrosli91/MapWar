import { CHUNK_SIZE, createTerritoryProjection, territoryEligible } from "./territory.js";

function createGL(canvas) {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!gl) return null;
  const shader = (type, source) => {
    const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("Territory shader could not compile.");
    return s;
  };
  const program = gl.createProgram();
  const vertex = shader(gl.VERTEX_SHADER, "attribute vec2 position; attribute vec4 color; uniform vec2 resolution; varying vec4 tint; void main(){ gl_Position=vec4(position/resolution*vec2(2.,-2.)+vec2(-1.,1.),0.,1.); tint=color; }");
  const fragment = shader(gl.FRAGMENT_SHADER, "precision mediump float; varying vec4 tint; void main(){gl_FragColor=tint;}");
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Territory shader could not link.");
  gl.deleteShader(vertex); gl.deleteShader(fragment);
  const position = gl.getAttribLocation(program, "position"), color = gl.getAttribLocation(program, "color");
  return {
    upload(array, previous) {
      const buffer = previous ?? gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, array, gl.DYNAMIC_DRAW); return buffer;
    },
    begin(width, height, ratio) {
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program); gl.uniform2f(gl.getUniformLocation(program, "resolution"), width, height);
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.enableVertexAttribArray(position); gl.enableVertexAttribArray(color);
      void ratio;
    },
    draw(buffer, length) {
      if (!length) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 24, 0); gl.vertexAttribPointer(color, 4, gl.FLOAT, false, 24, 8);
      gl.drawArrays(gl.TRIANGLES, 0, length / 6);
    },
    remove(buffer) { if (buffer) gl.deleteBuffer(buffer); },
    finish() { gl.finish(); },
    dispose() { gl.deleteProgram(program); },
  };
}
const rgb = (hex, opacity) => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255, opacity];

export function createTerritoryOverlay(api) {
  const overlay = new api.OverlayView();
  const surface = document.createElement("div"); surface.className = "territory-overlay";
  let canvas = document.createElement("canvas"); surface.append(canvas);
  const errorBox = document.createElement("div"); errorBox.className = "territory-error"; errorBox.setAttribute("role", "alert"); errorBox.hidden = true;
  const statusBox = document.createElement("div"); statusBox.className = "territory-status"; statusBox.setAttribute("role", "status"); statusBox.textContent = "Preparing territory from historical routes…"; statusBox.hidden = true;
  let gl;
  try { gl = createGL(canvas); } catch { gl = null; }
  if (!gl) { canvas.remove(); canvas = document.createElement("canvas"); surface.prepend(canvas); }
  const ctx = gl ? null : canvas.getContext("2d");
  let worker, config, groups = [], projection, signature, generation = 0, request = 0;
  let pending = null, completed = null, lastTime = null, disposed = false, failure = null;
  let drawHandle = 0, cameraRevision = 0, styleRevision = 0, drawnRevision = -1;
  let resolveDraw = [], chunks = new Map();
  const fail = (error) => {
    failure = error instanceof Error ? error : new Error(String(error));
    errorBox.textContent = failure.message; errorBox.hidden = false;
    statusBox.hidden = true;
    pending?.reject(failure); pending = null;
    for (const waiter of resolveDraw.splice(0)) waiter.reject(failure);
    for (const item of chunks.values()) { gl?.remove(item.fillBuffer); gl?.remove(item.lineBuffer); }
    chunks.clear(); schedule();
  };
  function makeChunk(chunk) {
    const size = config.cellSizeMeters;
    const toGeo = ([x, y]) => projection.unproject(x * size, y * size);
    const [cx, cy] = chunk.key.split(",").map(Number);
    const previous = chunks.get(chunk.key);
    return {
      ...chunk, fillBuffer: previous?.fillBuffer, lineBuffer: previous?.lineBuffer,
      revision: -1, style: -1,
      bounds: [[cx * CHUNK_SIZE, cy * CHUNK_SIZE], [(cx + 1) * CHUNK_SIZE, cy * CHUNK_SIZE], [(cx + 1) * CHUNK_SIZE, (cy + 1) * CHUNK_SIZE], [cx * CHUNK_SIZE, (cy + 1) * CHUNK_SIZE]].map(toGeo),
      geography: null,
    };
  }
  function startWorker() {
    worker = new Worker(new URL("./territory.worker.js", import.meta.url), { type: "module" });
    worker.onerror = () => fail(new Error("Territory processing is unavailable. Reload the map to retry."));
    worker.onmessage = ({ data }) => {
      if (data.generation !== generation || data.request !== pending?.request) return;
      if (data.error) { fail(new Error(data.error)); return; }
      if (data.reset) {
        for (const item of chunks.values()) { gl?.remove(item.fillBuffer); gl?.remove(item.lineBuffer); }
        chunks.clear();
      }
      for (const chunk of data.chunks) chunks.set(chunk.key, makeChunk(chunk));
      const wait = pending; pending = null; completed = data.time;
      statusBox.hidden = true;
      schedule();
      afterDraw().then(wait.resolve, wait.reject);
    };
  }
  function afterDraw() {
    if (failure) return Promise.reject(failure);
    return new Promise((resolve, reject) => { resolveDraw.push({ resolve, reject }); schedule(); });
  }
  function schedule() { if (!disposed && !drawHandle) drawHandle = requestAnimationFrame(draw); }
  function draw() {
    drawHandle = 0;
    const mapProjection = overlay.getProjection();
    if (!mapProjection || disposed) return;
    const div = api.map.getDiv(), width = div.clientWidth, height = div.clientHeight;
    if (!width || !height) return;
    const origin = mapProjection.fromContainerPixelToLatLng(new window.google.maps.Point(0, 0));
    const offset = mapProjection.fromLatLngToDivPixel(origin);
    if (!offset) return;
    surface.style.left = `${offset.x}px`; surface.style.top = `${offset.y}px`;
    surface.style.width = `${width}px`; surface.style.height = `${height}px`;
    const ratio = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); cameraRevision++;
    }
    if (gl) gl.begin(width, height, ratio);
    else { ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height); }
    const colors = new Map(groups.map((g) => [g.id, g.color]));
    const screen = (point) => mapProjection.fromLatLngToContainerPixel(new window.google.maps.LatLng(point));
    const visible = [];
    if (config?.enabled && !failure) for (const chunk of chunks.values()) {
      const bounds = chunk.bounds.map(screen);
      if (bounds.some((p) => !p)) continue;
      if (Math.max(...bounds.map((p) => p.x)) < -8 || Math.min(...bounds.map((p) => p.x)) > width + 8 || Math.max(...bounds.map((p) => p.y)) < -8 || Math.min(...bounds.map((p) => p.y)) > height + 8) continue;
      if (!chunk.geography) {
        const toGeo = ([x, y]) => projection.unproject(x * config.cellSizeMeters, y * config.cellSizeMeters);
        chunk.geography = {
          cells: chunk.cells.map(([x, y, owner]) => ({ owner, corners: [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]].map(toGeo) })),
          paths: chunk.paths.map((p) => ({ ...p, path: p.path.map(toGeo) })),
        };
      }
      if (chunk.revision !== cameraRevision || chunk.style !== styleRevision) {
        const fill = [], lines = [];
        const triangle = (array, a, b, c, color) => { for (const p of [a, b, c]) array.push(p.x, p.y, ...color); };
        const stroke = (a, b, color, shift = 0, thickness = 2) => {
          const d = Math.hypot(b.x - a.x, b.y - a.y); if (!d) return;
          const nx = -(b.y - a.y) / d, ny = (b.x - a.x) / d;
          const p = (v, offset) => ({ x: v.x + nx * offset, y: v.y + ny * offset });
          const u = p(a, shift - thickness / 2), v = p(b, shift - thickness / 2), w = p(b, shift + thickness / 2), z = p(a, shift + thickness / 2);
          triangle(lines, u, v, w, color); triangle(lines, u, w, z, color);
        };
        for (const cell of chunk.geography.cells) {
          const p = cell.corners.map(screen); if (p.some((v) => !v)) continue;
          const color = rgb(colors.get(cell.owner) ?? "#777777", config.opacity);
          triangle(fill, p[0], p[1], p[2], color); triangle(fill, p[0], p[2], p[3], color);
          if (config.showDebugGrid) for (let i = 0; i < 4; i++) stroke(p[i], p[(i + 1) % 4], [0, 0, 0, 0.35], 0, 0.5);
        }
        if (config.showFrontline) for (const path of chunk.geography.paths) {
          const points = path.path.map(screen);
          for (let i = 1; i < points.length; i++) if (points[i - 1] && points[i]) {
            stroke(points[i - 1], points[i], rgb(colors.get(path.a) ?? "#777777", 1), -1);
            stroke(points[i - 1], points[i], rgb(colors.get(path.b) ?? "#777777", 1), 1);
          }
        }
        chunk.fill = new Float32Array(fill); chunk.lines = new Float32Array(lines);
        if (gl) { chunk.fillBuffer = gl.upload(chunk.fill, chunk.fillBuffer); chunk.lineBuffer = gl.upload(chunk.lines, chunk.lineBuffer); }
        chunk.revision = cameraRevision; chunk.style = styleRevision;
      }
      visible.push(chunk);
    }
    const drawArray = (array) => {
      for (let i = 0; i < array.length; i += 18) {
        ctx.fillStyle = `rgba(${Math.round(array[i + 2] * 255)},${Math.round(array[i + 3] * 255)},${Math.round(array[i + 4] * 255)},${array[i + 5]})`;
        ctx.beginPath(); ctx.moveTo(array[i], array[i + 1]); ctx.lineTo(array[i + 6], array[i + 7]); ctx.lineTo(array[i + 12], array[i + 13]); ctx.closePath(); ctx.fill();
      }
    };
    // All fills precede all frontlines, including across chunk seams.
    for (const c of visible) if (gl) gl.draw(c.fillBuffer, c.fill.length); else drawArray(c.fill);
    for (const c of visible) if (gl) gl.draw(c.lineBuffer, c.lines.length); else drawArray(c.lines);
    gl?.finish(); drawnRevision = cameraRevision;
    for (const waiter of resolveDraw.splice(0)) waiter.resolve();
  }
  function setTime(time) {
    lastTime = time;
    if (!config?.enabled || disposed) return Promise.resolve();
    if (failure) return Promise.reject(failure);
    if (pending?.time === time) return pending.promise;
    if (completed === time && !pending) return drawnRevision === cameraRevision ? Promise.resolve() : afterDraw();
    if (pending) { pending.resolve(); pending = null; }
    const item = { time, request: ++request };
    item.promise = new Promise((resolve, reject) => { item.resolve = resolve; item.reject = reject; });
    pending = item;
    worker.postMessage({ type: "seek", generation, request: item.request, time, reset: completed === null });
    return item.promise;
  }
  overlay.onAdd = () => {
    const pane = overlay.getPanes().overlayLayer; pane.prepend(surface);
    api.map.getDiv().append(errorBox, statusBox); schedule();
  };
  overlay.draw = () => { cameraRevision++; schedule(); };
  overlay.onRemove = () => { surface.remove(); errorBox.remove(); statusBox.remove(); };
  canvas.addEventListener("webglcontextlost", (event) => { event.preventDefault(); fail(new Error("Territory graphics context was lost. Reload to restore it.")); });
  overlay.setMap(api.map);
  return {
    configure(next, badges, nextGroups, time) {
      groups = nextGroups ?? []; config = next; styleRevision++;
      const key = JSON.stringify([next?.enabled, next?.origin, next?.cellSizeMeters, badges.filter((b) => b.territory?.captureEnabled).map((b) => [b.id, b.groupId, b.route.map(({ lat, lng, dateTime }) => [lat, lng, dateTime]), b.territory, b.combat?.domain])]);
      if (key !== signature) {
        signature = key; generation++; completed = null; failure = null; errorBox.hidden = true;
        statusBox.hidden = !config?.enabled;
        pending?.resolve(); pending = null;
        for (const c of chunks.values()) { gl?.remove(c.fillBuffer); gl?.remove(c.lineBuffer); } chunks.clear();
        if (config?.enabled) {
          projection = createTerritoryProjection(config.origin);
          if (!worker) startWorker();
          // Images, artwork, effects and editor drafts are not capture inputs.
          const inputs = badges.filter(territoryEligible).map((badge) => ({
            id: badge.id, groupId: badge.groupId, territory: badge.territory,
            combat: { domain: badge.combat?.domain ?? "land" },
            route: badge.route.map(({ lat, lng, dateTime }) => ({ lat, lng, dateTime })),
          }));
          worker.postMessage({ type: "configure", generation, config, badges: inputs });
        } else { worker?.terminate(); worker = null; }
      }
      schedule(); return setTime(time);
    },
    setTime,
    async ready(time = lastTime) {
      for (;;) {
        const gen = generation;
        await setTime(time);
        if (!config?.enabled || disposed) return;
        if (gen === generation && completed === time && !pending) { await afterDraw(); return; }
      }
    },
    dispose() {
      disposed = true; cancelAnimationFrame(drawHandle); worker?.terminate(); pending?.reject(new Error("Territory overlay closed."));
      for (const waiter of resolveDraw.splice(0)) waiter.reject(new Error("Territory overlay closed."));
      for (const c of chunks.values()) { gl?.remove(c.fillBuffer); gl?.remove(c.lineBuffer); }
      gl?.dispose(); overlay.setMap(null);
    },
  };
}
