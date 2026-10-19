import { AlertCircle, Check, Copy, Crosshair, Trash2, X } from "lucide-react";
import SymbolPicker from "./SymbolPicker.jsx";
import RouteEditor from "./RouteEditor.jsx";
import SizePicker from "./SizePicker.jsx";
import VisibilityEditor from "./VisibilityEditor.jsx";
import { BADGE_SYMBOLS, unitKindLabel, unitImage } from "./badge.js";
import ForceSettings from "./ForceSettings.jsx";
import { defaultCombat } from "./combat.js";
import { coordinates } from "./data.js";

export default function UnitEditor({ groups, unit, editing, onChange, onImage, onSave, onCancel, onDelete, onClone, onPlace, mode, mapReady, uploading, error, onMode, onFocus, onPickTargetLocation, targetLocationStopId, onPickRouteLocation, routeLocationStopId, effectTargets }) {
  const symbol = BADGE_SYMBOLS.find((item) => item.value === (unit.kind === "troop" ? "person" : unit.kind === "other" ? "helmet" : unit.kind));
  const imageSource = unitImage(unit);
  return <form className="editor feature-editor" onSubmit={onSave}>
    <div className="editor-title"><h3>{editing ? "Edit equipment" : "New equipment"}</h3><button type="button" className="icon-button" aria-label="Close editor" onClick={onCancel}><X size={18} /></button></div>
    <div className="unit-preview"><div className={`map-unit-icon${imageSource ? unit.kind === "other" ? " is-image" : " is-preset-image" : ""}`} style={{ color: unit.color ?? "#ffffff" }}>{imageSource ? <img src={imageSource} alt={unitKindLabel(unit.kind)} /> : <svg viewBox={symbol.viewBox}>{symbol.paths.map((path) => <path key={path.d} fill="currentColor" fillRule={path.fillRule} d={path.d} />)}</svg>}</div><strong>{unit.name || "New equipment"}</strong></div>
    <label className="field-label">Name<input value={unit.name} onChange={(event) => onChange({ name: event.target.value })} maxLength={80} placeholder="e.g. 2nd Tank Regiment" required /></label>
    <ForceSettings feature={unit} groups={groups} equipment onChange={onChange} />
    {editing && <button type="button" className="badge-settings-reset" onClick={onClone} disabled={uploading} title="Create a copy of this equipment"><Copy size={14} /> <span>Clone equipment</span></button>}
    <SymbolPicker equipment value={unit.kind} image={unit.image} onSelect={(kind) => onChange({ kind, combat: defaultCombat({ kind }) })} onImage={onImage} onRemoveImage={() => onChange({ image: "", ...(unit.kind === "other" ? { kind: "tank" } : {}) })} uploading={uploading} error={error} />
    {!imageSource && unit.kind !== "other" && <label className="field-label paint-color">Equipment color<input type="color" value={unit.color ?? "#ffffff"} onChange={(event) => onChange({ color: event.target.value })} /></label>}
    
    <SizePicker value={unit.size} onChange={(size) => onChange({ size })} />
    <div className="section-rule" />
    <div className="field-label location-title">Position <span>{coordinates(unit.lat, unit.lng) ? "LOCATION SET" : "CHOOSE A SPOT"}</span></div>
    <button type="button" className={`position-button ${mode === "placeUnit" ? "is-placing" : ""}`} disabled={!mapReady || unit.route.length > 0} onClick={onPlace}><Crosshair size={17} /> {mode === "placeUnit" ? "Click a location on the map" : "Choose on map"}</button>
    <div className="coordinate-fields">{["lat", "lng"].map((axis) => <label key={axis}>{axis === "lat" ? "Latitude" : "Longitude"}<input type="number" step="any" min={axis === "lat" ? -90 : -180} max={axis === "lat" ? 90 : 180} value={unit[axis]} readOnly={unit.route.length > 0} required onChange={(event) => onChange({ [axis]: event.target.value })} /></label>)}</div>
    <RouteEditor badge={unit} onChange={onChange} mapReady={mapReady} mode={mode} onMode={onMode} onFocus={onFocus} onPickTargetLocation={onPickTargetLocation} targetLocationStopId={targetLocationStopId} onPickRouteLocation={onPickRouteLocation} routeLocationStopId={routeLocationStopId} featureName="equipment" effectTargets={effectTargets} />
    <VisibilityEditor visibility={unit.visibility} onChange={(visibility) => onChange({ visibility })} />
    
    {error && <p className="form-error" role="alert"><AlertCircle size={15} /> {error}</p>}
    {editing && <button className="delete-button" type="button" onClick={onDelete}><Trash2 size={15} /> Delete equipment</button>}
    <div className="editor-actions"><button className="secondary" type="button" onClick={onCancel}>Cancel</button><button className="primary" type="submit" disabled={uploading}><Check size={17} /> {editing ? "Save changes" : "Save equipment"}</button></div>
  </form>;
}
