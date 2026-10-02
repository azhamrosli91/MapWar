import { ChevronDown, Minus, Moon, RotateCcw } from "lucide-react";
import { formatScenarioClock, formatScenarioTime, isScenarioNight } from "./timeline.js";

export default function Timeline({ range, duration, onDuration, playback, onSeek, onRestart, disabled, minimized, onMinimizedChange }) {
  if (!range) return null;
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(playback.cursor);
  const dateTime = `${date}, ${formatScenarioClock(playback.cursor)}`;
  const moon = isScenarioNight(playback.cursor) ? <Moon className="timeline-moon" size={16} role="img" aria-label="Night" /> : null;
  if (minimized) return (
    <section id="historical-timeline" className="timeline timeline-minimized" aria-label="Historical playback">
      <button className="timeline-date-button" onClick={() => onMinimizedChange(false)} aria-label={`Expand historical timeline, ${dateTime}${moon ? ", Night" : ""}`} aria-expanded={false} title="Expand historical timeline">
        <time>{dateTime}</time>{moon}<ChevronDown size={16} />
      </button>
    </section>
  );
  return (
    <section id="historical-timeline" className="timeline" aria-label="Historical playback">
      <div className="timeline-header">
        <div><span className="eyebrow">HISTORICAL TIMELINE</span><strong>{formatScenarioTime(playback.cursor)} {moon}</strong><small>Scenario time</small></div>
        <div className="timeline-header-actions">
          <button className="icon-button" onClick={() => onMinimizedChange(true)} aria-label="Minimize historical timeline" aria-expanded={true} title="Minimize historical timeline"><Minus size={18} /></button>
        </div>
      </div>
      <div className="timeline-controls">
        <button className="icon-button" onClick={onRestart} disabled={disabled} aria-label="Restart animation"><RotateCcw size={17} /></button>
        <input type="range" aria-label="Historical date and time" aria-valuetext={formatScenarioTime(playback.cursor)} min={range.start} max={range.end} step="any" value={playback.cursor} disabled={disabled} onChange={(event) => onSeek(Number(event.target.value))} />
        <label className="duration-field">Length (sec)<input type="number" min="5" max="600" step="1" key={duration} defaultValue={duration} disabled={playback.preview} onBlur={(event) => { const value = Number(event.target.value); if (event.target.value && Number.isFinite(value) && value >= 5 && value <= 600) onDuration(value); else event.target.value = duration; }} /></label>
      </div>
      <div className="timeline-range"><span>{formatScenarioTime(range.start)}</span><span>{formatScenarioTime(range.end)}</span></div>
    </section>
  );
}
