import { useCallback, useEffect, useRef, useState } from "react";

export default function usePlayback(mapRef, range, duration) {
  const [preview, setPreview] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState(null);
  const clock = useRef(null);
  const start = range?.start;
  const end = range?.end;

  const seek = useCallback((time) => {
    if (start == null || !Number.isFinite(time)) return;
    const next = Math.max(start, Math.min(end, time));
    clock.current = next;
    setPreview(true);
    setCursor(next);
    mapRef.current?.previewAt(next);
  }, [start, end, mapRef]);

  function play() {
    if (start == null) return;
    seek(clock.current == null || clock.current < start || clock.current >= end ? start : clock.current);
    setPlaying(true);
  }

  function restart() {
    setPlaying(false);
    seek(start);
  }

  function edit() {
    setPlaying(false);
    setPreview(false);
    setCursor(null);
    clock.current = null;
    mapRef.current?.previewAt(null);
  }

  useEffect(() => {
    if (!playing || start == null) return;
    let frame;
    let previous = performance.now();
    let lastPaint = 0;
    function tick(now) {
      const delta = now - previous;
      previous = now;
      clock.current = Math.min(end, (clock.current ?? start) + delta * (end - start) / (duration * 1000));
      mapRef.current?.previewAt(clock.current);
      if (now - lastPaint >= 80 || clock.current === end) {
        setCursor(clock.current);
        lastPaint = now;
      }
      if (clock.current >= end) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, start, end, duration, mapRef]);

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) {
        setPlaying(false);
        setCursor(clock.current);
      }
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);

  function pause() {
    setPlaying(false);
    setCursor(clock.current);
  }

  return { preview, playing, cursor: cursor ?? start, play, pause, restart, seek, edit };
}
