import { useId, useRef, useState } from "react";
import { ImagePlus, Search, X } from "lucide-react";
import { BADGE_SYMBOLS, UNIT_KINDS, UNIT_IMAGES, unitKindLabel } from "./badge.js";

const categories = ["All", "Land", "Sea", "Air", "Other"];
function category(value) {
  if (["boat", "warship", "submarine", "anchor"].includes(value)) return "Sea";
  if (["aircraft", "helicopter"].includes(value)) return "Air";
  if (["tank", "artillery", "troop", "person", "helmet", "gun", "fortress", "military-truck", "ammunition", "multiple-users"].includes(value)) return "Land";
  return "Other";
}

export default function SymbolPicker({ equipment = false, value, image, onSelect, onImage, onRemoveImage, uploading, error }) {
  const dialog = useRef(null);
  const id = useId();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const options = equipment ? UNIT_KINDS.map((kind) => ({ ...BADGE_SYMBOLS.find((item) => item.value === (kind === "troop" ? "person" : kind)), value: kind, label: unitKindLabel(kind) })) : BADGE_SYMBOLS;
  const selected = options.find((option) => option.value === value);
  const custom = equipment ? "other" : "custom";
  const visible = options.filter((option) => (filter === "All" || category(option.value) === filter) && option.label.toLowerCase().includes(query.trim().toLowerCase()));
  const art = (option) => {
    const source = option.value === custom ? image : equipment ? UNIT_IMAGES[option.value] : null;
    return <span className="symbol-option-art" aria-hidden="true">{source ? <img src={source} alt="" /> : option.paths?.length ? <svg viewBox={option.viewBox}>{option.paths.map((path) => <path key={path.d} fill="currentColor" fillRule={path.fillRule} d={path.d} />)}</svg> : option.value === custom ? <ImagePlus size={25} /> : <span>—</span>}</span>;
  };
  return <div className="symbol-picker">
    <span className="field-label">{equipment ? "Equipment type" : "Badge symbol"}</span>
    <button className="symbol-picker-trigger secondary" type="button" aria-haspopup="dialog" onClick={() => { setQuery(""); setFilter("All"); dialog.current.showModal(); }}>{selected && art(selected)}<span>{selected?.label ?? "Choose symbol"}</span><Search size={17} /></button>
    <dialog ref={dialog} className="symbol-picker-dialog" aria-labelledby={`${id}-title`} onClick={(event) => { if (event.target === event.currentTarget) dialog.current.close(); }} onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Enter" && event.target.tagName === "INPUT") event.preventDefault(); }}>
      <div className="symbol-picker-heading"><h3 id={`${id}-title`}>{equipment ? "Choose equipment" : "Choose badge symbol"}</h3><button type="button" className="icon-button" aria-label="Close symbol picker" onClick={() => dialog.current.close()}><X size={20} /></button></div>
      <div className="symbol-picker-tools"><label className="field-label">Search symbols<input autoFocus type="search" placeholder="Search by name…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="field-label">Category<select value={filter} onChange={(event) => setFilter(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label></div>
      <div className="symbol-picker-results"><div className="symbol-options">{visible.map((option) => <button type="button" key={option.value} className={`symbol-option ${value === option.value ? "active" : ""}`} aria-pressed={value === option.value} disabled={uploading} onClick={() => { onSelect(option.value); if (option.value !== custom || image) dialog.current.close(); else dialog.current.querySelector('input[type="file"]').click(); }}>{art(option)}<span className="symbol-option-label">{option.label}</span></button>)}</div>{!visible.length && <p role="status">No symbols match. Try another search or category.</p>}</div>
      <div className="symbol-picker-upload"><label className="upload-zone"><ImagePlus size={22} /><span><strong>{uploading ? "Uploading image…" : image ? "Change uploaded image" : "Upload your own picture"}</strong><small>PNG, JPEG or WebP</small></span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={onImage} /></label>{image && <div className="symbol-picker-custom"><img src={image} alt="Uploaded symbol" /><button type="button" className="secondary" disabled={uploading} onClick={() => { onSelect(custom); dialog.current.close(); }}>Use uploaded image</button>{onRemoveImage && <button type="button" className="secondary" disabled={uploading} onClick={onRemoveImage}>Remove</button>}</div>}{error && <p className="form-error" role="alert">{error}</p>}</div>
    </dialog>
  </div>;
}
