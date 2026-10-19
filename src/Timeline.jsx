import { useState } from "react";
import { ChevronDown, Minus, Moon, RotateCcw } from "lucide-react";
import { formatScenarioClock, formatScenarioTime, isScenarioNight, scenarioTime } from "./timeline.js";

function pickerTime(time) {
  return new Date(time).toISOString().slice(0, 16);
}

export default function Timeline({ range, duration, onDuration, playback, onSeek, onRestart, disabled, minimized, onMinimizedChange, readOnly = false }) {
  const [selectedTime, setSelectedTime] = useState(null);
  const [dateError, setDateError] = useState("");
  if (!range) return null;
  function openDatePicker() {
    setSelectedTime(pickerTime(playback.cursor));
    setDateError("");
  }
  function showPositions(event) {
    event.preventDefault();
    const time = scenarioTime(selectedTime);
    if (time === null || time < range.start || time > range.end) {
      setDateError(`Choose a scenario time between ${formatScenarioTime(range.start)} and ${formatScenarioTime(range.end)}.`);
      return;
    }
    onSeek(time);
    setSelectedTime(null);
  }
  const datePicker = selectedTime !== null && (
    <form id="route-date-picker" className="route-date-picker" onSubmit={showPositions} noValidate onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setSelectedTime(null); } }}>
      <label className="field-label" htmlFor="route-position-time">Scenario date and time</label>
      <input id="route-position-time" type="datetime-local" step="60" min={pickerTime(range.start)} max={pickerTime(range.end)} value={selectedTime} onChange={(event) => { setSelectedTime(event.target.value); setDateError(""); }} aria-invalid={!!dateError} aria-describedby={dateError ? "route-date-error" : undefined} autoFocus />
      {dateError && <p id="route-date-error" className="field-hint" role="alert">{dateError}</p>}
      <div className="route-date-actions">
        <button type="submit" className="primary" disabled={disabled}>Show positions</button>
        <button type="button" className="secondary" onClick={() => setSelectedTime(null)}>Cancel</button>
      </div>
    </form>
  );
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(playback.cursor);
  const dateTime = `${date}, ${formatScenarioClock(playback.cursor)}`;
  const moon = isScenarioNight(playback.cursor) ? <Moon className="timeline-moon" size={16} role="img" aria-label="Night" /> : null;
  if (minimized) return (
    <section id="historical-timeline" className="timeline timeline-minimized" aria-label="Historical playback">
      <button className="timeline-date-button" onClick={openDatePicker} disabled={disabled} aria-label={`Choose route date and time, ${dateTime}${moon ? ", Night" : ""}`} aria-expanded={selectedTime !== null} aria-controls="route-date-picker" title="Show route positions by date and time">
        <time>{dateTime}</time>{moon}<ChevronDown size={16} />
      </button>
      {readOnly && <button type="button" className="icon-button" onClick={() => onMinimizedChange(false)} aria-label="Expand historical timeline" title="Expand timeline"><ChevronDown size={16} /></button>}
      {datePicker}
    </section>
  );
  return (
    <section id="historical-timeline" className="timeline" aria-label="Historical playback">
      <div className="timeline-header">
        <div><span className="eyebrow">HISTORICAL TIMELINE</span><button className="timeline-date-button" onClick={openDatePicker} disabled={disabled} aria-expanded={selectedTime !== null} aria-controls="route-date-picker" title="Show route positions by date and time">{formatScenarioTime(playback.cursor)} {moon}</button><small>Scenario time</small></div>
        <div className="timeline-header-actions">
          <button className="icon-button" onClick={() => onMinimizedChange(true)} aria-label="Minimize historical timeline" aria-expanded={true} title="Minimize historical timeline"><Minus size={18} /></button>
        </div>
      </div>
      {datePicker}
      <div className="timeline-controls">
        <button className="icon-button" onClick={onRestart} disabled={disabled} aria-label="Restart animation"><RotateCcw size={17} /></button>
        <input type="range" aria-label="Historical date and time" aria-valuetext={formatScenarioTime(playback.cursor)} min={range.start} max={range.end} step="any" value={playback.cursor} disabled={disabled} onChange={(event) => onSeek(Number(event.target.value))} />
        {!readOnly && <label className="duration-field">Length (sec)<input type="number" min="5" max="600" step="1" key={duration} defaultValue={duration} disabled={playback.preview} onBlur={(event) => { const value = Number(event.target.value); if (event.target.value && Number.isFinite(value) && value >= 5 && value <= 600) onDuration(value); else event.target.value = duration; }} /></label>}
      </div>
      <div className="timeline-range"><span>{formatScenarioTime(range.start)}</span><span>{formatScenarioTime(range.end)}</span></div>
    </section>
  );
}
