import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_RECORDING_FRAMES, VIDEO_FPS } from "./video.js";

export default function useVideoRecording(options) {
  const live = useRef(options);
  const session = useRef(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [take, setTake] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { live.current = options; });

  const stop = useCallback((reason = "", captureFinal = true) => {
    const current = session.current;
    if (!current) return;
    session.current = null;
    cancelAnimationFrame(current.animation);
    const frames = current.take.recording.frames;
    const count = Math.max(1, Math.min(MAX_RECORDING_FRAMES, Math.ceil((performance.now() - current.started) * VIDEO_FPS / 1000)));
    let finalFrame = current.lastFrame;
    if (captureFinal) {
      try { finalFrame = live.current.onCaptureFrame(); }
      catch (failure) { setError(failure.message); }
    }
    while (frames.length < count) frames.push(current.lastFrame);
    frames.length = count;
    frames[count - 1] = finalFrame;
    setElapsed(count / VIDEO_FPS);
    setRecording(false);
    setTake(current.take);
    setNotice(reason);
    live.current.onStop(current.take, reason);
  }, []);

  function start() {
    if (session.current) return;
    setError("");
    setNotice("");
    try {
      if (document.hidden || !live.current.mapReady) throw new Error("Keep the map visible and ready before starting a recording.");
      const next = live.current.onPrepareRecording();
      const firstFrame = live.current.onCaptureFrame();
      next.recording.frames.push(firstFrame);
      const current = { take: next, started: performance.now(), lastFrame: firstFrame, animation: null, seconds: 0 };
      session.current = current;
      setElapsed(0);
      setRecording(true);
      function tick(now) {
        if (session.current !== current) return;
        const count = Math.min(MAX_RECORDING_FRAMES, Math.floor((now - current.started) * VIDEO_FPS / 1000) + 1);
        const frames = next.recording.frames;
        if (count > frames.length) {
          let latest;
          try { latest = live.current.onCaptureFrame(); }
          catch (failure) { stop(failure.message, false); return; }
          // Hold the last observed state if the browser missed capture frames.
          while (frames.length < count - 1) frames.push(current.lastFrame);
          frames.push(latest);
          current.lastFrame = latest;
        }
        const seconds = Math.floor((now - current.started) / 1000);
        if (seconds !== current.seconds) { current.seconds = seconds; setElapsed(seconds); }
        if (now - current.started >= MAX_RECORDING_FRAMES / VIDEO_FPS * 1000) {
          stop("Recording stopped at the 10-minute limit.");
          return;
        }
        current.animation = requestAnimationFrame(tick);
      }
      current.animation = requestAnimationFrame(tick);
    } catch (failure) { setError(failure.message); }
  }

  const discard = useCallback(() => {
    if (session.current) cancelAnimationFrame(session.current.animation);
    session.current = null;
  }, []);

  useEffect(() => {
    if (!recording) return;
    const size = session.current?.take.logicalSize;
    if (!options.mapReady) stop("Recording stopped because the map became unavailable.", false);
    else if (size && (size.width !== options.frameSize?.width || size.height !== options.frameSize?.height)) {
      stop("Recording stopped because the frame size changed.", false);
    }
  }, [recording, options.mapReady, options.frameSize?.width, options.frameSize?.height, stop]);

  useEffect(() => {
    const hidden = () => { if (document.hidden) stop("Recording stopped because the tab was hidden.", false); };
    document.addEventListener("visibilitychange", hidden);
    return () => { document.removeEventListener("visibilitychange", hidden); discard(); };
  }, [stop, discard]);

  return { recording, elapsed, take, notice, error, start, stop, discard,
    clearMessages() { setError(""); setNotice(""); } };
}
