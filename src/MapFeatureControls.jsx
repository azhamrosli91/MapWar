import { useEffect, useLayoutEffect, useRef } from "react";
import { TARGET_EFFECTS, formatScenarioTime, nextHour } from "./timeline.js";
import SizePicker from "./SizePicker.jsx";

export default function MapFeatureControls({ menu, session, targets = [], error, onDismiss, onEdit, onMovement, onChange, onStart, onSave, onCancel, onFullEditor, onEffect }) {
  const panel = useRef(null);
  const ui = menu ? "menu" : session?.ui;
  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    const place = () => {
      if (!menu && !["edit", "start"].includes(ui)) return;
      const anchor = menu ?? session;
      const stage = element.parentElement.getBoundingClientRect();
      const left = Math.max(8, Math.min(anchor.x - stage.left, stage.width - element.offsetWidth - 8));
      const top = Math.max(8, Math.min(anchor.y - stage.top, stage.height - element.offsetHeight - 8));
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    observer.observe(element.parentElement);
    return () => observer.disconnect();
  }, [menu, session, ui]);

  useEffect(() => {
    panel.current?.querySelector("input, button")?.focus();
  }, [ui, menu?.id]);

  useEffect(() => {
    if (!menu) return;
    const dismissOutside = (event) => {
      if (panel.current?.contains(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onDismiss();
    };
    window.addEventListener("click", dismissOutside, true);
    return () => window.removeEventListener("click", dismissOutside, true);
  }, [menu, onDismiss]);

  useEffect(() => {
    if (!ui || ui === "full") return;
    const escape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (menu) onDismiss(); else onCancel();
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [ui, menu, onDismiss, onCancel]);

  if (!ui || ui === "full") return null;
  const stopEvent = (event) => event.stopPropagation();
  const name = session?.feature.label ?? session?.feature.name;
  const currentStop = session?.feature.route.find((stop) => stop.dateTime === session.dateTime);
  const target = targets.find((feature) => feature.id === currentStop?.firingTargetId);
  const effectLabel = (effect) => effect.charAt(0).toUpperCase() + effect.slice(1);
  const message = error && <p className="form-error" role="alert">{error}</p>;
  if (menu) return <div className="map-feature-shield" onPointerDown={(event) => { event.stopPropagation(); event.preventDefault(); onDismiss(); }} onClick={stopEvent} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onDismiss(); }}>
    <div ref={panel} className="map-feature-popup map-feature-menu" role="menu" aria-label={menu.kind === "effect" ? "Target effects" : "Feature actions"} onPointerDown={stopEvent} onClick={stopEvent} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }} onKeyDown={(event) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...event.currentTarget.querySelectorAll("button")];
      const index = buttons.indexOf(document.activeElement);
      buttons[event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
    }}>
      {menu.kind === "effect" ? <>
        <div className="map-target-menu-heading"><strong>{name} → {menu.targetName}</strong><time>{formatScenarioTime(session.time)}</time></div>
        {TARGET_EFFECTS.map((effect) => <button key={effect} role="menuitem" onClick={() => onEffect(effect)}>{effectLabel(effect)}</button>)}
      </> : <>
        <button role="menuitem" onClick={onEdit}>Edit</button>
        <button role="menuitem" onClick={onMovement}>Start edit movement</button>
      </>}
    </div>
  </div>;

  if (ui === "movement") return <section ref={panel} className="map-movement-controls" aria-label="Edit movement" onPointerDown={stopEvent} onClick={stopEvent}>
    <strong>Editing movement · {name}</strong>
    <span>Click the map to add a destination. Each point advances one hour.</span>
    <span>Click another badge or equipment to choose an effect.</span>
    <span>Current: {formatScenarioTime(session.time)}</span>
    <span>Next: {nextHour(session.dateTime) ? formatScenarioTime(session.time + 3600000) : "Date limit reached"}</span>
    {currentStop?.effect && currentStop.effect !== "none" && <div className="map-movement-effect" role="status">
      <span>Effect: {effectLabel(currentStop.effect)}{target ? ` → ${target.label ?? target.name}` : currentStop.targetLocation ? " → Map location" : ""}</span>
      <button type="button" className="secondary" onClick={() => onEffect("none")}>Clear effect</button>
    </div>}
    {message}
    <div className="map-feature-actions"><button className="primary" onClick={onSave}>Save movement</button><button className="secondary" onClick={onCancel}>Cancel</button></div>
  </section>;

  return <div className="map-feature-shield" onPointerDown={stopEvent} onClick={stopEvent} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}>
    <form ref={panel} className="map-feature-popup" aria-label={ui === "start" ? "Movement starting time" : "Edit feature"} onPointerDown={stopEvent} onSubmit={(event) => { event.preventDefault(); if (ui === "start") onStart(); else onSave(); }}>
      <h3>{ui === "start" ? "Start edit movement" : "Edit base settings"}</h3>
      {ui === "start" ? <label className="field-label">Starting scenario date and time<input type="datetime-local" min="0001-01-01T00:00" max="9999-12-31T23:59" step="60" required value={session.dateTime} onChange={(event) => onChange({ dateTime: event.target.value })} /></label> : <>
        <label className="field-label">{session.featureType === "badge" ? "Label" : "Name"}<input required maxLength={80} value={name} onChange={(event) => onChange({ [session.featureType === "badge" ? "label" : "name"]: event.target.value })} /></label>
        <SizePicker label={session.featureType === "badge" ? "Badge size" : "Equipment size"} value={session.feature.size} onChange={(size) => onChange({ size })} />
        {session.featureType === "badge" && <label className="field-label">Troop count<input type="number" required min="0" max={Number.MAX_SAFE_INTEGER} step="1" value={session.feature.troopCount ?? 0} onChange={(event) => onChange({ troopCount: event.target.value === "" ? "" : Number(event.target.value) })} /></label>}
        <p className="field-hint">Base settings apply across the timeline. Dated effects and other settings are in the full editor.</p>
      </>}
      {message}
      <div className="map-feature-actions"><button className="primary" type="submit">{ui === "start" ? "Start movement" : "Save"}</button><button className="secondary" type="button" onClick={onCancel}>Cancel</button>{ui === "edit" && <button className="secondary" type="button" onClick={onFullEditor}>Full editor</button>}</div>
    </form>
  </div>;
}
