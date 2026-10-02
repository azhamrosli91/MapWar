import { useEffect, useRef, useState } from "react";
import MapCanvas from "./MapCanvas.jsx";
import { validateProject } from "./data.js";
import { timelineRange } from "./timeline.js";
import { videoDate } from "./video.js";

export default function RenderApp() {
  const [snapshot, setSnapshot] = useState(null);
  const [mapStatus, setMapStatus] = useState("loading");
  const mapRef = useRef(null);
  const dateRef = useRef(null);
  const ready = useRef(false);
  const statusRef = useRef("loading");

  useEffect(() => {
    window.fieldmarkRender = {
      async load(input) {
        const project = await validateProject(input.project);
        const range = timelineRange([...project.badges, ...project.units]);
        if (input.kind !== "image" && !range) throw new Error("This map has no dated route or visibility change.");
        const sources = [...project.badges.flatMap((badge) => [badge.flag, badge.symbolImage]), ...project.units.map((unit) => unit.image)].filter(Boolean);
        await Promise.all(sources.map(async (src) => { const image = new Image(); image.src = src; await image.decode(); }));
        ready.current = false;
        setSnapshot({ ...input, project });
        return true;
      },
      get ready() { return ready.current; },
      get status() { return statusRef.current; },
      async seek(time) {
        if (!ready.current || !mapRef.current) throw new Error("The map is not ready for a frame.");
        mapRef.current.previewAt(time);
        if (dateRef.current) dateRef.current.textContent = videoDate(time);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      },
    };
    return () => { delete window.fieldmarkRender; };
  }, []);

  useEffect(() => { statusRef.current = mapStatus; ready.current = mapStatus === "ready" && !!snapshot; }, [mapStatus, snapshot]);

  if (!snapshot) return null;
  const range = timelineRange([...snapshot.project.badges, ...snapshot.project.units]);
  const imageExport = snapshot.kind === "image";
  const previewTime = imageExport ? snapshot.previewTime : range.start;
  const preview = !imageExport || Number.isFinite(snapshot.previewTime);
  return <div id="render-surface" className="render-surface">
    <MapCanvas ref={mapRef} initialView={snapshot.view} badges={snapshot.project.badges} units={snapshot.project.units} draft={null} selectedId={null} mode="export" preview={preview} previewTime={previewTime} animationRange={range} animationDuration={snapshot.duration ?? snapshot.project.playbackDuration} lines={snapshot.project.lines} paintStrokes={snapshot.project.paintStrokes} lineDraft={null} renderMode onStatus={setMapStatus} onView={() => {}} />
    {!imageExport && snapshot.showDate && <time ref={dateRef} className="video-date-stamp">{videoDate(range.start)}</time>}
  </div>;
}
