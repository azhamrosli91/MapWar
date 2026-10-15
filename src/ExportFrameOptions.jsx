import { VIDEO_FORMATS } from "./video.js";

export default function ExportFrameOptions({ orientation, onOrientation, disabled = false }) {
  return <fieldset className="video-orientations"><legend>Frame</legend>{Object.entries(VIDEO_FORMATS).map(([value, format]) => <label key={value}><input type="radio" name="export-orientation" value={value} checked={orientation === value} disabled={disabled} onChange={() => onOrientation(value)} />{format.label}</label>)}</fieldset>;
}
