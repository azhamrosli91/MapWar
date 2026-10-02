import { brushDimensions } from "./paint.js";

export function createPaintOverlay(api, onStroke) {
  const overlay = new api.OverlayView();
  const surface = document.createElement("div");
  surface.className = "paint-overlay";
  const canvas = document.createElement("canvas");
  const strokeCanvas = document.createElement("canvas");
  const input = document.createElement("div");
  input.className = "paint-input";
  const cursor = document.createElement("div");
  cursor.className = "paint-cursor";
  surface.append(canvas);
  input.append(cursor);
  let strokes = [];
  let brush = null;
  let active = null;
  let enabled = false;
  let frame = 0;

  function resize() {
    const projection = overlay.getProjection();
    if (!projection) return false;
    const mapDiv = api.map.getDiv();
    const width = mapDiv.clientWidth;
    const height = mapDiv.clientHeight;
    if (!width || !height) return false;
    const origin = projection.fromContainerPixelToLatLng(new window.google.maps.Point(0, 0));
    const pixel = projection.fromLatLngToDivPixel(origin);
    if (!pixel) return false;
    surface.style.left = `${pixel.x}px`;
    surface.style.top = `${pixel.y}px`;
    surface.style.width = `${width}px`;
    surface.style.height = `${height}px`;
    input.style.left = `${pixel.x}px`;
    input.style.top = `${pixel.y}px`;
    input.style.width = `${width}px`;
    input.style.height = `${height}px`;
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(width * ratio);
    const h = Math.round(height * ratio);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    if (strokeCanvas.width !== w || strokeCanvas.height !== h) { strokeCanvas.width = w; strokeCanvas.height = h; }
    return true;
  }

  function stamp(ctx, x, y, width, height, shape) {
    ctx.beginPath();
    if (shape === "circle") ctx.ellipse(x, y, width / 2, height / 2, 0, 0, Math.PI * 2);
    else ctx.rect(x - width / 2, y - height / 2, width, height);
    ctx.fill();
  }

  function draw() {
    frame = 0;
    if (!resize()) return;
    const projection = overlay.getProjection();
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    const strokeCtx = strokeCanvas.getContext("2d");
    for (const stroke of [...strokes, ...(active ? [active] : [])]) {
      strokeCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
      strokeCtx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
      strokeCtx.fillStyle = stroke.tool === "erase" ? "#000" : stroke.color;
      const factor = 2 ** ((api.map.getZoom() ?? stroke.zoom) - stroke.zoom);
      const width = stroke.width * factor;
      const height = stroke.height * factor;
      let previous = null;
      for (const point of stroke.points) {
        const pixel = projection.fromLatLngToContainerPixel(new window.google.maps.LatLng(point));
        if (!pixel) continue;
        if (previous) {
          const distance = Math.hypot(pixel.x - previous.x, pixel.y - previous.y);
          const steps = Math.ceil(distance / Math.max(2, Math.min(width, height) / 4));
          for (let i = 1; i < steps; i++) stamp(strokeCtx, previous.x + (pixel.x - previous.x) * i / steps, previous.y + (pixel.y - previous.y) * i / steps, width, height, stroke.shape);
        }
        stamp(strokeCtx, pixel.x, pixel.y, width, height, stroke.shape);
        previous = pixel;
      }
      // Clear the entire brush shape first so adjacent strokes never build up opacity.
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1;
      ctx.drawImage(strokeCanvas, 0, 0, canvas.width / ratio, canvas.height / ratio);
      if (stroke.tool === "erase") continue;
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = stroke.opacity ?? 0.35;
      ctx.drawImage(strokeCanvas, 0, 0, canvas.width / ratio, canvas.height / ratio);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  function scheduleDraw() { if (!frame) frame = requestAnimationFrame(draw); }
  function position(event) {
    const rect = api.map.getDiv().getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function geographic(event) {
    const { x, y } = position(event);
    return overlay.getProjection()?.fromContainerPixelToLatLng(new window.google.maps.Point(x, y))?.toJSON();
  }
  function moveCursor(event) {
    if (!enabled || !brush) return;
    const { x, y } = position(event);
    const { width, height } = brushDimensions(brush.shape, brush.size);
    cursor.style.display = "block";
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
    cursor.style.width = `${width}px`;
    cursor.style.height = `${height}px`;
    cursor.style.borderRadius = brush.shape === "circle" ? "50%" : "0";
    cursor.style.borderColor = brush.tool === "erase" ? "#333" : brush.color;
  }
  function start(event) {
    if (!enabled || event.button !== 0 || strokes.length >= 2000) return;
    const point = geographic(event);
    if (!point) return;
    event.preventDefault();
    input.setPointerCapture(event.pointerId);
    const { width, height } = brushDimensions(brush.shape, brush.size);
    active = { id: crypto.randomUUID(), tool: brush.tool, shape: brush.shape, color: brush.color, opacity: brush.opacity, width, height, zoom: api.map.getZoom(), points: [point] };
    moveCursor(event);
    scheduleDraw();
  }
  function move(event) {
    moveCursor(event);
    if (!active) return;
    const point = geographic(event);
    if (!point) return;
    const previous = active.points.at(-1);
    if (Math.abs(point.lat - previous.lat) + Math.abs(point.lng - previous.lng) < 1e-8) return;
    if (active.points.length < 200000) active.points.push(point);
    scheduleDraw();
  }
  function finish(event) {
    if (!active) return;
    if (event.type === "pointerup") {
      const stroke = active;
      active = null;
      onStroke(stroke);
    } else active = null;
    scheduleDraw();
  }
  input.addEventListener("pointerdown", start);
  input.addEventListener("pointermove", move);
  input.addEventListener("pointerup", finish);
  input.addEventListener("pointercancel", finish);
  input.addEventListener("lostpointercapture", finish);
  input.addEventListener("pointerleave", () => { if (!active) cursor.style.display = "none"; });
  overlay.onAdd = () => { overlay.getPanes().overlayLayer.append(surface); overlay.getPanes().overlayMouseTarget.append(input); };
  overlay.draw = scheduleDraw;
  overlay.onRemove = () => { cancelAnimationFrame(frame); surface.remove(); input.remove(); };
  overlay.setMap(api.map);
  return {
    setStrokes(value) { strokes = value; scheduleDraw(); },
    setBrush(value, editable) { brush = value; enabled = editable; input.style.pointerEvents = enabled ? "auto" : "none"; cursor.style.display = "none"; if (!enabled) active = null; scheduleDraw(); },
    dispose() { overlay.setMap(null); },
  };
}
