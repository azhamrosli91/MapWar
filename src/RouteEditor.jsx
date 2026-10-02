import { Plus, Trash2, Crosshair } from "lucide-react";
import SizePicker from "./SizePicker.jsx";
import EffectTargetPicker from "./EffectTargetPicker.jsx";
import { MAX_STOPS, ROUTE_EFFECTS, createRouteStop, routeError, stopLabel } from "./timeline.js";

export default function RouteEditor({ badge, onChange, mapReady, mode, onMode, onFocus, onPickTargetLocation, targetLocationStopId, onPickRouteLocation, routeLocationStopId, featureName = "badge", effectTargets = [] }) {
  const route = badge.route;
  const targets = effectTargets.filter((target) => target.id !== badge.id);
  function changeRoute(next) {
    onChange({ route: next, ...(next[0] ? { lat: next[0].lat, lng: next[0].lng, size: next[0].size, ...(featureName === "badge" ? { troopCount: next[0].troopCount ?? badge.troopCount ?? 0 } : {}) } : {}), ...(!next.length ? { showTrail: false } : {}) });
  }
  function updateStop(id, patch) {
    changeRoute(route.map((stop) => stop.id === id ? { ...stop, ...patch } : stop));
  }
  function startRoute() {
    onMode("navigate");
    changeRoute([{ id: crypto.randomUUID(), lat: badge.lat, lng: badge.lng, size: badge.size, ...(featureName === "badge" ? { troopCount: badge.troopCount ?? 0 } : {}), dateTime: "", effect: "none" }]);
  }
  const problem = routeError(route);
  return <section className="route-editor" aria-label="Movement route">
    <h4>Movement route <span>{route.length} stops</span></h4>
    {!route.length ? <><p className="field-hint">Add dated locations to move and resize this {featureName} along the historical timeline.</p><button type="button" className="position-button" onClick={startRoute}><Plus size={15} /> Add movement route</button></> : <>
      <p className="field-hint">Set A’s date and time, then add B, C, and more. Times use the same scenario clock on every device.</p>
      <ol className="route-stops">{route.map((stop, index) => <li key={stop.id}>
        <div className="stop-heading"><button className="stop-label" type="button" onClick={() => onFocus(stop)} disabled={!mapReady}>Stop {stopLabel(index)}</button><button type="button" className="icon-button" aria-label={`Remove stop ${stopLabel(index)}`} onClick={() => { onMode("navigate"); changeRoute(route.filter((item) => item.id !== stop.id)); }}><Trash2 size={14} /></button></div>
        <label className="stop-date">Date and time<input type="datetime-local" min="0001-01-01T00:00" max="9999-12-31T23:59" step="60" required value={stop.dateTime} onChange={(event) => updateStop(stop.id, { dateTime: event.target.value })} /></label>
        <div className="coordinate-fields">{["lat", "lng"].map((axis) => <label key={axis}>{axis === "lat" ? "Latitude" : "Longitude"}<input type="number" step="any" min={axis === "lat" ? -90 : -180} max={axis === "lat" ? 90 : 180} required value={stop[axis]} onChange={(event) => updateStop(stop.id, { [axis]: event.target.value })} /></label>)}</div>
        <button type="button" className={`position-button ${mode === "repointStop" && routeLocationStopId === stop.id ? "is-placing" : ""}`} disabled={!mapReady} onClick={() => onPickRouteLocation(stop.id)}><Crosshair size={15} />{mode === "repointStop" && routeLocationStopId === stop.id ? "Click a location on the map" : "Repoint on map"}</button>
        {featureName === "badge" && <label className="field-label">Troop number at {stopLabel(index)}<input type="number" min="0" max={Number.MAX_SAFE_INTEGER} step="1" required value={stop.troopCount ?? badge.troopCount ?? 0} onChange={(event) => { const troopCount = Number(event.target.value); if (Number.isSafeInteger(troopCount) && troopCount >= 0) updateStop(stop.id, { troopCount }); }} /></label>}
        <SizePicker label={`Size at ${stopLabel(index)}`} value={stop.size} onChange={(size) => updateStop(stop.id, { size })} />
        <label className="field-label">Effect after arrival at {stopLabel(index)}<select value={stop.effect ?? "none"} onChange={(event) => { const effect = event.target.value; updateStop(stop.id, { effect, ...(effect !== "booming" ? { targetLocation: undefined } : {}) }); }}>{ROUTE_EFFECTS.map((effect) => <option key={effect} value={effect}>{effect === "none" ? "Normal" : effect.charAt(0).toUpperCase() + effect.slice(1)}</option>)}</select></label>
        {stop.effect !== "none" && <>
          {stop.effect === "booming" && <label className="check-label"><input type="checkbox" checked={!!stop.targetLocation} onChange={(event) => { const targetLocation = event.target.checked ? stop.targetLocation ?? { lat: "", lng: "" } : undefined; updateStop(stop.id, { firingTargetId: undefined, targetLocation }); }} /> Target a map location</label>}
          {stop.effect === "booming" && stop.targetLocation ? <>
            <div className="coordinate-fields effect-target-coordinates">{["lat", "lng"].map((axis) => <label key={axis}>{axis === "lat" ? "Target latitude" : "Target longitude"}<input type="number" step="any" min={axis === "lat" ? -90 : -180} max={axis === "lat" ? 90 : 180} required value={stop.targetLocation[axis] ?? ""} onChange={(event) => updateStop(stop.id, { targetLocation: { ...stop.targetLocation, [axis]: event.target.value } })} /></label>)}</div>
            <button type="button" className={`position-button ${mode === "placeEffectTarget" && targetLocationStopId === stop.id ? "is-placing" : ""}`} disabled={!mapReady} onClick={() => onPickTargetLocation(stop.id)}><Crosshair size={15} />{mode === "placeEffectTarget" && targetLocationStopId === stop.id ? "Click a location on the map" : "Choose on map"}</button>
            {!mapReady && <p className="field-hint">Connect the map, or enter target coordinates above.</p>}
          </> : <>
            <EffectTargetPicker
              label={stop.effect === "firing" ? "Firing target" : "Effect target"}
              targets={targets}
              value={targets.some((target) => target.id === stop.firingTargetId) ? stop.firingTargetId : ""}
              onChange={(firingTargetId) => updateStop(stop.id, { firingTargetId: firingTargetId || undefined, targetLocation: undefined })}
            />
            {!targets.some((target) => target.id === stop.firingTargetId) && <p className="field-hint">{stop.effect === "firing" ? "Choose a badge or equipment target to show firing." : "Choose a badge or equipment to direct this effect toward."}</p>}
          </>}
        </>}
      </li>)}</ol>
      <div className="route-add-actions"><button type="button" className={`position-button ${mode === "addStop" ? "is-placing" : ""}`} disabled={!mapReady || !!problem || route.length >= MAX_STOPS} onClick={() => onMode(mode === "addStop" ? "navigate" : "addStop")}><Crosshair size={15} />{mode === "addStop" ? "Click map for next stop" : "Add stop on map"}</button>
      <button type="button" className="secondary" disabled={!!problem || route.length >= MAX_STOPS} onClick={() => changeRoute([...route, createRouteStop(route)])}>Add by coordinates</button></div>
      {problem && <p className="field-hint" role="status">{problem}</p>}
      {route.length < 2 && <p className="field-hint">One dated stop can play an effect. Add a second stop at a different location to move this {featureName}.</p>}
      <label className="check-label"><input type="checkbox" checked={badge.showTrail} onChange={(event) => onChange({ showTrail: event.target.checked })} /> Show movement trail</label>
      <button className="delete-button" type="button" onClick={() => { if (window.confirm(`Remove this ${featureName}’s entire movement route?`)) { onMode("navigate"); changeRoute([]); } }}>Remove movement route</button>
    </>}
  </section>;
}
