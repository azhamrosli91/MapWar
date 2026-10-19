import FeatureCard from "./FeatureCard.jsx";
import HelpTooltip from "./HelpTooltip.jsx";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Compass,
  Copy,
  Crosshair,
  Download,
  ExternalLink,
  Film,
  Flag,
  Globe2,
  HardHat,
  ImageDown,
  ImagePlus,
  Layers2,
  LoaderCircle,
  MapPin,
  Menu,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Paintbrush,
  Pencil,
  Plus,
  Play,
  Pause,
  RotateCcw,
  Route,
  Truck,
  Type,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import MapCanvas from "./MapCanvas.jsx";
import PreviewLibrary from "./PreviewLibrary.jsx";
import GroupTabs from "./GroupTabs.jsx";
import ForceSettings from "./ForceSettings.jsx";
import BattleControls from "./BattleControls.jsx";
import BattlePanel from "./BattlePanel.jsx";
import useBattle from "./useBattle.js";
import { defaultCombat, normalizeCombat, replayRange } from "./combat.js";
import MapFeatureControls from "./MapFeatureControls.jsx";
import LineEditor from "./LineEditor.jsx";
import SymbolPicker from "./SymbolPicker.jsx";
import UnitEditor from "./UnitEditor.jsx";
import RouteEditor from "./RouteEditor.jsx";
import VisibilityEditor from "./VisibilityEditor.jsx";
import PaintVisibilityEditor from "./PaintVisibilityEditor.jsx";
import SizePicker from "./SizePicker.jsx";
import Timeline from "./Timeline.jsx";
import VideoExportPanel from "./VideoExportPanel.jsx";
import VideoExportNotifications from "./VideoExportNotifications.jsx";
import PictureExportPanel from "./PictureExportPanel.jsx";
import usePlayback from "./usePlayback.js";
import useVideoJobs from "./useVideoJobs.js";
import { videoDate, videoFrameSize } from "./video.js";
import { BADGE_FORMATIONS, BADGE_SIZES, DEFAULT_SCENARIO_DATE, MAX_LINES, MAX_LINE_POINTS, MAX_STOPS, TARGET_EFFECTS, createRouteStop, insertMovementStop, nextHour, scenarioTime, startMovementRoute, routeError, timelineRange, visibilityError } from "./timeline.js";
import { HAS_MAP_KEY } from "./maps-config.js";
import { BADGE_SYMBOLS, DEFAULT_BADGE_SYMBOL, UNIT_KINDS, unitImage } from "./badge.js";
import { MAX_PAINT_POINTS, MAX_PAINT_STROKES } from "./paint.js";
import {
  checkProjectSize,
  clearInvalidFiringTargets,
  coordinates,
  EMPTY_PROJECT,
  exportProject,
  loadProject,
  MAX_BADGES,
  MAX_UNITS,
  readFlag,
  saveProject,
  validateProject,
  normalizeLine,
} from "./data.js";

const MAP_FILE_NAME_KEY = "fieldmark-current-map-file-name";
const PAINT_COLORS = [
  { name: "Blue", value: "#3478d4" },
  { name: "Teal", value: "#158f90" },
  { name: "Green", value: "#54a35a" },
  { name: "Yellow", value: "#e2b537" },
  { name: "Orange", value: "#e27b38" },
  { name: "Red", value: "#cf4d4d" },
  { name: "Purple", value: "#8b62b5" },
  { name: "Slate", value: "#62768b" },
];

function readMapFileName() {
  try {
    return window.localStorage.getItem(MAP_FILE_NAME_KEY) || "";
  } catch {
    return "";
  }
}

function BadgePreview({ badge }) {
  const symbol = BADGE_SYMBOLS.find((item) => item.value === badge.symbol);
  return (
    <div className="badge" style={{ "--badge-scale": BADGE_SIZES[badge.size] }}>
      <div className="badge-art">
        {badge.flag ? (
          <img src={badge.flag} alt="Uploaded flag" />
        ) : (
          <Flag className="empty-flag" />
        )}
        {badge.symbol === "custom" && badge.symbolImage ? <img className="custom-symbol-image" src={badge.symbolImage} alt="Custom symbol" /> : symbol?.paths.length > 0 && (
          <svg viewBox={symbol.viewBox} aria-label={`${symbol.label} symbol`}>
            {symbol.paths.map((path) => (
              <path
                key={path.d}
                fill="currentColor"
                fillRule={path.fillRule}
                d={path.d}
              />
            ))}
          </svg>
        )}
      </div>
      <div className="badge-label">{badge.label || "YOUR LABEL"}</div>
      {(badge.troopCount ?? 0) > 0 && <span className="badge-troop-count" aria-label={`${badge.troopCount} troops`}>{badge.troopCount}</span>}
      {(badge.stars ?? 0) > 0 && <div className="badge-stars">{"★".repeat(badge.stars)}</div>}
    </div>
  );
}

function SetupCard({ status }) {
  const loading = status === "loading";
  const error = status === "error";
  return (
    <section
      className="setup-card"
      aria-label="Map connection"
      aria-live="polite"
    >
      <span className="setup-icon">
        {loading ? (
          <LoaderCircle className="spin" size={30} />
        ) : error ? (
          <AlertCircle size={30} />
        ) : (
          <Globe2 size={30} />
        )}
      </span>
      <p className="eyebrow">
        {loading
          ? "CONNECTING"
          : error
            ? "CONNECTION NEEDED"
            : "YOUR WORLD, ANNOTATED"}
      </p>
      <h1>
        {loading
          ? "Opening your map."
          : error
            ? "Let’s reconnect your map."
            : "Every place has a story."}
      </h1>
      
      {!loading && !error && (
        <>
          <div className="setup-steps">
            <div>
              <span>01</span>
              <p>
                Copy <code>.env.example</code> to <code>.env.local</code>
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                Add your <code>VITE_GOOGLE_MAPS_API_KEY</code>
              </p>
            </div>
            <div>
              <span>03</span>
              <p>Restart the app to open your map</p>
            </div>
          </div>
          <a
            className="setup-link"
            href="https://developers.google.com/maps/documentation/javascript/get-api-key"
            target="_blank"
            rel="noreferrer"
          >
            Google Maps setup guide <ArrowUpRight size={16} />
          </a>
          
        </>
      )}
      {error && (
        <button className="primary" onClick={() => window.location.reload()}>
          Reload map
        </button>
      )}
    </section>
  );
}

