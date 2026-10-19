import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Compass, Crosshair, Flag, LoaderCircle, Maximize2, Menu, Minimize2, Minus, Pause, Play, Plus, RotateCcw, X } from "lucide-react";
import MapCanvas from "./MapCanvas.jsx";
import SharePreviewButton from "./SharePreviewButton.jsx";
import Timeline from "./Timeline.jsx";
import { hydrateSnapshot, replayRange } from "./combat.js";
import { validateProject } from "./data.js";
import { HAS_MAP_KEY } from "./maps-config.js";
import { previewRequest, previewUrl } from "./preview-client.js";
import { timelineRange } from "./timeline.js";
import usePlayback from "./usePlayback.js";

function PreviewMap({ publication, replay, mobile, headerTarget, drawerTarget, drawerOpen, onOpenOptions }) {
  const project = publication.project;
  const scene = useMemo(() => replay ? hydrateSnapshot(replay, project.battleAssets) : project, [project, replay]);
  const battleReplay = useMemo(() => replay ? { ...replay, snapshot: scene } : undefined, [replay, scene]);
  const range = useMemo(() => replay ? replayRange(replay) : timelineRange([...project.badges, ...project.units], project.groups, project.paintStrokes), [project, replay]);
  const mapRef = useRef(null);
  const [mapStatus, setMapStatus] = useState(HAS_MAP_KEY ? "loading" : "missing");
  const [minimized, setMinimized] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const playback = usePlayback(mapRef, range, project.playbackDuration);
  const ready = mapStatus === "ready";
  // The keyed viewer starts paused at the scenario's first date, without editing state.
  const initialTime = range?.start;
  const seek = playback.seek;
  useEffect(() => { if (initialTime != null) seek(initialTime); }, [initialTime, seek]);
  useEffect(() => {
    const escape = (event) => { if (event.key === "Escape" && !document.querySelector(".preview-options-drawer[open]")) setFullscreen(false); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);

  function zoomMap(change) {
    const view = mapRef.current?.getView();
    if (view) mapRef.current.restore({ ...view, zoom: Math.max(0, Math.min(22, view.zoom + change)) });
  }
  const navigation = <div className="preview-navigation-controls" aria-label="Map navigation">
    {mobile && <>
      <button type="button" disabled={!ready} onClick={() => zoomMap(1)} aria-label="Zoom in"><Plus size={17} /></button>
      <button type="button" disabled={!ready} onClick={() => zoomMap(-1)} aria-label="Zoom out"><Minus size={17} /></button>
    </>}
    <button type="button" disabled={!ready} onClick={() => mapRef.current?.setType("roadmap")}>Map</button>
    <button type="button" disabled={!ready} onClick={() => mapRef.current?.setType("satellite")}>Satellite</button>
    <button type="button" disabled={!ready} onClick={() => mapRef.current?.fitAll()}><Crosshair size={16} />Fit all</button>
    <button type="button" disabled={!ready} onClick={() => mapRef.current?.rotate(-15)} aria-label="Rotate map left">↶</button>
    <button type="button" disabled={!ready} onClick={() => mapRef.current?.resetHeading()} aria-label="Reset map north"><Compass size={17} /></button>
    <button type="button" disabled={!ready} onClick={() => mapRef.current?.rotate(15)} aria-label="Rotate map right">↷</button>
    <button type="button" onClick={() => setFullscreen((value) => !value)} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen map"}>{fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
  </div>;
  const timeline = range && <Timeline key={replay?.id ?? "timeline"} range={range} duration={project.playbackDuration} playback={playback} onSeek={(time) => { playback.pause(); playback.seek(time); }} onRestart={playback.restart}
    disabled={!ready} readOnly minimized={minimized} onMinimizedChange={setMinimized} />;

  const controls = <>
        <button type="button" className="preview-play-button primary" disabled={!ready || !range} onClick={playback.playing ? playback.pause : playback.play}>{playback.playing ? <Pause size={17} /> : <Play size={17} />}{playback.playing ? "Pause" : "Play"}</button>
        <button type="button" className="preview-restart-button" disabled={!ready || !range} onClick={playback.restart} title="Restart playback"><RotateCcw size={17} />Restart</button>
        <label className="preview-speed">Speed<select aria-label="Playback speed" disabled={!range} value={playback.speed} onChange={(event) => playback.setSpeed(Number(event.target.value))}>
          <option value={0.5}>0.5×</option><option value={1 / 1.5}>0.67×</option><option value={1}>1×</option><option value={2}>2×</option><option value={3}>3×</option>
        </select></label>
      {mobile ? fullscreen && <button type="button" className="preview-options-button secondary" aria-label="Open preview options" aria-haspopup="dialog" aria-controls="preview-options" aria-expanded={drawerOpen} onClick={onOpenOptions}><Menu size={20} /></button> : <>
        {navigation}
        {timeline && <div className="preview-toolbar-timeline">{timeline}</div>}
      </>}
    </>;
  return <section className={`preview-stage preview-viewer-stage map-stage${fullscreen ? " preview-fullscreen" : ""}`} aria-label="Read-only map preview">
    {fullscreen ? <header className="preview-header preview-fullscreen-header">{controls}</header> : headerTarget && createPortal(controls, headerTarget)}
    {mobile && drawerTarget && createPortal(<div className="preview-drawer-map-controls">{timeline}{navigation}</div>, drawerTarget)}
    <div className="preview-map-viewport">
      {HAS_MAP_KEY && <MapCanvas ref={mapRef} initialView={project.view} groups={scene.groups} badges={scene.badges} units={scene.units} lines={scene.lines} paintStrokes={scene.paintStrokes}
        readOnly mode="view" hideNavigationControls={mobile} draft={null} lineDraft={null} selectedId={null} battleReplay={battleReplay}
        preview={!!range} previewTime={playback.cursor} playing={playback.playing} animationRange={range} animationDuration={project.playbackDuration}
        onView={() => {}} onStatus={setMapStatus} />}
      {mapStatus !== "ready" && <div className="preview-map-message" role={mapStatus === "loading" ? "status" : "alert"}>
        {mapStatus === "loading" ? <><LoaderCircle className="spin" size={24} /><p>Opening the map…</p></> : <><p>{mapStatus === "missing" ? "Google Maps is not configured on this server." : "The map could not connect to Google Maps."}</p><button type="button" className="secondary" onClick={() => window.location.reload()}>Reload preview</button></>}
      </div>}
    </div>
    {!range && <p className="preview-static-notice">This map has no animated timeline. You can still explore the map.</p>}
  </section>;
}

function PreviewScene({ publication, mobile, headerTarget, drawerTarget, drawerOpen, onOpenOptions }) {
  const [replayId, setReplayId] = useState("");
  const replay = publication.project.battles.find((item) => item.id === replayId);
  const replayPicker = publication.project.battles.length > 0 && <label className="preview-replay-picker">Playback<select value={replayId} onChange={(event) => setReplayId(event.target.value)}>
      <option value="">Map timeline</option>
      {publication.project.battles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>;
  return <main className="preview-scene">
    {mobile ? drawerTarget && createPortal(replayPicker, drawerTarget) : headerTarget && createPortal(replayPicker, headerTarget)}
    <PreviewMap key={replayId} publication={publication} replay={replay} mobile={mobile} headerTarget={headerTarget} drawerTarget={drawerTarget} drawerOpen={drawerOpen} onOpenOptions={onOpenOptions} />
  </main>;
}

export default function PreviewApp() {
  const [library, setLibrary] = useState(null);
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(window.location.search).get("id") || "");
  const [publication, setPublication] = useState(null);
  const [libraryError, setLibraryError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 700px)").matches);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTarget, setDrawerTarget] = useState(null);
  const [headerTarget, setHeaderTarget] = useState(null);
  const drawerRef = useRef(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const changed = () => {
      setMobile(media.matches);
      if (!media.matches) drawerRef.current?.close();
    };
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLibraryError("");
    previewRequest("", { signal: controller.signal }).then((data) => {
      if (controller.signal.aborted) return;
      setLibrary(data.previews);
      setSelectedId((current) => {
        if (current || !data.previews.length) return current;
        const id = data.previews[0].id;
        window.history.replaceState(null, "", previewUrl(id));
        return id;
      });
    }).catch((error) => { if (!controller.signal.aborted) setLibraryError(error.message); });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    const changed = () => {
      const id = new URLSearchParams(window.location.search).get("id") || "";
      setSelectedId(id || library?.[0]?.id || "");
    };
    window.addEventListener("popstate", changed);
    return () => window.removeEventListener("popstate", changed);
  }, [library]);
  useEffect(() => {
    setPublication(null); setLoadError("");
    if (!selectedId) return;
    const controller = new AbortController();
    previewRequest(`/${encodeURIComponent(selectedId)}`, { signal: controller.signal }).then(async (data) => {
      const project = await validateProject(data.project);
      if (!controller.signal.aborted) setPublication({ ...data, project });
    }).catch((error) => { if (!controller.signal.aborted) setLoadError(error.message); });
    return () => controller.abort();
  }, [selectedId, reload]);

  const current = publication?.id === selectedId ? publication : null;
  function choose(id) {
    window.history.pushState(null, "", previewUrl(id));
    setSelectedId(id);
  }
  function openOptions() {
    drawerRef.current?.showModal();
    setDrawerOpen(true);
  }
  const scenarioPicker = <label className="preview-preset-picker">Scenario<select aria-label="Published map" value={selectedId} disabled={!library?.length} onChange={(event) => choose(event.target.value)}>
    {!selectedId && <option value="">{library === null ? "Loading previews…" : "No published previews"}</option>}
    {selectedId && !library?.some((item) => item.id === selectedId) && <option value={selectedId}>{loadError ? "Unavailable preview" : "Selected preview"}</option>}
    {library?.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
  </select></label>;
  const shareButton = current && <SharePreviewButton key={selectedId} id={selectedId} />;
  return <div className="preview-app">
    <header ref={setHeaderTarget} className="preview-header">
      <div className="preview-brand"><Flag size={25} /><div><strong>Malaya World War II</strong><small>View-only preview</small></div></div>
      {!mobile && <>{scenarioPicker}{shareButton}</>}
      {mobile && <button type="button" className="preview-options-button secondary" aria-label="Open preview options" aria-haspopup="dialog" aria-controls="preview-options" aria-expanded={drawerOpen} onClick={openOptions}><Menu size={20} /></button>}
    </header>
    <dialog ref={drawerRef} id="preview-options" className="preview-options-drawer" aria-labelledby="preview-options-title" onClose={() => {
      setDrawerOpen(false);
      if (mobile) {
        const trigger = document.querySelector(".preview-fullscreen .preview-options-button") ?? document.querySelector(".preview-app > .preview-header .preview-options-button");
        trigger?.focus();
      }
    }} onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close();
    }}>
      <div className="preview-drawer-heading"><h2 id="preview-options-title">Preview options</h2><button type="button" aria-label="Close preview options" onClick={() => drawerRef.current?.close()}><X size={20} /></button></div>
      {mobile && <div className="preview-drawer-scenario">{scenarioPicker}{shareButton}</div>}
      <div ref={setDrawerTarget} className="preview-drawer-controls" />
    </dialog>
    {(libraryError || loadError) && <div className="preview-page-message" role="alert"><p>{loadError || libraryError}</p><button className="secondary" type="button" onClick={() => setReload((value) => value + 1)}>Try again</button></div>}
    {!libraryError && library?.length === 0 && !selectedId && <div className="preview-page-message"><h1>No previews yet</h1><p>Published maps will appear here when they are available.</p></div>}
    {!loadError && ((library === null && !libraryError) || (selectedId && !current)) && <div className="preview-page-message" role="status"><LoaderCircle className="spin" size={24} /><p>Loading preview…</p></div>}
    {current && <PreviewScene key={current.id} publication={current} mobile={mobile} headerTarget={headerTarget} drawerTarget={drawerTarget} drawerOpen={drawerOpen} onOpenOptions={openOptions} />}
  </div>;
}
