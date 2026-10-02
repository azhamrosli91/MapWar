import { BADGE_SIZES } from "./timeline.js";

export default function SizePicker({ value, onChange, label = "Badge size" }) {
  return <fieldset className="size-picker"><legend>{label}</legend><div>{Object.keys(BADGE_SIZES).map((size) => <label className={value === size ? "active" : ""} key={size}><input type="radio" name={label} value={size} checked={value === size} onChange={() => onChange(size)} /><span>{size}</span></label>)}</div></fieldset>;
}