export default function App() {
  const [previewLibraryOpen, setPreviewLibraryOpen] = useState(false);
  const [project, setProject] = useState(EMPTY_PROJECT);
  const [mapFileName, setMapFileName] = useState(readMapFileName);
  const [initialView, setInitialView] = useState(EMPTY_PROJECT.view);
  const [ready, setReady] = useState(false);
  const [canPersist, setCanPersist] = useState(true);
  const [saveStatus, setSaveStatus] = useState("loading");
  const [mapStatus, setMapStatus] = useState(
    HAS_MAP_KEY ? "loading" : "missing",
  );
  const [panelOpen, setPanelOpen] = useState(() => !window.matchMedia("(max-width: 700px)").matches);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 700px)").matches);
  const actionsDialogRef = useRef(null);
  const deleteBadgeDialogRef = useRef(null);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [timelineMinimized, setTimelineMinimized] = useState(true);
  const [showAllMovement, setShowAllMovement] = useState(false);
  const [exportKind, setExportKind] = useState(null);
  const exportOpen = exportKind !== null;
  const videoOpen = exportKind === "video";
  const pictureOpen = exportKind === "image";
  const [pictureError, setPictureError] = useState("");
  const [pictureExporting, setPictureExporting] = useState(false);
  const [exportOrientation, setExportOrientation] = useState("landscape");
  const [videoShowDate, setVideoShowDate] = useState(true);
  const [exportFrame, setExportFrame] = useState(null);
  const [exportCamera, setExportCamera] = useState(null);
  const [draft, setDraft] = useState(null);
  const [unitDraft, setUnitDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState("navigate");
  const [section, setSection] = useState("badges");
  const [cardSearch, setCardSearch] = useState({ badges: "", units: "" });
  const [paintDestination, setPaintDestination] = useState("");
  const [activeGroupId, setActiveGroupId] = useState(EMPTY_PROJECT.groups[0].id);
  const [brush, setBrush] = useState({ tool: "paint", size: "medium", shape: "circle", color: "#3478d4", opacity: 0.35 });
  const [lineDraft, setLineDraft] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [targetLocationStopId, setTargetLocationStopId] = useState(null);
  const [routeLocationStopId, setRouteLocationStopId] = useState(null);
  const placing = mode === "placeBadge";
  const [selectedId, setSelectedId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState(null);
  const [formError, setFormError] = useState("");
  const [featureMenu, setFeatureMenu] = useState(null);
  const [mapEdit, setMapEdit] = useState(null);
  const mapRef = useRef(null);
  const mapStageRef = useRef(null);
  const editingView = useRef(null);
  const importRef = useRef(null);
  const uploadSequence = useRef(0);
  const battle = useBattle(project, setProject, activeGroupId);
  const visibleProject = battle.snapshot ?? project;
  const range = useMemo(() => battle.mode === "replay" ? replayRange(battle.replay) : timelineRange([...project.badges, ...project.units], project.groups, project.paintStrokes), [battle.mode, battle.replay, project.badges, project.units, project.groups, project.paintStrokes]);
  const groupItems = (key) => project[key].filter((item) => item.groupId === activeGroupId);
  const filteredCards = (key) => groupItems(key).filter((item) => (key === "badges" ? item.label : item.name).toLowerCase().includes(cardSearch[key].trim().toLowerCase()));
  function chooseGroup(id) {
    if (!discardAllowed()) return;
    resetEditor(); setActiveGroupId(id); setSelectedId(null);
  }
  function changeGroups(next) {
    try { checkProjectSize(next); setProject(next); } catch (error) { setMessage({ error: true, text: error.message }); }
  }
  useEffect(() => {
    if (!project.groups.some((group) => group.id === activeGroupId)) setActiveGroupId(project.groups[0].id);
  }, [project.groups, activeGroupId]);
  const playback = usePlayback(mapRef, range, project.playbackDuration);
  const [replayRequested, setReplayRequested] = useState(false);
  useEffect(() => {
    if (!replayRequested || battle.mode === "command" || !range) return;
    playback.restart();
    playback.play();
    setReplayRequested(false);
    // Start after leaving route planning so command markers no longer override playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayRequested, battle.mode, range]);
  const videoJobs = useVideoJobs();

  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const updateMobile = () => {
      setMobile(media.matches);
      if (!media.matches) actionsDialogRef.current?.close();
    };
    media.addEventListener("change", updateMobile);
    return () => media.removeEventListener("change", updateMobile);
  }, []);

  function updateMapFileName(filename) {
    setMapFileName(filename);
    try {
      if (filename) window.localStorage.setItem(MAP_FILE_NAME_KEY, filename);
      else window.localStorage.removeItem(MAP_FILE_NAME_KEY);
    } catch {
      // Keep the current filename in memory when browser storage is unavailable.
    }
  }

  useEffect(() => {
    if (!mapFullscreen) return;
    const exitFullscreen = (event) => {
      if (event.key === "Escape") setMapFullscreen(false);
    };
    window.addEventListener("keydown", exitFullscreen);
    return () => window.removeEventListener("keydown", exitFullscreen);
  }, [mapFullscreen]);

  useEffect(() => {
    if (!exportOpen || !mapStageRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setExportFrame(videoFrameSize(entry.contentRect.width, entry.contentRect.height, exportOrientation));
    });
    observer.observe(mapStageRef.current);
    return () => observer.disconnect();
  }, [exportOpen, exportOrientation]);

  useEffect(() => {
    let cancelled = false;
    loadProject()
      .then((saved) => {
        if (cancelled) return;
        setProject(saved);
        setInitialView(saved.view);
      })
      .catch(() => {
        if (cancelled) return;
        setCanPersist(false);
        setSaveStatus("error");
        setMessage({
          error: true,
          text: "Saved data could not be opened. Automatic saving is paused to protect it. You can still work and export a backup.",
        });
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !canPersist) return;
    let cancelled = false;
    setSaveStatus("saving");
    saveProject(project)
      .then(() => {
        if (!cancelled) setSaveStatus("saved");
      })
      .catch(() => {
        if (cancelled) return;
        setSaveStatus("error");
        setMessage({
          error: true,
          text: "Changes are in memory but could not be saved to this browser. Export a backup before closing.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [project, ready, canPersist]);

  useEffect(() => {
    if (!message || message.error) return;
    const timeout = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    if (!dirty && saveStatus !== "saving" && saveStatus !== "error") return;
    const warnBeforeLeaving = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty, saveStatus]);

  function discardAllowed() {
    return (
      !dirty || window.confirm("Discard your unsaved edits?")
    );
  }

  function resetEditor(restoreMapFocus = true) {
    const restoreFocus = restoreMapFocus && (mapEdit?.restoreFocus ?? featureMenu?.restoreFocus);
    if (restoreFocus) requestAnimationFrame(restoreFocus);
    if (mapEdit) {
      playback.pause();
      if (mapEdit.originalTime != null) playback.seek(mapEdit.originalTime, true);
      else playback.edit();
    }
    setMapEdit(null);
    setFeatureMenu(null);
    uploadSequence.current++;
    setUploading(false);
    setDraft(null);
    setUnitDraft(null);
    setLineDraft(null);
    setSelectedPoint(null);
    setTargetLocationStopId(null);
    setRouteLocationStopId(null);
    setMode("navigate");
    setDirty(false);
    setFormError("");
  }

  function openFeatureMenu(menu) {
    if (exportOpen || mapStatus !== "ready") return;
    const time = mapEdit?.time ?? (playback.preview ? playback.getTime() ?? playback.cursor : null);
    playback.pause();
    setFeatureMenu({ ...menu, time: time == null ? null : Math.floor(time / 60000) * 60000 });
  }

  function dismissFeatureMenu() {
    featureMenu?.restoreFocus?.();
    setFeatureMenu(null);
  }

  function openEffectTargetMenu(menu) {
    if (exportOpen || mapStatus !== "ready" || mapEdit?.ui !== "movement" || menu.id === mapEdit.feature.id) return;
    const target = [...project.badges, ...project.units].find((feature) => feature.id === menu.id);
    if (!target) return;
    setFeatureMenu({ ...menu, kind: "effect", targetName: target.label ?? target.name });
  }

  function chooseMovementEffect(effect) {
    if (exportOpen || mapEdit?.ui !== "movement" || (effect !== "none" && !TARGET_EFFECTS.includes(effect))) return;
    const targetId = effect === "none" ? undefined : featureMenu?.kind === "effect" ? featureMenu.id : undefined;
    if (effect !== "none" && (!targetId || targetId === mapEdit.feature.id || ![...project.badges, ...project.units].some((feature) => feature.id === targetId))) return;
    setMapEdit((current) => {
      if (current?.ui !== "movement") return current;
      const route = current.feature.route.map((stop) => stop.dateTime === current.dateTime ? {
        ...stop, effect, firingTargetId: targetId, targetLocation: undefined,
      } : stop);
      return { ...current, feature: { ...current.feature, route }, error: "" };
    });
    setDirty(true);
    setFormError("");
    dismissFeatureMenu();
  }

  function beginMapEdit(ui) {
    if (!featureMenu || !discardAllowed()) return;
    const feature = (featureMenu.featureType === "badge" ? project.badges : project.units).find((item) => item.id === featureMenu.id);
    if (!feature) return;
    const time = featureMenu.time;
    const dateTime = time == null ? range ? new Date(range.start).toISOString().slice(0, 16) : DEFAULT_SCENARIO_DATE : new Date(time).toISOString().slice(0, 16);
    let edited = structuredClone(feature);
    if (ui === "movement" && time != null) {
      try { edited.route = startMovementRoute(feature, dateTime, mapRef.current?.sampleFeature(feature, time)); }
      catch (error) { setMessage({ error: true, text: error.message }); return; }
    }
    const session = { ...featureMenu, ui: ui === "movement" && time == null ? "start" : ui,
      feature: edited, dateTime, time, originalTime: time };
    resetEditor(false);
    playback.pause();
    if (time != null) playback.seek(time, true);
    setMapEdit(session);
    setSelectedId(feature.id);
    setMode(session.ui === "movement" ? "editMovement" : "mapEdit");
    setDirty(ui === "movement" && time != null);
  }

  function updateMapEdit(changes) {
    if (!mapEdit) return;
    if (mapEdit.ui === "start") setMapEdit({ ...mapEdit, ...changes });
    else {
      const feature = { ...mapEdit.feature, ...changes };
      if (feature.route.length) feature.route = feature.route.map((stop, index) => index === 0 ? {
        ...stop, size: feature.size, ...(mapEdit.featureType === "badge" ? { troopCount: feature.troopCount } : {}),
      } : stop);
      setMapEdit({ ...mapEdit, feature });
    }
    setDirty(true);
    setFormError("");
  }

  function startMapMovement() {
    const time = scenarioTime(mapEdit.dateTime);
    try {
      const route = startMovementRoute(mapEdit.feature, mapEdit.dateTime, time == null ? null : mapRef.current?.sampleFeature(mapEdit.feature, time));
      setMapEdit({ ...mapEdit, ui: "movement", time, feature: { ...mapEdit.feature, route } });
      setMode("editMovement");
      setDirty(true);
      setFormError("");
    } catch (error) { setFormError(error.message); }
  }

  function addMapMovementPoint(position) {
    const id = crypto.randomUUID();
    setMapEdit((current) => {
      if (current?.ui !== "movement") return current;
      try {
        const source = current.feature.route.find((stop) => stop.dateTime === current.dateTime);
        const dateTime = nextHour(current.dateTime);
        if (!dateTime) throw new Error("The next point exceeds the supported date range.");
        const route = insertMovementStop(current.feature.route, { ...structuredClone(source), ...position, id, dateTime });
        return { ...current, dateTime, time: scenarioTime(dateTime), feature: { ...current.feature, route }, error: "" };
      } catch (error) { return { ...current, error: error.message }; }
    });
    setDirty(true);
    setFormError("");
  }

  function saveMapEdit() {
    const feature = { ...mapEdit.feature };
    const nameKey = mapEdit.featureType === "badge" ? "label" : "name";
    feature[nameKey] = feature[nameKey].trim();
    if (!feature[nameKey] || feature[nameKey].length > 80) return setFormError("Enter a name of up to 80 characters.");
    if (mapEdit.featureType === "badge" && (!Number.isSafeInteger(feature.troopCount) || feature.troopCount < 0)) return setFormError("Enter a non-negative whole troop count.");
    const problem = routeError(feature.route);
    if (problem) return setFormError(problem);
    if (feature.route.length) {
      const first = feature.route[0];
      Object.assign(feature, { lat: Number(first.lat), lng: Number(first.lng), size: first.size });
      if (mapEdit.featureType === "badge") feature.troopCount = first.troopCount ?? feature.troopCount;
    }
    const collection = mapEdit.featureType === "badge" ? "badges" : "units";
    try { normalizeCombat(feature.combat, feature); } catch (error) { return setFormError(error.message); }
    const updated = { ...project, [collection]: project[collection].map((item) => item.id === feature.id ? feature : item) };
    try { checkProjectSize(updated); } catch (error) { return setFormError(error.message); }
    const time = mapEdit.time;
    setProject(updated);
    resetEditor();
    if (time != null) playback.seek(time, true);
    setMessage({ text: "Changes saved." });
  }

  function openFullMapEditor() {
    if (mapEdit.featureType === "badge" && (!Number.isSafeInteger(mapEdit.feature.troopCount) || mapEdit.feature.troopCount < 0)) {
      setFormError("Enter a non-negative whole troop count.");
      return;
    }
    const session = { ...mapEdit, ui: "full" };
    setMapEdit(session);
    if (session.featureType === "badge") { setDraft(session.feature); setSection("badges"); }
    else { setUnitDraft(session.feature); setSection("units"); }
    setMode("navigate");
    setPanelOpen(true);
  }

  function addBadge() {
    if (!discardAllowed()) return;
    if (project.badges.length >= MAX_BADGES) {
      setMessage({
        error: true,
        text: "This map has reached 500 badges. Remove a badge before adding another.",
      });
      return;
    }
    resetEditor();
    setDraft({
      id: crypto.randomUUID(),
      label: "",
      flag: "",
      groupId: activeGroupId,
      combat: defaultCombat({}),
      symbol: DEFAULT_BADGE_SYMBOL,
      symbolImage: "",
      stars: 0,
      troopCount: BADGE_FORMATIONS.M.troops,
      size: "M",
      route: [],
      visibility: { showAt: "", hideAt: "" },
      showTrail: false,
      lat: "",
      lng: "",
    });
    setSelectedId(null);
    setMode(mapStatus === "ready" ? "placeBadge" : "navigate");
    setPanelOpen(true);
  }

  function selectBadge(id) {
    if (exportOpen || battle.mode !== "edit") return;
    if (draft?.id === id) {
      setPanelOpen(true);
      return;
    }
    if (!discardAllowed()) return;
    const badge = project.badges.find((item) => item.id === id);
    if (!badge) return;
    resetEditor();
    setSelectedId(id);
    setSection("badges");
    setActiveGroupId(badge.groupId);
    playback.edit();
    setDraft({ ...badge });
    setPanelOpen(true);
    mapRef.current?.focus(badge);
  }

  function updateDraft(changes) {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, ...changes };
      if (next.route.length) {
        if (!Object.hasOwn(changes, "route")) {
          const positionChanges = Object.fromEntries(["lat", "lng", "size", "troopCount"].filter((key) => Object.hasOwn(changes, key)).map((key) => [key, changes[key]]));
          next.route = next.route.map((stop, index) => index === 0 ? { ...stop, ...positionChanges } : stop);
        }
        next.lat = next.route[0].lat;
        next.lng = next.route[0].lng;
        next.size = next.route[0].size;
      }
      return next;
    });
    setDirty(true);
    setFormError("");
  }

  function placeBadge(position) {
    updateDraft({ lat: position.lat.toFixed(6), lng: position.lng.toFixed(6) });
    setMode("navigate");
    setPanelOpen(true);
  }

  function moveBadge(id, position) {
    if (playback.preview && mapEdit?.ui !== "full") return;
    if (draft?.id === id) {
      if (!draft.route.length) updateDraft(position);
      return;
    }
    setProject((current) => ({
      ...current,
      badges: current.badges.map((badge) =>
        badge.id === id && !badge.route.length ? { ...badge, ...position } : badge,
      ),
    }));
  }

  function addUnit() {
    if (!discardAllowed()) return;
    if (project.units.length >= MAX_UNITS) return setMessage({ error: true, text: `This map has reached ${MAX_UNITS} equipment items.` });
    resetEditor();
    setUnitDraft({ id: crypto.randomUUID(), name: "", groupId: activeGroupId, quantity: 1, combat: defaultCombat({ kind: "tank" }), kind: "tank", image: "", size: "M", route: [], visibility: { showAt: "", hideAt: "" }, showTrail: false, lat: "", lng: "" });
    setSection("units");
    setSelectedId(null);
    setMode(mapStatus === "ready" ? "placeUnit" : "navigate");
    setPanelOpen(true);
  }

  function selectUnit(id) {
    if (exportOpen || battle.mode !== "edit") return;
    if (unitDraft?.id === id) { setPanelOpen(true); return; }
    if (!discardAllowed()) return;
    const unit = project.units.find((item) => item.id === id);
    if (!unit) return;
    resetEditor();
    setActiveGroupId(unit.groupId);
    playback.edit();
    setUnitDraft({ ...unit });
    setSection("units");
    setSelectedId(id);
    setPanelOpen(true);
    mapRef.current?.focus(unit);
  }

  function updateUnit(changes) {
    setUnitDraft((current) => {
      if (!current) return current;
      const next = { ...current, ...changes };
      if (next.route.length) {
        if (!Object.hasOwn(changes, "route")) {
          const firstChanges = Object.fromEntries(["lat", "lng", "size"].filter((key) => Object.hasOwn(changes, key)).map((key) => [key, changes[key]]));
          next.route = next.route.map((stop, index) => index === 0 ? { ...stop, ...firstChanges } : stop);
        }
        next.lat = next.route[0].lat;
        next.lng = next.route[0].lng;
        next.size = next.route[0].size;
      }
      return next;
    });
    setDirty(true);
    setFormError("");
  }

  function moveUnit(id, position) {
    if (playback.preview && mapEdit?.ui !== "full") return;
    if (unitDraft?.id === id) {
      if (!unitDraft.route.length) updateUnit(position);
      return;
    }
    setProject((current) => ({ ...current, units: current.units.map((unit) => unit.id === id && !unit.route.length ? { ...unit, ...position } : unit) }));
  }

  function saveUnit(event) {
    event.preventDefault();
    if (!unitDraft.name.trim()) return setFormError("Give your equipment a name.");
    if (!Number.isSafeInteger(unitDraft.quantity) || unitDraft.quantity < 0 || unitDraft.quantity > 1e9) return setFormError("Enter a valid equipment quantity.");
    try { normalizeCombat(unitDraft.combat, unitDraft); } catch (error) { return setFormError(error.message); }
    const position = coordinates(unitDraft.lat, unitDraft.lng);
    if (!position) return setFormError("Choose a location or enter valid coordinates.");
    const problem = routeError(unitDraft.route);
    if (problem) return setFormError(problem);
    const visibilityProblem = visibilityError(unitDraft.visibility);
    if (visibilityProblem) return setFormError(visibilityProblem);
    const unit = { ...unitDraft, ...position, name: unitDraft.name.trim(), route: unitDraft.route.map((stop) => ({ ...stop, lat: Number(stop.lat), lng: Number(stop.lng), targetLocation: stop.targetLocation ? { lat: Number(stop.targetLocation.lat), lng: Number(stop.targetLocation.lng) } : undefined })) };
    const exists = project.units.some((item) => item.id === unit.id);
    const updated = { ...project, units: exists ? project.units.map((item) => item.id === unit.id ? unit : item) : [...project.units, unit] };
    try { checkProjectSize(updated); } catch (error) { return setFormError(error.message); }
    setProject(updated);
    setSelectedId(unit.id);
    resetEditor();
    setMessage({ text: exists ? "Equipment updated." : "Equipment added. Click it to edit." });
  }

  function deleteUnit() {
    if (!window.confirm(`Delete “${unitDraft.name}” from this map?`)) return;
    setProject((current) => clearInvalidFiringTargets({ ...current, units: current.units.filter((unit) => unit.id !== unitDraft.id) }));
    resetEditor();
    setSelectedId(null);
  }

  function chooseOnMap() {
    setMode(placing ? "navigate" : "placeBadge");
    if (!placing && window.matchMedia("(max-width: 700px)").matches)
      setPanelOpen(false);
  }

  function changeView(view) {
    if (exportOpen) { setExportCamera(view); return; }
    if (playback.preview) return;
    setProject((current) =>
      JSON.stringify(current.view) === JSON.stringify(view)
        ? current
        : { ...current, view },
    );
  }

  async function uploadFlag(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const sequence = ++uploadSequence.current;
    setUploading(true);
    setFormError("");
    try {
      const flag = await readFlag(file);
      if (sequence === uploadSequence.current) updateDraft({ flag });
    } catch (error) {
      if (sequence === uploadSequence.current) setFormError(error.message);
    } finally {
      if (sequence === uploadSequence.current) setUploading(false);
    }
  }

  async function uploadFeatureImage(event, target) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const sequence = ++uploadSequence.current;
    setUploading(true);
    setFormError("");
    try {
      const image = await readFlag(file);
      if (sequence === uploadSequence.current) {
        if (target === "badge") updateDraft({ symbol: "custom", symbolImage: image });
        else updateUnit({ image, kind: "other" });
      }
    } catch (error) {
      if (sequence === uploadSequence.current) setFormError(error.message);
    } finally {
      if (sequence === uploadSequence.current) setUploading(false);
    }
  }

  function commitBadge(event) {
    event.preventDefault();
    const position = coordinates(draft.lat, draft.lng);
    try { normalizeCombat(draft.combat, draft); } catch (error) { return setFormError(error.message); }
    if (!Number.isSafeInteger(draft.troopCount) || draft.troopCount < 0) return setFormError("Enter a valid soldier count.");
    if (!draft.label.trim()) return setFormError("Give your badge a label.");
    if (!draft.flag) return setFormError("Upload a flag image for this badge.");
    if (draft.symbol === "custom" && !draft.symbolImage) return setFormError("Upload an image for the custom badge symbol.");
    if (!position)
      return setFormError(
        "Select a map location or enter valid latitude and longitude.",
      );
    const routeProblem = routeError(draft.route);
    if (routeProblem) return setFormError(routeProblem);
    const visibilityProblem = visibilityError(draft.visibility);
    if (visibilityProblem) return setFormError(visibilityProblem);
    const badge = { ...draft, ...position, label: draft.label.trim(), route: draft.route.map((stop) => ({ ...stop, lat: Number(stop.lat), lng: Number(stop.lng), targetLocation: stop.targetLocation ? { lat: Number(stop.targetLocation.lat), lng: Number(stop.targetLocation.lng) } : undefined })) };
    const updated = {
      ...project,
      badges: project.badges.some((item) => item.id === badge.id)
        ? project.badges.map((item) => (item.id === badge.id ? badge : item))
        : [...project.badges, badge],
    };
    try {
      checkProjectSize(updated);
    } catch (error) {
      return setFormError(error.message);
    }
    setProject(updated);
    setSelectedId(badge.id);
    resetEditor();
    setMessage({
      text: editing
        ? "Badge updated."
        : "Badge added. Click its marker or list entry to edit it.",
    });
  }

  function cloneUnit() {
    if (!unitDraft) return;
    if (project.units.length >= MAX_UNITS) {
      setMessage({ error: true, text: `This map has reached ${MAX_UNITS} equipment items. Remove equipment before cloning another.` });
      return;
    }
    const clone = {
      ...structuredClone(unitDraft),
      id: crypto.randomUUID(),
      name: `${unitDraft.name.trim().slice(0, 73)} (copy)`,
      route: unitDraft.route.map((stop) => ({ ...structuredClone(stop), id: crypto.randomUUID() })),
    };
    resetEditor();
    setUnitDraft(clone);
    setSelectedId(null);
    setSection("units");
    const initialStopId = clone.route[0]?.id;
    const canPlaceOnMap = mapStatus === "ready";
    setRouteLocationStopId(canPlaceOnMap ? initialStopId ?? null : null);
    setMode(canPlaceOnMap ? initialStopId ? "repointStop" : "placeUnit" : "navigate");
    setPanelOpen(!canPlaceOnMap || !window.matchMedia("(max-width: 700px)").matches);
    setMessage({ text: canPlaceOnMap ? "Equipment copied. Click the map to set the copy’s location, then save it." : "Equipment copied. Choose a location for the copy, then save it." });
  }

  function cloneBadge() {
    if (!draft) return;
    if (project.badges.length >= MAX_BADGES) {
      setMessage({ error: true, text: `This map has reached ${MAX_BADGES} badges. Remove a badge before cloning another.` });
      return;
    }
    const clone = {
      ...draft,
      id: crypto.randomUUID(),
      label: `${draft.label.trim()} (copy)`.slice(0, 80),
      route: draft.route.map((stop) => ({ ...stop, id: crypto.randomUUID() })),
      visibility: { ...draft.visibility },
    };
    resetEditor();
    setDraft(clone);
    setSelectedId(null);
    setSection("badges");
    const initialStopId = clone.route[0]?.id;
    const canPlaceOnMap = mapStatus === "ready";
    const placementMode = initialStopId ? "repointStop" : "placeBadge";
    setRouteLocationStopId(canPlaceOnMap ? initialStopId ?? null : null);
    setMode(canPlaceOnMap ? placementMode : "navigate");
    setPanelOpen(!canPlaceOnMap || !window.matchMedia("(max-width: 700px)").matches);
    setMessage({ text: canPlaceOnMap ? "Badge copied. Click the map to set the copy’s location, then save it." : "Badge copied. Choose a location for the copy, then save it." });
  }

  function deleteBadge() {
    if (!draft || !editing) return;
    deleteBadgeDialogRef.current?.close();
    setProject((current) => clearInvalidFiringTargets({
      ...current,
      badges: current.badges.filter((badge) => badge.id !== draft.id),
    }));
    resetEditor();
    setSelectedId(null);
    setMessage({ text: "Badge deleted." });
  }

  function createNewMap() {
    if (!discardAllowed()) return;
    const hasMapData = project.battles.length || project.groups.length > 1 || project.badges.length || project.units.length || project.lines.length || project.paintStrokes.length ||
      project.playbackDuration !== EMPTY_PROJECT.playbackDuration ||
      JSON.stringify(project.view) !== JSON.stringify(EMPTY_PROJECT.view);
    if (hasMapData && !window.confirm("Start a new map? This clears the current badges, equipment, lines, paint, and map settings. Export a backup first if you want to keep them.")) return;

    const freshProject = {
      ...EMPTY_PROJECT,
      view: {
        ...EMPTY_PROJECT.view,
        center: { ...EMPTY_PROJECT.view.center },
      },
    };
    resetEditor();
    playback.edit();
    setSelectedId(null);
    setSection("badges");
    battle.edit();
    setProject(freshProject);
    setActiveGroupId(freshProject.groups[0].id);
    updateMapFileName("");
    setInitialView(freshProject.view);
    editingView.current = null;
    mapRef.current?.restore(freshProject.view);
    setPanelOpen(true);
    setTimelineMinimized(true);
    setMessage({ text: "New map created." });
  }

  async function importMap(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      if (file.size > 25 * 1024 * 1024)
        throw new Error("Choose a map file smaller than 25 MB.");
      let parsed;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        throw new Error("This is not a valid JSON map file.");
      }
      const incoming = await validateProject(parsed);
      if (
        !window.confirm(
          `Replace this map and any unsaved edits with ${incoming.badges.length} imported badge${incoming.badges.length === 1 ? "" : "s"}? Export first if you need a backup.`,
        )
      )
        return;
      resetEditor();
      playback.edit();
      setSelectedId(null);
      battle.edit();
      setProject(incoming);
      setActiveGroupId(incoming.groups[0].id);
      updateMapFileName(file.name);
      mapRef.current?.restore(incoming.view);
      setMessage({
        text: `Imported ${incoming.badges.length} badge${incoming.badges.length === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      setMessage({ error: true, text: error.message });
    } finally {
      setImporting(false);
    }
  }

  function renameMap() {
    const requestedName = window.prompt("Rename map", mapFileName || "My field map");
    if (requestedName === null) return;
    const name = requestedName.trim();
    if (!name) return;
    updateMapFileName(name);
    setMessage({ text: "Map renamed." });
  }

  function downloadMap() {
    const defaultName = mapFileName.replace(/\.json$/i, "") || `malaya-world-war-ii-${new Date().toISOString().slice(0, 10)}`;
    const requestedName = window.prompt("Export map as (without .json)", defaultName);
    if (requestedName === null) return;

    try {
      updateMapFileName(exportProject(project, requestedName));
      setMessage({
        text: draft || unitDraft || lineDraft
          ? "Map exported. Unsaved edits are not included."
          : "Map exported with all your flag images.",
      });
    } catch {
      setMessage({
        error: true,
        text: "The map could not be exported. Please try again.",
      });
    }
  }

  async function downloadPicture() {
    const view = mapRef.current?.getView();
    if (!pictureOpen || !view || pictureExporting || mapStatus !== "ready") return;
    setPictureError("");
    setPictureExporting(true);
    try {
      checkProjectSize(project);
      const logicalSize = exportFrame;
      if (!logicalSize || logicalSize.width < 90 || logicalSize.height < 90) throw new Error("Make the map area larger before downloading a picture.");
      const scale = Math.max(0.5, Math.floor(Math.min(2, 4096 / logicalSize.width, 4096 / logicalSize.height, Math.sqrt(16_000_000 / (logicalSize.width * logicalSize.height))) * 100) / 100);
      const response = await fetch("/api/map/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "image", project, battleReplayId: battle.mode === "replay" ? battle.replayId : undefined, view, logicalSize, scale, previewTime: playback.preview ? playback.cursor : null }),
      }).catch(() => { throw new Error("The local renderer is unavailable. Start Malaya World War II with npm run dev."); });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "The map picture could not be created.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `malaya-world-war-ii-map-${exportOrientation}-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage({ text: "Map picture downloaded." });
    } catch (error) {
      setPictureError(error.message || "The map picture could not be created.");
    } finally {
      setPictureExporting(false);
    }
  }

  const editing =
    draft && project.badges.some((badge) => badge.id === draft.id);
  const hasPosition = draft && coordinates(draft.lat, draft.lng);
  const isSatellite = ["satellite", "hybrid"].includes(project.view.mapTypeId);

  function switchSection(next) {
    if (!discardAllowed()) return;
    resetEditor();
    if (mode === "paint") setMode("navigate");
    setSection(next);
  }

  function changeMode(next) {
    if (next !== "placeEffectTarget") setTargetLocationStopId(null);
    if (next !== "repointStop") setRouteLocationStopId(null);
    setMode(next);
    if (["addStop", "drawLine", "repointStop"].includes(next) && window.matchMedia("(max-width: 700px)").matches) setPanelOpen(false);
  }

  function pickTargetLocation(stopId) {
    if (mode === "placeEffectTarget" && targetLocationStopId === stopId) {
      setTargetLocationStopId(null);
      setMode("navigate");
      return;
    }
    setRouteLocationStopId(null);
    setTargetLocationStopId(stopId);
    setMode("placeEffectTarget");
    if (window.matchMedia("(max-width: 700px)").matches) setPanelOpen(false);
  }

  function pickRouteLocation(stopId) {
    if (mode === "repointStop" && routeLocationStopId === stopId) {
      setRouteLocationStopId(null);
      setMode("navigate");
      return;
    }
    setTargetLocationStopId(null);
    setRouteLocationStopId(stopId);
    setMode("repointStop");
    if (window.matchMedia("(max-width: 700px)").matches) setPanelOpen(false);
  }

  function updateLine(changes) {
    if (changes.path?.length > MAX_LINE_POINTS) return setFormError(`A line can contain up to ${MAX_LINE_POINTS} points.`);
    if (changes.path && selectedPoint != null && selectedPoint >= changes.path.length) setSelectedPoint(null);
    setLineDraft((current) => current ? { ...current, ...changes } : current);
    setDirty(true);
    setFormError("");
  }

  function addLine(kind = "line") {
    if (!discardAllowed()) return;
    if (project.lines.length >= MAX_LINES) return setMessage({ error: true, text: `This map has reached ${MAX_LINES} lines.` });
    resetEditor();
    setLineDraft({ id: crypto.randomUUID(), groupId: activeGroupId, kind, showLine: true, showLabel: kind === "text", name: kind === "text" ? "New label" : `Line ${project.lines.length + 1}`, style: "solid", shape: "straight", startArrow: false, endArrow: false, width: 3, path: [] });
    setSelectedId(null);
    setSection(kind === "text" ? "text" : "lines");
    changeMode("drawLine");
  }

  function selectLine(id) {
    if (playback.preview && mapEdit?.ui !== "full") return;
    if (lineDraft?.id === id) { setPanelOpen(true); return; }
    if (!discardAllowed()) return;
    const line = project.lines.find((item) => item.id === id);
    if (!line) return;
    resetEditor();
    setActiveGroupId(line.groupId);
    setLineDraft({ ...line, path: line.path.map((point) => ({ ...point })) });
    setSection(line.kind === "text" ? "text" : "lines");
    setSelectedId(null);
    setMode("editLine");
    setPanelOpen(true);
  }

  function saveLine(event) {
    event.preventDefault();
    try {
      const line = normalizeLine(lineDraft);
      const updated = { ...project, lines: project.lines.some((item) => item.id === line.id) ? project.lines.map((item) => item.id === line.id ? line : item) : [...project.lines, line] };
      checkProjectSize(updated);
      setProject(updated);
      resetEditor();
      setMessage({ text: "Saved. Click it on the map or in the list to edit." });
    } catch (error) { setFormError(error.message); }
  }

  function deleteLine() {
    if (!window.confirm(`Delete “${lineDraft.name}” from this map?`)) return;
    setProject((current) => ({ ...current, lines: current.lines.filter((line) => line.id !== lineDraft.id) }));
    resetEditor();
  }

  function mapPoint(position) {
    if (mode === "editMovement" && mapEdit?.ui === "movement") { addMapMovementPoint(position); return; }
    if (playback.preview && mapEdit?.ui !== "full") return;
    if (mode === "placeBadge") placeBadge(position);
    if (mode === "placeUnit") { updateUnit({ lat: position.lat.toFixed(6), lng: position.lng.toFixed(6) }); setMode("navigate"); setPanelOpen(true); }
    if (mode === "drawLine" && lineDraft) {
      updateLine({ path: lineDraft.kind === "text" ? [position] : [...lineDraft.path, position] });
      if (lineDraft.kind === "text") { setMode("editLine"); setPanelOpen(true); }
    }
    const routeFeature = draft ?? unitDraft;
    if (mode === "placeEffectTarget" && routeFeature && targetLocationStopId) {
      const targetLocation = { lat: position.lat.toFixed(6), lng: position.lng.toFixed(6) };
      const route = routeFeature.route.map((stop) => stop.id === targetLocationStopId ? { ...stop, firingTargetId: undefined, targetLocation } : stop);
      if (draft) updateDraft({ route }); else updateUnit({ route });
      setTargetLocationStopId(null);
      setMode("navigate");
      setPanelOpen(true);
      return;
    }
    if (mode === "repointStop" && routeFeature && routeLocationStopId) {
      const route = routeFeature.route.map((stop) => stop.id === routeLocationStopId ? { ...stop, ...position } : stop);
      if (draft) updateDraft({ route }); else updateUnit({ route });
      setRouteLocationStopId(null);
      setMode("navigate");
      setPanelOpen(true);
      return;
    }
    if (mode === "addStop" && routeFeature?.route.length && routeFeature.route.length < MAX_STOPS) {
      const changes = { route: [...routeFeature.route, createRouteStop(routeFeature.route, position)] };
      if (draft) updateDraft(changes); else updateUnit(changes);
      setMode("navigate");
      setPanelOpen(true);
    }
  }

  function moveStop(id, position) {
    const feature = draft ?? unitDraft;
    if (!feature || (playback.preview && mapEdit?.ui !== "full")) return;
    const changes = { route: feature.route.map((stop) => stop.id === id ? { ...stop, ...position } : stop) };
    if (draft) updateDraft(changes); else updateUnit(changes);
  }

  function resumeSidebarEditing() {
    if (playback.preview && !playback.playing && !exportOpen && !mapEdit) playback.edit();
  }

  function beginPreview(action) {
    if (battle.mode === "command") battle.edit();
    if (!playback.preview || mapEdit) {
      if (!discardAllowed()) return;
      resetEditor();
      if (window.matchMedia("(max-width: 700px)").matches) setPanelOpen(false);
    }
    if (action === playback.play) setPanelOpen(false);
    action();
  }

  function playBattleReplay() {
    if (playback.playing) { playback.pause(); return; }
    if (!discardAllowed()) return;
    setPanelOpen(false);
    if (battle.mode === "command") {
      battle.edit();
      resetEditor();
      playback.edit();
      setReplayRequested(true);
      setTimelineMinimized(false);
      return;
    }
    beginPreview(playback.play);
  }

  function openExport(kind) {
    if (exportOpen || mapStatus !== "ready" || !discardAllowed() || battle.mode === "command") return;
    const view = mapRef.current?.getView();
    if (!view) return;
    editingView.current = view;
    setExportCamera(view);
    setMapStatus("loading");
    setMapFullscreen(false);
    if (kind === "video") playback.edit();
    else playback.pause();
    resetEditor();
    setExportOrientation("landscape");
    setVideoShowDate(true);
    setPictureError("");
    setTimelineMinimized(true);
    setExportKind(kind);
    if (window.matchMedia("(max-width: 700px)").matches) setPanelOpen(false);
  }

  function closeExport() {
    if (pictureExporting) return;
    if (videoOpen) playback.edit();
    setExportKind(null);
    setExportFrame(null);
    setExportCamera(null);
  }

  function orientExport(next) {
    setExportCamera(mapRef.current?.getView() ?? exportCamera);
    setMapStatus("loading");
    setExportOrientation(next);
  }

  function prepareVideoRecording() {
    if (!exportFrame?.width || Math.min(exportFrame.width, exportFrame.height) < 90) throw new Error("Make the window larger to prepare the video frame.");
    const view = mapRef.current?.getView();
    if (!view) throw new Error("The map is not ready.");
    checkProjectSize(project);
    return { project: structuredClone(project), battleReplayId: battle.mode === "replay" ? battle.replayId : undefined, view, orientation: exportOrientation, showDate: videoShowDate && !!range, logicalSize: { ...exportFrame }, duration: project.playbackDuration,
      recording: { referenceZoom: mapRef.current.getReferenceZoom(), frames: [] } };
  }

  function captureVideoFrame() {
    const view = mapRef.current?.getView();
    if (!view) throw new Error("The map is no longer available. Your recording has been kept.");
    return { view, previewTime: playback.getTime() };
  }

  function startVideoExport(take, notice = "") {
    const input = take ?? prepareVideoRecording();
    if (!take) {
      if (!range) throw new Error("Add a dated route or use Start recording to record this map.");
      delete input.recording;
    }
    videoJobs.start(input, mapFileName, notice);
    closeExport();
  }

  const timeline = <Timeline range={range} duration={project.playbackDuration} onDuration={(playbackDuration) => setProject((current) => ({ ...current, playbackDuration }))} playback={playback} onRestart={() => beginPreview(playback.restart)} onSeek={(time) => beginPreview(() => { playback.pause(); playback.seek(time); })} disabled={mapStatus !== "ready" || !!mapEdit} minimized={timelineMinimized} onMinimizedChange={setTimelineMinimized} />;

  const playbackSpeed = <select className="playback-speed" aria-label="Playback speed" title="Playback speed" value={playback.speed} onChange={(event) => playback.setSpeed(Number(event.target.value))}>
    <option value={1}>Normal (1×)</option>
    <option value={2}>Fast (2×)</option>
    <option value={3}>Fast (3×)</option>
    <option value={1 / 1.5}>1.5× slower (0.67×)</option>
    <option value={0.5}>Slower (0.5×)</option>
  </select>;
  const battleControls = !exportOpen && <BattleControls battle={battle} mapReady={mapStatus === "ready"} playback={playback} previewTime={playback.getTime() ?? playback.cursor ?? range?.start ?? null} beforeStart={() => { if (!discardAllowed()) return false; resetEditor(); playback.pause(); setPanelOpen(false); return true; }} />;
  const movementControl = <button type="button" className={`map-button${showAllMovement ? " active" : ""}`} disabled={mapStatus !== "ready"} aria-pressed={showAllMovement} onClick={() => setShowAllMovement((show) => !show)}>
    <Route size={17} />
    <span>Show all movement</span>
  </button>;
  const pictureControl = <button className="map-button image-export-toolbar-button" disabled={!ready || mapStatus !== "ready" || pictureExporting || exportOpen} onClick={() => openExport("image")} aria-label="Download map picture" title="Download map picture">
    {pictureExporting ? <LoaderCircle size={16} className="spin" /> : <ImageDown size={16} />}
    <span>{pictureExporting ? "Creating picture…" : "Download picture"}</span>
  </button>;
  const fullscreenControl = <button
    className="map-button fullscreen-button"
    onClick={() => setMapFullscreen((current) => !current)}
    aria-label={mapFullscreen ? "Exit full screen map" : "Show full screen map"}
    aria-pressed={mapFullscreen}
    title={mapFullscreen ? "Exit full screen map (Esc)" : "Show full screen map"}
  >
    {mapFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
    <span>{mapFullscreen ? "Exit full screen" : "Full screen"}</span>
  </button>;

  const secondaryActions = (<div className="secondary-actions" inert={battle.mode === "command"}>
            <button className="export-button" aria-label="Preview library" title="Preview library" disabled={!ready || importing || exportOpen || battle.mode === "command"} onClick={() => { playback.pause(); setPreviewLibraryOpen(true); }}><ExternalLink size={16} /><span>Preview library</span></button>
            <button
              className="new-map-button"
              disabled={!ready || importing || playback.playing || exportOpen}
              onClick={createNewMap}
              title="Start a new map"
            >
              <Plus size={16} />
              <span>New</span>
            </button>
            <button
              className="text-button"
              disabled={!ready || importing || playback.playing || exportOpen}
              onClick={() => importRef.current.click()}
            >
              {importing ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Upload size={16} />
              )}
              <span>Import</span>
            </button>
            <button
              className="export-button"
              disabled={!ready}
              onClick={downloadMap}
            >
              <Download size={16} />
              <span>Export map</span>
            </button>
            <button className="export-button" disabled={!ready || mapStatus !== "ready" || exportOpen} onClick={() => openExport("video")}><Film size={16} /><span>Export video</span></button>
  </div>);

  return (
      <div className={`app${mapFullscreen ? " map-fullscreen" : ""}`}>
      {previewLibraryOpen && <PreviewLibrary project={project} mapFileName={mapFileName} hasDraft={!!(draft || unitDraft || lineDraft || mapEdit || dirty || battle.mode === "command")} onClose={() => setPreviewLibraryOpen(false)} />}
      <dialog ref={deleteBadgeDialogRef} className="group-name-dialog delete-badge-dialog" aria-labelledby="delete-badge-title" aria-describedby="delete-badge-description" onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
        <h3 id="delete-badge-title">Delete badge</h3>
        <p id="delete-badge-description">Are you sure you want to delete {draft?.label || "this badge"}?</p>
        <div className="delete-badge-actions">
          <button type="button" className="secondary" autoFocus onClick={() => deleteBadgeDialogRef.current?.close()}>No</button>
          <button type="button" className="primary" onClick={deleteBadge}>Yes</button>
        </div>
      </dialog>
      <dialog ref={actionsDialogRef} id="mobile-map-actions" className="mobile-actions-dialog" aria-labelledby="mobile-actions-title" onClick={(event) => { if (event.target === event.currentTarget || (event.target.closest("button:not(:disabled)") && event.target.closest("dialog") === event.currentTarget)) event.currentTarget.close(); }}>
        <div className="mobile-actions-panel">
          <div className="mobile-actions-heading"><h2 id="mobile-actions-title">Map actions</h2><button className="icon-button" aria-label="Close map actions" onClick={() => actionsDialogRef.current?.close()}><X size={20} /></button></div>
          <div className="mobile-actions-list">
            {mobile && !exportOpen && <label className="mobile-playback-speed">Playback speed{playbackSpeed}</label>}
            {mobile && battleControls}
            {mobile && !exportOpen && <>{movementControl}{pictureControl}{fullscreenControl}</>}
            {secondaryActions}
          </div>
        </div>
      </dialog>
      <header className="app-header">
        <div className="topbar">
          <a
            className="brand"
            href="#"
            onClick={(event) => event.preventDefault()}
            aria-label="Malaya World War II home"
          >
            <span className="brand-mark">
              <Flag size={23} strokeWidth={1.7} />
            </span>
            <span>
              Malaya World War II
            </span>
          </a>
          <div className="header-divider" />
          <button
            type="button"
            className="workspace-name"
            title={`Rename ${mapFileName || "My field map"}`}
            aria-label={`Rename map: ${mapFileName || "My field map"}`}
            disabled={!ready || importing}
            onClick={renameMap}
          >
            <span>{mapFileName || "My field map"}</span>
            <Pencil size={13} />
          </button>
          <div className="header-actions">
            {!exportOpen && <>
              <button type="button" className="text-button header-play-button" disabled={mapStatus !== "ready" || battle.busy || !range} onClick={playBattleReplay} aria-label={playback.playing ? "Pause movement routes" : "Play movement routes"}>{playback.playing ? <Pause size={17} /> : <Play size={17} />}<span>{playback.playing ? "Pause" : "Play"}</span></button>
              {!mobile && playbackSpeed}
              <button type="button" className="text-button" disabled={mapStatus !== "ready" || battle.busy || (!range && battle.mode !== "command")} onClick={() => { setReplayRequested(false); if (battle.mode === "command") battle.edit(); beginPreview(playback.restart); }} aria-label="Reset playback"><RotateCcw size={17} /><span>Reset</span></button>
            </>}
            {!mobile && battleControls}
            <div className="desktop-header-actions">{secondaryActions}</div>
            <button className="text-button mobile-actions-button" aria-label="Open map actions" aria-haspopup="dialog" aria-controls="mobile-map-actions" onClick={() => actionsDialogRef.current?.showModal()}><Menu size={20} /><span>More</span></button>
            <input
              className="visually-hidden"
              ref={importRef}
              type="file"
              accept=".json,application/json"
              onChange={importMap}
              aria-label="Import map file"
              tabIndex={-1}
            />
          </div>
        </div>
        {!exportOpen && !mapFullscreen && !timelineMinimized && timeline}
        {videoOpen && <VideoExportPanel orientation={exportOrientation} onOrientation={orientExport} showDate={videoShowDate} onShowDate={setVideoShowDate} duration={project.playbackDuration} onDuration={(playbackDuration) => setProject((current) => ({ ...current, playbackDuration }))} playback={playback} range={range} onPlay={() => beginPreview(playback.play)} onRestart={() => beginPreview(playback.restart)} onSeek={(time) => beginPreview(() => { playback.pause(); playback.seek(time); })} onPrepareRecording={prepareVideoRecording} onCaptureFrame={captureVideoFrame} onExport={startVideoExport} onClose={closeExport} frameSize={exportFrame} mapReady={mapStatus === "ready"} />}
        {pictureOpen && <PictureExportPanel orientation={exportOrientation} onOrientation={orientExport} busy={pictureExporting} error={pictureError} mapReady={mapStatus === "ready"} frameSize={exportFrame} onDownload={downloadPicture} onClose={closeExport} />}
      </header>

      <main className={`workspace ${panelOpen ? "" : "panel-collapsed"}`}>
        <aside
          className="sidebar"
          aria-label="Badge controls"
          inert={!panelOpen}
        >
          <div className="sidebar-heading">
            <button
              className="icon-button"
              title="Collapse panel"
              aria-label="Collapse panel"
              onClick={() => setPanelOpen(false)}
            >
              <PanelLeftClose size={19} />
            </button>
          </div>
          {battle.mode === "edit" && playback.preview && !mapEdit && null}
          <GroupTabs project={visibleProject} activeId={activeGroupId} onSelect={chooseGroup} onChange={changeGroups} locked={!ready || battle.busy || battle.mode !== "edit" || exportOpen || !!draft || !!unitDraft || !!lineDraft} />
          {battle.mode === "edit" && <div className="sidebar-content" onPointerDownCapture={resumeSidebarEditing} onFocusCapture={resumeSidebarEditing} inert={(playback.playing && mapEdit?.ui !== "full") || exportOpen || (!!mapEdit && mapEdit.ui !== "full")}>
            <div className="sidebar-tabs" aria-label="Map features">{[
              { id: "badges", label: "Badges", icon: HardHat, description: "Add a badge, upload a flag, and choose a spot on the map. Customize its symbol, size, stars, and troop count. Add dated route stops to move it, change troop numbers, or play effects over time." },
              { id: "units", label: "Equipment", icon: Truck, description: "Place tanks, warships, artillery, troops, or custom equipment images. Set their location and add dated routes, effects, and targets. Preset images appear in full; custom images are cropped to a circle." },
              { id: "text", label: "Text", icon: Type, description: "Add a text label to the map. Click to place it, then drag to reposition it. Choose when it appears or disappears during playback." },
              { id: "lines", label: "Lines", icon: Route, description: "Trace boundaries and paths by clicking points on the map. Finish drawing, then drag handles to reshape the line or add bends. Lines appear red on Map and white on Satellite." },
              { id: "paint", label: "Paint", icon: Paintbrush, description: "Drag on the map to color an area. Choose a brush size, shape, color, and transparency, or erase painted areas. Paint stays attached to the map as you zoom." },
            ].map(({ id, label, description, icon: Icon }) => <HelpTooltip key={id} label={label} description={description}><button className={section === id ? "active" : ""} aria-label={label} aria-description={description} aria-pressed={section === id} onClick={() => switchSection(id)}><Icon size={19} aria-hidden="true" /></button></HelpTooltip>)}</div>
            {section === "paint" ? <div className="paint-controls">
              <PaintVisibilityEditor key={activeGroupId} group={project.groups.find((group) => group.id === activeGroupId)} onSave={(paintVisibility) => setProject((current) => ({ ...current, groups: current.groups.map((group) => group.id === activeGroupId ? { ...group, paintVisibility } : group) }))} />
              
              <div className="paint-options" aria-label="Paint tool">{["paint", "erase"].map((tool) => <button key={tool} className={brush.tool === tool ? "active" : ""} onClick={() => setBrush((value) => ({ ...value, tool }))}>{tool === "paint" ? "Paint" : "Eraser"}</button>)}</div>
              <div className="paint-options" aria-label="Brush size">{["small", "medium", "big"].map((size) => <button key={size} className={brush.size === size ? "active" : ""} onClick={() => setBrush((value) => ({ ...value, size }))}>{size[0].toUpperCase() + size.slice(1)}</button>)}</div>
              <div className="paint-options" aria-label="Brush shape">{["circle", "rectangle"].map((shape) => <button key={shape} className={brush.shape === shape ? "active" : ""} onClick={() => setBrush((value) => ({ ...value, shape }))}>{shape[0].toUpperCase() + shape.slice(1)}</button>)}</div>
              <div className="paint-swatches" aria-label="Paint colors">{PAINT_COLORS.map(({ name, value }) => <button key={value} type="button" aria-label={name} aria-pressed={brush.color === value} className={brush.color === value ? "active" : ""} style={{ backgroundColor: value }} onClick={() => setBrush((current) => ({ ...current, color: value }))} />)}</div>
              <label className="paint-color">Color <input type="color" value={brush.color} onChange={(event) => setBrush((value) => ({ ...value, color: event.target.value }))} /></label>
              <label className="paint-opacity">Transparency <span>{Math.round(brush.opacity * 100)}% opacity</span><input type="range" min="10" max="100" step="5" value={Math.round(brush.opacity * 100)} onChange={(event) => setBrush((value) => ({ ...value, opacity: Number(event.target.value) / 100 }))} /></label>
              <button className="primary add-button" disabled={mapStatus !== "ready" || playback.playing || exportOpen} onClick={() => { setMode(mode === "paint" ? "navigate" : "paint"); }}>{mode === "paint" ? "Done painting" : "Start painting"}</button>
              <div className="paint-options"><button disabled={!groupItems("paintStrokes").length} onClick={() => setProject((current) => ({ ...current, paintStrokes: current.paintStrokes.filter((stroke) => stroke.id !== current.paintStrokes.findLast((item) => item.groupId === activeGroupId)?.id) }))}>Undo</button><button disabled={!groupItems("paintStrokes").length} onClick={() => { if (window.confirm("Clear all paint from this group?")) setProject((current) => ({ ...current, paintStrokes: current.paintStrokes.filter((stroke) => stroke.groupId !== activeGroupId) })); }}>Clear paint</button></div>
              {project.groups.length > 1 && <label className="field-label">Move this group's paint<select value={paintDestination} onChange={(event) => setPaintDestination(event.target.value)}><option value="">Choose a group…</option>{project.groups.filter((group) => group.id !== activeGroupId).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select><button disabled={!groupItems("paintStrokes").length || !project.groups.some((group) => group.id === paintDestination && group.id !== activeGroupId)} onClick={() => { setProject((current) => ({ ...current, paintStrokes: current.paintStrokes.map((stroke) => stroke.groupId === activeGroupId ? { ...stroke, groupId: paintDestination } : stroke) })); setPaintDestination(""); }}>Move paint</button></label>}
            </div> : lineDraft ? <><label className="field-label">Group<select value={lineDraft.groupId} onChange={(event) => updateLine({ groupId: event.target.value })}>{project.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><LineEditor line={lineDraft} onChange={updateLine} mode={mode} onMode={changeMode} onSave={saveLine} onCancel={() => { if (discardAllowed()) resetEditor(); }} onDelete={project.lines.some((line) => line.id === lineDraft.id) ? deleteLine : null} selectedPoint={selectedPoint} onSelectedPoint={setSelectedPoint} error={formError} mapReady={mapStatus === "ready"} isSatellite={isSatellite} /></> : section === "lines" || section === "text" ? <>
              
              <button className="primary add-button" disabled={!ready || mapStatus !== "ready"} onClick={() => addLine()}><Plus size={18} /> Draw line</button>
              <button className="secondary add-button" disabled={!ready || mapStatus !== "ready"} onClick={() => addLine("text")}><Plus size={18} /> Add text label</button>
              {mapStatus !== "ready" && null}
              {!groupItems("lines").length ? null : <ul className="feature-card-list">{groupItems("lines").filter((line) => section === "text" ? line.kind === "text" : line.kind !== "text").map((line) => <li key={line.id}><FeatureCard name={line.name} active={selectedId === line.id} onClick={() => selectLine(line.id)} visual={line.kind === "text" ? <Type size={32} /> : <Route size={32} />} details={[["Type", line.kind === "text" ? "Text label" : "Line"], ["Points", line.path.length], ["Style", line.style]]} /></li>)}</ul>}
            </> : unitDraft ? <UnitEditor groups={project.groups} unit={unitDraft} effectTargets={[...project.badges, ...project.units]} editing={project.units.some((item) => item.id === unitDraft.id)} onChange={updateUnit} onImage={(event) => uploadFeatureImage(event, "unit")} onSave={saveUnit} onCancel={() => { if (discardAllowed()) resetEditor(); }} onDelete={deleteUnit} onClone={cloneUnit} onPlace={() => { setMode(mode === "placeUnit" ? "navigate" : "placeUnit"); if (mode !== "placeUnit" && window.matchMedia("(max-width: 700px)").matches) setPanelOpen(false); }} onMode={changeMode} onFocus={(stop) => { const position = coordinates(stop.lat, stop.lng); if (position) mapRef.current?.focus(position); }} onPickTargetLocation={pickTargetLocation} targetLocationStopId={targetLocationStopId} onPickRouteLocation={pickRouteLocation} routeLocationStopId={routeLocationStopId} mode={mode} mapReady={mapStatus === "ready"} uploading={uploading} error={formError} /> : section === "units" ? <>
              
              <button className="primary add-button" disabled={!ready} onClick={addUnit}><Plus size={18} /> Add equipment</button>
              <div className="list-heading"><span>MAP EQUIPMENT</span><span>{groupItems("units").length} / {MAX_UNITS}</span></div>
              <label className="field-label card-search">Search equipment<input type="search" placeholder="Search equipment by name…" value={cardSearch.units} onChange={(event) => setCardSearch((current) => ({ ...current, units: event.target.value }))} /></label>
              {groupItems("units").length > 0 && !filteredCards("units").length && <p className="field-hint" role="status">No equipment matches your search.</p>}
              {!groupItems("units").length ? null : <ul className="feature-card-list">{filteredCards("units").map((unit) => <li key={unit.id}><FeatureCard name={unit.name} image={unitImage(unit)} visual={<Truck size={32} />} active={selectedId === unit.id} onClick={() => selectUnit(unit.id)} details={[["Stars", unit.stars ?? 0], ["Quantity", unit.quantity ?? 1], ["Type", unit.kind]]} /></li>)}</ul>}
            </> : !draft ? (
              <>
                
                <button
                  className="primary add-button"
                  disabled={!ready}
                  onClick={addBadge}
                >
                  <Plus size={18} /> Add badge
                </button>
                <div className="list-heading">
                  <span>MAP BADGES</span>
                  <span>
                    {groupItems("badges").length} / {MAX_BADGES}
                  </span>
                </div>
                <label className="field-label card-search">Search badges<input type="search" placeholder="Search badges by name…" value={cardSearch.badges} onChange={(event) => setCardSearch((current) => ({ ...current, badges: event.target.value }))} /></label>
                {groupItems("badges").length > 0 && !filteredCards("badges").length && <p className="field-hint" role="status">No badges match your search.</p>}
                {!groupItems("badges").length ? (
                  <div className="empty-state">
                    <div className="empty-illustration">
                      <span className="orbit orbit-one" />
                      <span className="orbit orbit-two" />
                      <MapPin size={35} strokeWidth={1.3} />
                      <span className="orbit-dot" />
                    </div>
                    
                    
                    
                  </div>
                ) : (
                  <ul className="feature-card-list">{filteredCards("badges").map((badge) => <li key={badge.id}><FeatureCard name={badge.label} badge={badge} active={selectedId === badge.id} onClick={() => selectBadge(badge.id)} details={[["Stars", badge.stars ?? 0], ["Troops", badge.troopCount ?? 0]]} /></li>)}</ul>
                )}
                
              </>
            ) : (
              <form className="editor feature-editor" onSubmit={commitBadge}>
                <div className="editor-title">
                  {!editing && <h3>New badge</h3>}
                  <div className="editor-title-actions">
                    {editing && <button type="button" className="badge-settings-reset badge-delete-button" onClick={() => deleteBadgeDialogRef.current?.showModal()} title="Delete badge" aria-haspopup="dialog">
                      <Trash2 size={14} /> <span>Delete</span>
                    </button>}
                    {editing && <button type="button" className="badge-settings-reset badge-clone-button" onClick={cloneBadge} title="Create a copy of this badge">
                      <Copy size={14} /> <span>Clone badge</span>
                    </button>}
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Close editor"
                      onClick={() => {
                        if (discardAllowed()) resetEditor();
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
                <div className="preview-area">
                  <span className="preview-tag">LIVE PREVIEW</span>
                  <BadgePreview badge={draft} />
                  <span className="preview-caption">
                    Your marker on the map
                  </span>
                </div>
                <label className="field-label" htmlFor="badge-label">
                  Badge label <span>{draft.label.length}/80</span>
                </label>
                <input
                  id="badge-label"
                  autoFocus
                  value={draft.label}
                  onChange={(event) =>
                    updateDraft({ label: event.target.value })
                  }
                  maxLength={80}
                  placeholder="e.g. 8th Australian Division"
                  required
                />
                <label className="field-label" htmlFor="flag-upload">
                  Flag image
                </label>
                <label
                  className={`upload-zone ${uploading ? "busy" : ""}`}
                  htmlFor="flag-upload"
                >
                  {uploading ? (
                    <LoaderCircle size={21} className="spin" />
                  ) : draft.flag ? (
                    <img src={draft.flag} alt="Selected flag" />
                  ) : (
                    <ImagePlus size={22} />
                  )}
                  <span>
                    <strong>
                      {uploading
                        ? "Preparing image…"
                        : draft.flag
                          ? "Change flag image"
                          : "Choose a flag image"}
                    </strong>
                    
                  </span>
                  <Upload size={15} />
                  <input
                    id="flag-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploading}
                    onChange={uploadFlag}
                  />
                </label>
                <SymbolPicker value={draft.symbol} image={draft.symbolImage} onSelect={(symbol) => updateDraft({ symbol })} onImage={(event) => uploadFeatureImage(event, "badge")} uploading={uploading} error={formError} />
                <label className="field-label">Stars <span>{draft.stars ?? 0} / 5</span><select value={draft.stars ?? 0} onChange={(event) => updateDraft({ stars: Number(event.target.value) })}>{[0, 1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>{count === 0 ? "0 · No stars" : `${count} · ${"★".repeat(count)}`}</option>)}</select></label>
                <ForceSettings feature={draft} groups={project.groups} onChange={updateDraft} />
                <label className="field-label">Troop number<input type="number" min="0" max={Number.MAX_SAFE_INTEGER} step="1" required value={draft.troopCount ?? 0} onChange={(event) => { const troopCount = Number(event.target.value); if (Number.isSafeInteger(troopCount) && troopCount >= 0) updateDraft({ troopCount, route: draft.route.map((stop, index) => index === 0 ? { ...stop, troopCount } : stop) }); }} /></label>
                
                <SizePicker formation value={draft.size} onChange={(size) => updateDraft({ size, troopCount: BADGE_FORMATIONS[size].troops })} />
                <div className="section-rule" />
                <div className="field-label location-title">
                  Position{" "}
                  <span>{hasPosition ? "LOCATION SET" : "CHOOSE A SPOT"}</span>
                </div>
                <button
                  className={`position-button ${placing ? "is-placing" : ""}`}
                  type="button"
                  disabled={mapStatus !== "ready" || draft.route.length > 0}
                  onClick={chooseOnMap}
                >
                  <Crosshair size={17} />
                  {placing ? "Click a location on the map" : "Choose on map"}
                </button>
                {mapStatus !== "ready" && null}
                <div className="coordinate-fields">
                  <label>
                    Latitude
                    <input
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      required
                      placeholder="−90 to 90"
                      value={draft.lat}
                      readOnly={draft.route.length > 0}
                      onChange={(event) =>
                        updateDraft({ lat: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Longitude
                    <input
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      required
                      placeholder="−180 to 180"
                      value={draft.lng}
                      readOnly={draft.route.length > 0}
                      onChange={(event) =>
                        updateDraft({ lng: event.target.value })
                      }
                    />
                  </label>
                </div>
                <RouteEditor badge={draft} onChange={updateDraft} mapReady={mapStatus === "ready"} mode={mode} onMode={changeMode} onFocus={(stop) => { const position = coordinates(stop.lat, stop.lng); if (position) mapRef.current?.focus(position); }} onPickTargetLocation={pickTargetLocation} targetLocationStopId={targetLocationStopId} onPickRouteLocation={pickRouteLocation} routeLocationStopId={routeLocationStopId} effectTargets={[...project.badges, ...project.units]} />
                <VisibilityEditor visibility={draft.visibility} onChange={(visibility) => updateDraft({ visibility })} />
                {formError && (
                  <p className="form-error" role="alert">
                    <AlertCircle size={15} />
                    {formError}
                  </p>
                )}

                <div className="editor-actions">
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => {
                      if (discardAllowed()) resetEditor();
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="primary"
                    type="submit"
                    disabled={uploading}
                  >
                    <Check size={17} />
                    {editing ? "Save changes" : "Save badge"}
                  </button>
                </div>
              </form>
            )}
          </div>
          }
        </aside>

        <section ref={mapStageRef} className={`map-stage ${range ? "has-timeline" : ""}${exportOpen ? " video-framing" : ""}`} aria-label="Map workspace">
          <div className="map-placeholder" aria-hidden="true">
            <div className="globe-ring ring-one" />
            <div className="globe-ring ring-two" />
            <div className="globe-ring ring-three" />
            <span className="grid-label">A WORLD OF POSSIBILITIES</span>
          </div>
          {ready && (!exportOpen || exportFrame?.width > 0) && (
            <div inert={pictureExporting} className={exportOpen ? "video-frame" : "map-surface"} style={exportOpen ? { width: exportFrame.width, height: exportFrame.height } : undefined}>
            <MapCanvas
              key={exportOpen ? `${exportKind}-${exportOrientation}` : "editor"}
              ref={mapRef}
              initialView={exportOpen ? exportCamera : editingView.current ?? initialView}
              groups={visibleProject.groups}
              showAllMovement={showAllMovement}
              battleForces={battle.mode === "command" ? battle.frame?.forces : undefined}
              battleTime={battle.frame?.at}
              battleReplay={battle.mode === "replay" ? { ...battle.replay, snapshot: visibleProject } : undefined}
              selectedIds={battle.selectedIds}
              activeGroupId={activeGroupId}
              onCommandSelect={battle.select}
              onCommand={battle.command}
              onCommandStop={battle.stop}
              badges={visibleProject.badges}
              units={visibleProject.units}
              draft={mapEdit && mapEdit.ui !== "full" && mapEdit.featureType === "badge" ? mapEdit.feature : draft}
              unitDraft={mapEdit && mapEdit.ui !== "full" && mapEdit.featureType === "unit" ? mapEdit.feature : unitDraft}
              targetLocationStopId={targetLocationStopId}
              selectedId={exportOpen || battle.mode !== "edit" ? null : selectedId}
              cleanExport={exportOpen}
              mode={exportOpen ? "export" : battle.mode === "command" ? "command" : battle.mode === "replay" ? "replay" : mode}
              preview={mapEdit ? false : playback.preview}
              playing={playback.playing}
              previewTime={playback.cursor}
              authoringTime={mapEdit?.time}
              onFeatureContextMenu={exportOpen || battle.mode !== "edit" ? undefined : openFeatureMenu}
              onEffectTargetSelect={exportOpen ? undefined : openEffectTargetMenu}
              animationRange={range}
              animationDuration={project.playbackDuration}
              lines={visibleProject.lines}
              paintStrokes={visibleProject.paintStrokes}
              brush={{ ...brush, groupId: activeGroupId }}
              onPaintStroke={(stroke) => setProject((current) => {
                const pointCount = current.paintStrokes.reduce((count, item) => count + item.points.length, stroke.points.length);
                if (current.paintStrokes.length >= MAX_PAINT_STROKES || pointCount > MAX_PAINT_POINTS) { setMessage({ error: true, text: "Paint limit reached. Undo or clear paint to continue." }); return current; }
                return { ...current, paintStrokes: [...current.paintStrokes, { ...stroke, groupId: activeGroupId }] };
              })}
              lineDraft={lineDraft}
              onPoint={mapPoint}
              onLineSelect={selectLine}
              onLinePath={(path) => updateLine({ path })}
              onLinePoint={setSelectedPoint}
              onStopMove={moveStop}
              onSelect={selectBadge}
              onMove={moveBadge}
              onUnitSelect={selectUnit}
              onUnitMove={moveUnit}
              onView={changeView}
              onStatus={setMapStatus}
            />
            {videoOpen && videoShowDate && playback.preview && range && <time className="video-date-stamp">{videoDate(playback.cursor)}</time>}
            </div>
          )}
          {!exportOpen && battle.mode === "edit" && <MapFeatureControls menu={featureMenu} session={mapEdit} targets={[...project.badges, ...project.units]} error={mapEdit?.error || formError}
            onDismiss={dismissFeatureMenu} onEdit={() => beginMapEdit("edit")} onMovement={() => beginMapEdit("movement")}
            onEffect={chooseMovementEffect}
            onChange={updateMapEdit} onStart={startMapMovement} onSave={saveMapEdit}
            onCancel={() => { if (discardAllowed()) resetEditor(); }} onFullEditor={openFullMapEditor} />}
          {!exportOpen && battle.mode === "command" && <BattlePanel battle={battle} activeGroupId={activeGroupId} onFocus={(force) => mapRef.current?.focus(force)} />}
          {!exportOpen && <div className="map-toolbar">
            {!panelOpen && !mapFullscreen && (
              <button
                className="map-button panel-open-button"
                onClick={() => setPanelOpen(true)}
                aria-label="Open badge panel"
              >
                <PanelLeftOpen size={18} />
                <span>Badges</span>
              </button>
            )}
            <div className="map-type-controls" aria-label="Map style">
              <button
                disabled={mapStatus !== "ready"}
                className={!isSatellite ? "active" : ""}
                onClick={() => mapRef.current?.setType("roadmap")}
              >
                <Globe2 size={15} />
                Map
              </button>
              <button
                disabled={mapStatus !== "ready"}
                className={isSatellite ? "active" : ""}
                onClick={() => mapRef.current?.setType("satellite")}
              >
                <Layers2 size={15} />
                Satellite
              </button>
            </div>
            <button
              className="map-button fit-button"
              disabled={mapStatus !== "ready" || (!project.badges.length && !project.units.length && !project.lines.length && !project.paintStrokes.length)}
              onClick={() => mapRef.current?.fitAll()}
            >
              <Crosshair size={17} />
              <span>Show all features</span>
            </button>
            {!mobile && movementControl}
            <div className="map-type-controls" aria-label="Map rotation">
              <button disabled={mapStatus !== "ready"} onClick={() => mapRef.current?.rotate(-15)} aria-label="Rotate map left" title="Rotate map left">
                <RotateCcw size={15} />
              </button>
              <button disabled={mapStatus !== "ready"} onClick={() => mapRef.current?.resetHeading()} aria-label="Reset map north" title="Reset map north">
                <Compass size={15} />
              </button>
              <button disabled={mapStatus !== "ready"} onClick={() => mapRef.current?.rotate(15)} aria-label="Rotate map right" title="Rotate map right">
                <RotateCcw size={15} style={{ transform: "scaleX(-1)" }} />
              </button>
            </div>
            {!mobile && <>{pictureControl}{fullscreenControl}</>}
            {mobile && mapFullscreen && <button className="map-button mobile-actions-button" aria-label="Open map actions" aria-haspopup="dialog" aria-controls="mobile-map-actions" onClick={() => actionsDialogRef.current?.showModal()}><Menu size={20} /><span>More</span></button>}
          </div>}
          {mapStatus !== "ready" && (
            <div className="setup-overlay">
              <SetupCard status={mapStatus} />
            </div>
          )}
          {["placeBadge", "placeUnit", "drawLine", "addStop", "repointStop", "placeEffectTarget"].includes(mode) && mapStatus === "ready" && (
            <div className="placement-hint">
              <MapPin size={18} />
              <span>{mode === "drawLine" ? lineDraft?.kind === "text" ? "Click the map to place your text label" : `Click to add line points (${lineDraft?.path.length ?? 0})` : mode === "addStop" ? "Click the map for the next route stop" : mode === "repointStop" ? "Click the map to repoint this route stop" : mode === "placeEffectTarget" ? "Click the map to set the effect target location" : mode === "placeUnit" ? "Click the map to place your equipment" : "Click the map to place your badge"}</span>
              {mode === "drawLine" && lineDraft?.kind !== "text" && <><button aria-label="Undo last line point" disabled={!lineDraft?.path.length} onClick={() => updateLine({ path: lineDraft.path.slice(0, -1) })}>Undo</button><button disabled={(lineDraft?.path.length ?? 0) < 2} onClick={() => { setMode("editLine"); setPanelOpen(true); }}>Finish</button></>}
              <button
                aria-label="Cancel placement"
                onClick={() => { if (mode === "drawLine") { if (discardAllowed()) resetEditor(); } else { changeMode("navigate"); setPanelOpen(true); } }}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {(timelineMinimized || mapFullscreen) && !exportOpen && timeline}
          <div className="map-bottom-note">
            <span className="compass-symbol">
              N<Compass size={22} strokeWidth={1.3} />
            </span>
            <span>
              {project.badges.length} location
              {project.badges.length === 1 ? "" : "s"} marked
            </span>
          </div>
          <div className="map-credit">MADE FOR YOUR POINT OF VIEW</div>
        </section>
      </main>
      <div className="notification-stack">
      {message && (
        <div
          className={`toast ${message.error ? "toast-error" : ""}`}
          role={message.error ? "alert" : "status"}
        >
          {message.error ? <AlertCircle size={18} /> : <Check size={18} />}
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <VideoExportNotifications exports={videoJobs} />
      </div>
    </div>
  );
}
