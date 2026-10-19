export function createCommandOverlay(api, entries, currentProps) {
  const overlay = new api.OverlayView(), input = document.createElement("div"), box = document.createElement("div");
  input.className = "command-input"; box.className = "command-selection-box"; input.append(box);
  const mapElement = api.map.getDiv();
  const isControl = (event) => {
    if (event.composedPath().some((element) => element.tagName === "GMP-ADVANCED-MARKER")) return false;
    return event.target.closest?.("button, input, select, textarea, a, [role='button']");
  };
  let active = null;
  const getPoint = (event) => {
    const rect = api.map.getDiv().getBoundingClientRect();
    return overlay.getProjection()?.fromContainerPixelToLatLng(new window.google.maps.Point(event.clientX - rect.left, event.clientY - rect.top))?.toJSON();
  };
  const hit = (event) => [...entries.current.values()].filter((entry) => entry.visible && entry.rendered).reverse().find((entry) => {
    const rect = entry.element.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  });
  function issue(event, requireTarget = false) {
    const props = currentProps.current, target = hit(event), point = getPoint(event);
    if (!point) return;
    if (requireTarget && (!target || target.groupId === props.activeGroupId)) return;
    props.onCommand?.(point, target?.groupId !== props.activeGroupId ? target?.id : undefined);
  }
  function down(event) {
    if (isControl(event)) return;
    if (event.button !== 0 && event.button !== 1) return;
    const shift = event.shiftKey || event.ctrlKey || event.metaKey;
    const captured = event.button === 0 && shift;
    if (captured) {
      event.preventDefault(); event.stopPropagation(); mapElement.setPointerCapture(event.pointerId);
    }
    active = { x: event.clientX, y: event.clientY, button: event.button, shift, captured, dragging: false };
  }
  function move(event) {
    if (!active) return;
    if (!active.dragging && Math.hypot(event.clientX - active.x, event.clientY - active.y) <= 5) return;
    active.dragging = true;
    if (active.button === 1 || !active.shift) {
      return;
    }
    event.preventDefault(); event.stopPropagation();
    input.style.cursor = "crosshair";
    const rect = input.getBoundingClientRect();
    box.style.display = "block";
    box.style.left = `${Math.min(active.x, event.clientX) - rect.left}px`; box.style.top = `${Math.min(active.y, event.clientY) - rect.top}px`;
    box.style.width = `${Math.abs(active.x - event.clientX)}px`; box.style.height = `${Math.abs(active.y - event.clientY)}px`;
  }
  function up(event) {
    if (!active) return;
    const gesture = active; active = null; box.style.display = "none"; input.style.cursor = "";
    if (gesture.captured) {
      event.stopPropagation();
      if (mapElement.hasPointerCapture(event.pointerId)) mapElement.releasePointerCapture(event.pointerId);
    }
    if (event.type !== "pointerup" || gesture.button !== 0) return;
    const props = currentProps.current, drag = gesture.dragging;
    if (drag && !gesture.shift) return;
    if (!drag && props.commandAction) {
      if (props.commandAction === "move") { const point = getPoint(event); if (point) props.onCommand?.(point); } else issue(event, true);
      return;
    }
    if (!drag) { const entry = hit(event); props.onCommandSelect?.(entry ? [entry.id] : [], gesture.shift); return; }
    const ids = [...entries.current.values()].filter((entry) => {
      if (!entry.visible || !entry.rendered || entry.groupId !== props.activeGroupId) return false;
      const rect = entry.element.getBoundingClientRect();
      return rect.right >= Math.min(gesture.x, event.clientX) && rect.left <= Math.max(gesture.x, event.clientX) && rect.bottom >= Math.min(gesture.y, event.clientY) && rect.top <= Math.max(gesture.y, event.clientY);
    }).map((entry) => entry.id);
    props.onCommandSelect?.(ids, gesture.shift);
  }
  const context = (event) => { if (isControl(event)) return; event.preventDefault(); event.stopPropagation(); const point = getPoint(event); if (point) currentProps.current.onCommand?.(point); };
  const key = (event) => {
    if (event.key === "Escape") currentProps.current.onCommandSelect?.([]);
    if (event.key.toLowerCase() === "s" && !event.ctrlKey && !event.metaKey) currentProps.current.onCommandStop?.();
  };
  const handlers = [["pointerdown", down], ["pointermove", move], ["pointerup", up], ["pointercancel", up], ["lostpointercapture", up], ["contextmenu", context], ["keydown", key]];
  for (const [name, handler] of handlers) mapElement.addEventListener(name, handler, true);
  overlay.onAdd = () => api.map.getDiv().append(input);
  overlay.draw = () => {};
  overlay.onRemove = () => {
    for (const [name, handler] of handlers) mapElement.removeEventListener(name, handler, true);
    input.remove();
  };
  overlay.setMap(api.map);
  return () => overlay.setMap(null);
}
