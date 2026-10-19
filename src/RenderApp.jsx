import { useEffect, useRef, useState } from "react";
import MapCanvas from "./MapCanvas.jsx";
import { validateProject } from "./data.js";
import { timelineRange } from "./timeline.js";
import { hydrateSnapshot, replayRange } from "./combat.js";
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
        const storedBattle = input.battleReplayId ? project.battles.find((replay) => replay.id === input.battleReplayId) : null;
        if (input.battleReplayId && !storedBattle) throw new Error("The selected battle replay does not exist.");
        const scene = storedBattle ? hydrateSnapshot(storedBattle, project.battleAssets) : project;
        const battle = storedBattle ? { ...storedBattle, snapshot: scene } : null;
        const range = battle ? replayRange(battle) : timelineRange([...project.badges, ...project.units]);
        if (input.kind !== "image" && !input.recording && !range) throw new Error("This map has no dated route or visibility change.");
        const sources = [...scene.badges.flatMap((badge) => [badge.flag, badge.symbolImage]), ...scene.units.map((unit) => unit.image)].filter(Boolean);
        await Promise.all(sources.map(async (src) => { const image = new Image(); image.src = src; await image.decode(); }));
        ready.current = false;
        setSnapshot({ ...input, project, scene, battle });
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
      async frame(frame) {
        if (!ready.current || !mapRef.current) throw new Error("The map is not ready for a frame.");
        await mapRef.current.renderFrame(frame.view, frame.previewTime);
        if (dateRef.current) dateRef.current.textContent = videoDate(frame.previewTime);
      },
    };
    return () => { delete window.fieldmarkRender; };
  }, []);

  useEffect(() => { statusRef.current = mapStatus; ready.current = mapStatus === "ready" && !!snapshot; }, [mapStatus, snapshot]);

  if (!snapshot) return null;
  const range = snapshot.battle ? replayRange(snapshot.battle) : timelineRange([...snapshot.project.badges, ...snapshot.project.units]);
  const imageExport = snapshot.kind === "image";
  const previewTime = imageExport ? snapshot.previewTime : snapshot.recording ? snapshot.recording.initialFrame.previewTime : range.start;
  const preview = Number.isFinite(previewTime);
  return <div id="render-surface" className="render-surface">
    <MapCanvas ref={mapRef} initialView={snapshot.recording?.initialFrame.view ?? snapshot.view} referenceZoom={snapshot.recording?.referenceZoom} groups={snapshot.scene.groups} battleReplay={snapshot.battle} badges={snapshot.scene.badges} units={snapshot.scene.units} draft={null} selectedId={null} mode="export" preview={preview} previewTime={previewTime} animationRange={range} animationDuration={snapshot.duration ?? snapshot.project.playbackDuration} lines={snapshot.scene.lines} paintStrokes={snapshot.scene.paintStrokes} lineDraft={null} renderMode onStatus={setMapStatus} onView={() => {}} />
    {!imageExport && snapshot.showDate && range && <time ref={dateRef} className="video-date-stamp">{videoDate(previewTime)}</time>}
  </div>;
}
