import { AlertCircle, Check, Copy, Crosshair, ImagePlus, Trash2, Upload, X } from "lucide-react";
import RouteEditor from "./RouteEditor.jsx";
import SizePicker from "./SizePicker.jsx";
import VisibilityEditor from "./VisibilityEditor.jsx";
import { UNIT_KINDS, BADGE_SYMBOLS, unitKindLabel } from "./badge.js";
import { coordinates } from "./data.js";

export default function UnitEditor({ unit, editing, onChange, onImage, onSave, onCancel, onDelete, onClone, onPlace, onMode, onFocus, onPickTargetLocation, targetLocationStopId, onPickRouteLocation, routeLocationStopId, mode, mapReady, uploading, error, effectTargets }) {
  const symbol = BADGE_SYMBOLS.find((item) => item.value === (unit.kind === "troop" ? "person" : unit.kind === "other" ? "helmet" : unit.kind));
  return <form className="editor" onSubmit={onSave}>
    <div className="editor-title"><h3>{editing ? "Edit equipment" : "New equipment"}</h3><button type="button" className="icon-button" aria-label="Close editor" onClick={onCancel}><X size={18} /></button></div>
    <div className="unit-preview"><div className={`map-unit-icon${unit.kind === "other" && unit.image ? " is-image" : ""}`} style={{ color: unit.color ?? "#ffffff" }}>{unit.kind === "other" && unit.image ? <img src={unit.image} alt="Custom equipment" /> : <svg viewBox={symbol.viewBox}>{symbol.paths.map((path) => <path key={path.d} fill="currentColor" fillRule={path.fillRule} d={path.d} />)}</svg>}</div><strong>{unit.name || "New equipment"}</strong></div>
    <label className="field-label">Name<input value={unit.name} onChange={(event) => onChange({ name: event.target.value })} maxLength={80} placeholder="e.g. 2nd Tank Regiment" required /></label>
    {editing && <button type="button" className="badge-settings-reset" onClick={onClone} disabled={uploading} title="Create a copy of this equipment"><Copy size={14} /> <span>Clone equipment</span></button>}
    <fieldset className="symbol-field">
      <legend className="field-label">Equipment type</legend>
      <div className="symbol-options">
        {UNIT_KINDS.map((kind) => {
          const option = BADGE_SYMBOLS.find((item) => item.value === (kind === "troop" ? "person" : kind));
          return <label className={`symbol-option ${unit.kind === kind ? "active" : ""}`} key={kind}>
            <input type="radio" name="unit-symbol" value={kind} checked={unit.kind === kind} onChange={() => onChange({ kind })} />
            <span className="symbol-option-art" aria-hidden="true">
              {option?.paths.length ? <svg viewBox={option.viewBox}>{option.paths.map((path) => <path key={path.d} fill="currentColor" fillRule={path.fillRule} d={path.d} />)}</svg> : <ImagePlus size={25} />}
            </span>
            <span className="symbol-option-label">{unitKindLabel(kind)}</span>
          </label>;
        })}
      </div>
    </fieldset>
    <label className="upload-zone" htmlFor="unit-image"><ImagePlus size={22} /><span><strong>{unit.image ? "Change equipment image" : "Use a custom equipment image"}</strong><small>PNG, JPG or WebP · up to 5 MB</small></span><Upload size={15} /><input id="unit-image" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={onImage} /></label>
    {unit.image && <button type="button" className="secondary" onClick={() => onChange({ image: "", ...(unit.kind === "other" ? { kind: "tank" } : {}) })}>Remove custom image</button>}
    {unit.kind !== "other" && <label className="field-label paint-color">Equipment color<input type="color" value={unit.color ?? "#ffffff"} onChange={(event) => onChange({ color: event.target.value })} /></label>}
    <p className="field-hint">Built-in equipment icons have no background. Uploaded images are cropped to a circle.</p>
    <SizePicker value={unit.size} onChange={(size) => onChange({ size })} />
    <div className="section-rule" />
    <div className="field-label location-title">Position <span>{coordinates(unit.lat, unit.lng) ? "LOCATION SET" : "CHOOSE A SPOT"}</span></div>
    <button type="button" className={`position-button ${mode === "placeUnit" ? "is-placing" : ""}`} disabled={!mapReady || unit.route.length > 0} onClick={onPlace}><Crosshair size={17} /> {mode === "placeUnit" ? "Click a location on the map" : "Choose on map"}</button>
    <div className="coordinate-fields">{["lat", "lng"].map((axis) => <label key={axis}>{axis === "lat" ? "Latitude" : "Longitude"}<input type="number" step="any" min={axis === "lat" ? -90 : -180} max={axis === "lat" ? 90 : 180} value={unit[axis]} readOnly={unit.route.length > 0} required onChange={(event) => onChange({ [axis]: event.target.value })} /></label>)}</div>
    {unit.route.length > 0 && <p className="field-hint">Edit stop A below to change the starting position.</p>}
    <VisibilityEditor visibility={unit.visibility} onChange={(visibility) => onChange({ visibility })} />
    <p className="field-hint">To fire or use other effects, add a dated route stop below and choose its effect and target. Equipment can target badges or other equipment.</p>
    <RouteEditor badge={unit} featureName="equipment" effectTargets={effectTargets} onChange={onChange} mapReady={mapReady} mode={mode} onMode={onMode} onPickTargetLocation={onPickTargetLocation} targetLocationStopId={targetLocationStopId} onPickRouteLocation={onPickRouteLocation} routeLocationStopId={routeLocationStopId} onFocus={onFocus} />
    {error && <p className="form-error" role="alert"><AlertCircle size={15} /> {error}</p>}
    <div className="editor-actions"><button className="primary" type="submit" disabled={uploading}><Check size={17} /> {editing ? "Save changes" : "Save equipment"}</button><button className="secondary" type="button" onClick={onCancel}>Cancel</button></div>
    {editing && <button className="delete-button" type="button" onClick={onDelete}><Trash2 size={15} /> Delete equipment</button>}
  </form>;
}
