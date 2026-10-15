import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, X } from "lucide-react";
import ExportFrameOptions from "./ExportFrameOptions.jsx";
import { formatScenarioTime } from "./timeline.js";
import useVideoRecording from "./useVideoRecording.js";

export default function VideoExportPanel({ orientation, onOrientation, showDate, onShowDate, duration, onDuration, playback, range, onPlay, onSeek, onRestart, onPrepareRecording, onCaptureFrame, onExport, onClose, frameSize, mapReady }) {
  const [error, setError] = useState("");
  const closed = useRef(false);
  const submittingRef = useRef(false);
  const preparingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const busy = preparing || submitting;
  const capture = useVideoRecording({ onPrepareRecording, onCaptureFrame, onStop: start, frameSize, mapReady });
  const locked = !!busy || capture.recording;
  const canCapture = mapReady && frameSize?.width && Math.min(frameSize.width, frameSize.height) >= 90;

  useEffect(() => {
    closed.current = false;
    return () => {
      closed.current = true;
    };
  }, []);

  async function start(take, notice = "") {
    if (closed.current || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      await onExport(take, notice);
    } catch (failure) { if (!closed.current) setError(failure.message); }
    finally {
      submittingRef.current = false;
      if (!closed.current) setSubmitting(false);
    }
  }

  async function beginRecording() {
    if (preparingRef.current || closed.current) return;
    preparingRef.current = true;
    setPreparing(true);
    setError("");
    capture.clearMessages();
    // Clear errors before measuring the new frame so the panel's own layout
    // changes cannot accidentally stop the recording.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (!closed.current) {
      capture.start();
      setPreparing(false);
    }
    preparingRef.current = false;
  }

  function close() {
    closed.current = true;
    capture.discard();
    onClose();
  }

  return <section className="video-export-panel" aria-label="Video export">
    <div className="video-export-heading"><strong>Export video</strong><span>Record your map movements. Stop to render in the background and return to editing.</span><button className="icon-button" onClick={close} aria-label="Close video export"><X size={17} /></button></div>
    <div className="video-export-controls">
      <ExportFrameOptions orientation={orientation} onOrientation={onOrientation} disabled={locked} />
      <label className="video-date-option"><input type="checkbox" checked={showDate && !!range} disabled={locked || !range} onChange={(event) => onShowDate(event.target.checked)} /> Show date</label>
      <label className="video-length">Timeline length (sec)<input type="number" min="5" max="600" step="1" value={duration} disabled={locked || !range} onChange={(event) => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 5 && value <= 600) onDuration(value); }} /></label>
      <button className="secondary" onClick={playback.playing ? playback.pause : onPlay} disabled={!!busy || !range || !mapReady} aria-label={playback.playing ? "Pause video preview" : "Play video preview"}>{playback.playing ? <Pause size={15} /> : <Play size={15} />} {playback.playing ? "Pause" : "Play"}</button>
      <button className="icon-button" onClick={onRestart} disabled={!!busy || !range || !mapReady} aria-label="Restart video preview"><RotateCcw size={17} /></button>
      <button className={`primary video-record-button${capture.recording ? " recording" : ""}`} onClick={() => capture.recording ? capture.stop() : beginRecording()} disabled={!!busy || (!capture.recording && !canCapture)}>{capture.recording ? "Stop recording" : "Start recording"}</button>
      <button className="secondary" onClick={() => start()} disabled={locked || !canCapture || !range}>Export fixed-view MP4</button>
      {capture.take && <button className="secondary" disabled={locked} onClick={() => start(capture.take)}>Render recording again</button>}
    </div>
    <div className="video-recording-status" role="status">{capture.recording ? "Recording" : capture.take ? "Recorded" : "Ready to record"} · {Math.floor(capture.elapsed / 60).toString().padStart(2, "0")}:{Math.floor(capture.elapsed % 60).toString().padStart(2, "0")}{submitting && " · Sending video…"}{capture.notice && ` · ${capture.notice}`}</div>
    {range && <div className="video-export-scrubber"><span>{formatScenarioTime(playback.cursor)}</span><input type="range" aria-label="Video preview date and time" min={range.start} max={range.end} step="any" value={playback.cursor} disabled={!!busy || !mapReady} onChange={(event) => onSeek(Number(event.target.value))} /></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {capture.error && <p className="form-error" role="alert">{capture.error}</p>}
  </section>;
}
