import { BADGE_FORMATIONS, BADGE_SIZES } from "./timeline.js";

export default function SizePicker({ value, onChange, label = "Badge size", formation = false }) {
  return <fieldset className={`size-picker${formation ? " formation-picker" : ""}`}><legend>{label}</legend><div>{Object.keys(BADGE_SIZES).map((size) => <label className={value === size ? "active" : ""} key={size}><input type="radio" name={label} value={size} checked={value === size} onChange={() => onChange(size)} /><span>{formation ? BADGE_FORMATIONS[size].label : size}</span></label>)}</div></fieldset>;
}
