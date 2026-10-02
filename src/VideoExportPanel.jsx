import { useEffect, useRef, useState } from "react";
import { Download, Play, Pause, RotateCcw, X } from "lucide-react";
import { VIDEO_FORMATS } from "./video.js";
import { formatScenarioTime } from "./timeline.js";

export default function VideoExportPanel({ orientation, onOrientation, showDate, onShowDate, duration, onDuration, playback, range, onPlay, onSeek, onRestart, onExport, onClose, frameSize }) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const activeId = useRef(null);
  const busy = job && ["queued", "rendering", "finishing"].includes(job.status);

  useEffect(() => {
    if (!busy) return;
    let stopped = false;
    const id = setInterval(async () => {
      try {
        const response = await fetch(`/api/video/jobs/${job.id}`);
        if (!response.ok) throw new Error("The render service stopped responding.");
        const next = await response.json();
        if (!stopped) {
          setJob(next);
          if (["completed", "failed", "cancelled"].includes(next.status)) activeId.current = null;
          if (next.status === "failed") setError(next.error || "Video export failed.");
        }
      } catch (failure) {
        if (!stopped) setError(failure.message);
      }
    }, 800);
    return () => { stopped = true; clearInterval(id); };
  }, [busy, job?.id]);

  useEffect(() => () => {
    if (activeId.current) fetch(`/api/video/jobs/${activeId.current}`, { method: "DELETE" }).catch(() => {});
  }, []);

  async function start() {
    setError("");
    setJob(null);
    try {
      const next = await onExport();
      activeId.current = next.id;
      setJob(next);
    } catch (failure) { setError(failure.message); }
  }

  async function cancel() {
    if (!job) return;
    try {
      await fetch(`/api/video/jobs/${job.id}`, { method: "DELETE" });
      activeId.current = null;
      setJob({ ...job, status: "cancelled" });
    } catch { setError("Could not cancel the export."); }
  }

  function close() {
    if (busy) cancel();
    onClose();
  }

  const file = job?.status === "completed" ? `/api/video/jobs/${job.id}/file` : null;
  return <section className="video-export-panel" aria-label="Video export">
    <div className="video-export-heading"><strong>Export video</strong><span>Pan and zoom inside the frame to choose the view.</span><button className="icon-button" onClick={close} aria-label="Close video export"><X size={17} /></button></div>
    <div className="video-export-controls">
      <fieldset className="video-orientations"><legend>Frame</legend>{Object.entries(VIDEO_FORMATS).map(([value, format]) => <label key={value}><input type="radio" name="video-orientation" value={value} checked={orientation === value} disabled={!!busy} onChange={() => onOrientation(value)} />{format.label}</label>)}</fieldset>
      <label className="video-date-option"><input type="checkbox" checked={showDate} disabled={!!busy} onChange={(event) => onShowDate(event.target.checked)} /> Show date</label>
      <label className="video-length">Length (sec)<input type="number" min="5" max="600" step="1" value={duration} disabled={!!busy} onChange={(event) => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 5 && value <= 600) onDuration(value); }} /></label>
      <button className="secondary" onClick={playback.playing ? playback.pause : onPlay} disabled={!!busy} aria-label={playback.playing ? "Pause video preview" : "Play video preview"}>{playback.playing ? <Pause size={15} /> : <Play size={15} />} Preview</button>
      <button className="icon-button" onClick={onRestart} disabled={!!busy} aria-label="Restart video preview"><RotateCcw size={17} /></button>
      <button className="primary" onClick={start} disabled={!!busy || !frameSize?.width || Math.min(frameSize.width, frameSize.height) < 90}>Export MP4</button>
      {busy && <button className="secondary" onClick={cancel}>Cancel export</button>}
    </div>
    <div className="video-export-scrubber"><span>{formatScenarioTime(playback.cursor)}</span><input type="range" aria-label="Video preview date and time" min={range.start} max={range.end} step="any" value={playback.cursor} disabled={!!busy} onChange={(event) => onSeek(Number(event.target.value))} /></div>
    {job && <div className="video-job" role="status">{job.status === "rendering" ? `Rendering ${job.progress}%` : job.status === "queued" ? "Waiting to render…" : job.status === "finishing" ? "Finishing MP4…" : job.status === "completed" ? "MP4 is ready." : job.status === "cancelled" ? "Export cancelled." : "Export failed."}{file && <><a className="secondary" href={file} download><Download size={15} /> Download MP4</a><video src={file} controls preload="metadata" aria-label="Exported video" /></>}</div>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
