import { X, Undo2, Plus, Trash2 } from "lucide-react";
import { MAX_LINE_POINTS } from "./timeline.js";

export default function LineEditor({ line, onChange, mode, onMode, onSave, onCancel, onDelete, selectedPoint, onSelectedPoint, error, mapReady, isSatellite }) {
  const textOnly = line.kind === "text";
  return <form className="editor line-editor" onSubmit={onSave}>
    <div className="editor-title"><h3>{textOnly ? "Edit text label" : "Edit line"}</h3><button type="button" className="icon-button" aria-label="Close line editor" onClick={onCancel}><X size={18} /></button></div>
    <label className="field-label" htmlFor="line-name">{textOnly ? "Label text" : "Line name / label text"}</label><input id="line-name" value={line.name} required maxLength={80} onChange={(event) => onChange({ name: event.target.value })} />
    <label className="field-label"><input type="checkbox" checked={line.showLabel ?? textOnly} onChange={(event) => onChange({ showLabel: event.target.checked })} /> Show label</label>
    {!textOnly && <label className="field-label"><input type="checkbox" checked={line.showLine !== false} onChange={(event) => onChange({ showLine: event.target.checked })} /> Show line</label>}
    <fieldset className="label-appearance"><legend>Text appearance</legend>
      <label className="field-label" htmlFor="label-font">Font style</label>
      <select id="label-font" value={line.labelFont ?? "sans-serif"} onChange={(event) => onChange({ labelFont: event.target.value })}><option value="sans-serif">Sans serif</option><option value="serif">Serif</option><option value="monospace">Monospace</option></select>
      <div className="label-style-options">
        <label><input type="checkbox" checked={line.labelBold ?? true} onChange={(event) => onChange({ labelBold: event.target.checked })} /> Bold</label>
        <label><input type="checkbox" checked={line.labelItalic ?? false} onChange={(event) => onChange({ labelItalic: event.target.checked })} /> Italic</label>
      </div>
      <label className="field-label" htmlFor="label-size">Text size</label>
      <select id="label-size" value={line.labelSize ?? 16} onChange={(event) => onChange({ labelSize: Number(event.target.value) })}>{[12, 16, 20, 24, 32].map((size) => <option key={size} value={size}>{size}px</option>)}</select>
      <label className="field-label" htmlFor="label-color">Text color</label>
      <input id="label-color" type="color" value={line.labelColor ?? (isSatellite ? "#ffffff" : "#d62828")} onChange={(event) => onChange({ labelColor: event.target.value })} />
      <label className="field-label"><input type="checkbox" checked={line.labelBackground !== undefined && line.labelBackground !== "transparent"} onChange={(event) => onChange({ labelBackground: event.target.checked ? "#ffffff" : "transparent" })} /> Badge background</label>
      {line.labelBackground && line.labelBackground !== "transparent" && <><label className="field-label" htmlFor="label-background">Badge background color</label><input id="label-background" type="color" value={line.labelBackground} onChange={(event) => onChange({ labelBackground: event.target.value })} /></>}
    </fieldset>
    {textOnly ? <><p className="field-hint">Click the map to place your label. Drag the label to move it.</p><button type="button" className="secondary" disabled={!mapReady} onClick={() => onMode("drawLine")}>{line.path.length ? "Reposition label" : "Place label"}</button></> : <>
    <fieldset className="size-picker"><legend>Line shape</legend><div>{["straight", "curve"].map((shape) => <label className={(line.shape ?? "straight") === shape ? "active" : ""} key={shape}><input type="radio" name="line-shape" checked={(line.shape ?? "straight") === shape} onChange={() => onChange({ shape })} /><span>{shape === "straight" ? "Straight" : "Curve"}</span></label>)}</div></fieldset>
    {[["startArrow", "Start"], ["endArrow", "End"]].map(([field, label]) => <fieldset className="size-picker" key={field}><legend>{label} of line</legend><div>{[false, true].map((arrow) => <label className={Boolean(line[field]) === arrow ? "active" : ""} key={String(arrow)}><input type="radio" name={field} checked={Boolean(line[field]) === arrow} onChange={() => onChange({ [field]: arrow })} /><span>{arrow ? "Arrow" : "No arrow"}</span></label>)}</div></fieldset>)}
    {line.shape === "curve" && <p className="field-hint">Finish drawing, then drag a numbered handle to reshape the curve. Drag a + handle to add or adjust a bend.</p>}
    <fieldset className="size-picker"><legend>Line style</legend><div>{["solid", "dashed"].map((style) => <label className={line.style === style ? "active" : ""} key={style}><input type="radio" name="line-style" value={style} checked={line.style === style} onChange={() => onChange({ style })} /><span>{style === "solid" ? "Solid" : "Dashed"}</span></label>)}</div></fieldset>
    <fieldset className="size-picker"><legend>Line width</legend><div>{[[3, "Thin"], [6, "Medium"], [10, "Thick"]].map(([width, label]) => <label className={line.width === width ? "active" : ""} key={width}><input type="radio" name="line-width" value={width} checked={line.width === width} onChange={() => onChange({ width })} /><span>{label}</span></label>)}</div></fieldset>
    <div className="line-swatch" style={{ background: isSatellite ? "#46566a" : "#f0f2e9" }}><span style={{ borderTopWidth: line.width, borderTopStyle: line.style, borderTopColor: isSatellite ? "#fff" : "#d62828" }} /></div>
    <p className="field-hint">{mode === "drawLine" ? "Click to place the first point, then move your cursor to preview the next segment. Click to add points. Finish drawing to adjust and save." : "Drag the handles to reshape the line. Drag a middle handle to add a point. Select a point below to remove it."}</p>
    <div className="line-actions">{mode === "drawLine" ? <><button type="button" className="secondary" disabled={!line.path.length} onClick={() => { onSelectedPoint(null); onChange({ path: line.path.slice(0, -1) }); }}><Undo2 size={15} /> Undo last point</button><button type="button" className="primary" disabled={line.path.length < 2} onClick={() => onMode("editLine")}>Finish</button></> : <button type="button" className="secondary" disabled={!mapReady || line.path.length >= MAX_LINE_POINTS} onClick={() => onMode("drawLine")}><Plus size={15} /> Add points</button>}</div>
    <label className="field-label" htmlFor="line-point">Points ({line.path.length})</label><select id="line-point" value={selectedPoint ?? ""} onChange={(event) => onSelectedPoint(event.target.value === "" ? null : Number(event.target.value))}><option value="">Select a point</option>{line.path.map((_, index) => <option value={index} key={index}>Point {index + 1}</option>)}</select>
    <button className="delete-button" type="button" disabled={selectedPoint == null || line.path.length <= 2} onClick={() => { onChange({ path: line.path.filter((_, index) => index !== selectedPoint) }); onSelectedPoint(null); }}>Remove selected point</button>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="editor-actions"><button className="primary" disabled={line.path.length < (textOnly ? 1 : 2) || mode === "drawLine"}>{textOnly ? "Save label" : "Save line"}</button><button className="secondary" type="button" onClick={onCancel}>Cancel</button></div>
    {onDelete && <button className="delete-button" type="button" onClick={onDelete}><Trash2 size={15} /> Delete line</button>}
  </form>;
}
