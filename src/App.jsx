import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Compass,
  Copy,
  Crosshair,
  Download,
  Film,
  Flag,
  Globe2,
  ImageDown,
  ImagePlus,
  Layers2,
  LoaderCircle,
  MapPin,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import MapCanvas from "./MapCanvas.jsx";
import LineEditor from "./LineEditor.jsx";
import RouteEditor from "./RouteEditor.jsx";
import UnitEditor from "./UnitEditor.jsx";
import VisibilityEditor from "./VisibilityEditor.jsx";
import SizePicker from "./SizePicker.jsx";
import Timeline from "./Timeline.jsx";
import VideoExportPanel from "./VideoExportPanel.jsx";
import usePlayback from "./usePlayback.js";
import { videoDate, videoFrameSize } from "./video.js";
import { BADGE_SIZES, MAX_LINES, MAX_LINE_POINTS, MAX_STOPS, createRouteStop, routeError, timelineRange, visibilityError } from "./timeline.js";
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
      <p className="setup-copy">
        {loading
          ? "Getting Google Maps ready for your next marker."
          : error
            ? "Google Maps could not load. Check your connection, API key, billing, and allowed website addresses, then reload."
            : "Connect Google Maps to start placing your flags. Your badges, your locations, all in one view."}
      </p>
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
          <p className="setup-footnote">
            You can already create badges using coordinates.
          </p>
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
  const [project, setProject] = useState(EMPTY_PROJECT);
  const [mapFileName, setMapFileName] = useState(readMapFileName);
  const [initialView, setInitialView] = useState(EMPTY_PROJECT.view);
  const [ready, setReady] = useState(false);
  const [canPersist, setCanPersist] = useState(true);
  const [saveStatus, setSaveStatus] = useState("loading");
  const [mapStatus, setMapStatus] = useState(
    HAS_MAP_KEY ? "loading" : "missing",
  );
  const [panelOpen, setPanelOpen] = useState(true);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [timelineMinimized, setTimelineMinimized] = useState(true);
  const [videoOpen, setVideoOpen] = useState(false);
  const [pictureExporting, setPictureExporting] = useState(false);
  const [videoOrientation, setVideoOrientation] = useState("landscape");
  const [videoShowDate, setVideoShowDate] = useState(true);
  const [videoFrame, setVideoFrame] = useState(null);
  const [videoCamera, setVideoCamera] = useState(null);
  const [draft, setDraft] = useState(null);
  const [unitDraft, setUnitDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState("navigate");
  const [section, setSection] = useState("badges");
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
  const mapRef = useRef(null);
  const mapStageRef = useRef(null);
  const editingView = useRef(null);
  const importRef = useRef(null);
  const uploadSequence = useRef(0);
  const range = useMemo(() => timelineRange([...project.badges, ...project.units]), [project.badges, project.units]);
  const playback = usePlayback(mapRef, range, project.playbackDuration);

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
    if (!videoOpen || !mapStageRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setVideoFrame(videoFrameSize(entry.contentRect.width, entry.contentRect.height, videoOrientation));
    });
    observer.observe(mapStageRef.current);
    return () => observer.disconnect();
  }, [videoOpen, videoOrientation]);

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

  function resetEditor() {
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
      symbol: DEFAULT_BADGE_SYMBOL,
      symbolImage: "",
      stars: 0,
      troopCount: 0,
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
    if (playback.preview) return;
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
          const positionChanges = Object.fromEntries(["lat", "lng", "size"].filter((key) => Object.hasOwn(changes, key)).map((key) => [key, changes[key]]));
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
    if (playback.preview) return;
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
    setUnitDraft({ id: crypto.randomUUID(), name: "", kind: "tank", image: "", size: "M", route: [], visibility: { showAt: "", hideAt: "" }, showTrail: false, lat: "", lng: "" });
    setSection("units");
    setSelectedId(null);
    setMode(mapStatus === "ready" ? "placeUnit" : "navigate");
    setPanelOpen(true);
  }

  function selectUnit(id) {
    if (playback.preview) return;
    if (unitDraft?.id === id) { setPanelOpen(true); return; }
    if (!discardAllowed()) return;
    const unit = project.units.find((item) => item.id === id);
    if (!unit) return;
    resetEditor();
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
    if (playback.preview) return;
    setProject((current) => ({ ...current, units: current.units.map((unit) => unit.id === id && !unit.route.length ? { ...unit, ...position } : unit) }));
  }

  function saveUnit(event) {
    event.preventDefault();
    if (!unitDraft.name.trim()) return setFormError("Give your equipment a name.");
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
    if (videoOpen) { setVideoCamera(view); return; }
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
    if (!window.confirm(`Delete “${draft.label}” from this map?`)) return;
    setProject((current) => clearInvalidFiringTargets({
      ...current,
      badges: current.badges.filter((badge) => badge.id !== draft.id),
    }));
    resetEditor();
    setSelectedId(null);
    setMessage({ text: "Badge deleted." });
  }

  function resetBadgeSettings() {
    if (!draft || !editing) return;
    if (!window.confirm("Reset this badge’s symbol, size, stars, troop number, visibility, and movement settings? Its name, flag, and location will stay as they are.")) return;
    setMode("navigate");
    updateDraft({
      symbol: DEFAULT_BADGE_SYMBOL,
      symbolImage: "",
      stars: 0,
      troopCount: 0,
      size: "M",
      route: [],
      showTrail: false,
      visibility: { showAt: "", hideAt: "" },
    });
    setMessage({ text: "Badge settings reset. Save changes to apply them." });
  }

  function createNewMap() {
    if (!discardAllowed()) return;
    const hasMapData = project.badges.length || project.units.length || project.lines.length || project.paintStrokes.length ||
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
    setProject(freshProject);
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
      setProject(incoming);
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
    const stage = mapStageRef.current;
    const view = mapRef.current?.getView();
    if (!stage || !view || pictureExporting) return;
    setPictureExporting(true);
    try {
      checkProjectSize(project);
      const bounds = stage.getBoundingClientRect();
      const logicalSize = { width: Math.floor(bounds.width), height: Math.floor(bounds.height) };
      if (logicalSize.width < 90 || logicalSize.height < 90) throw new Error("Make the map area larger before downloading a picture.");
      const scale = Math.max(0.5, Math.floor(Math.min(2, 4096 / logicalSize.width, 4096 / logicalSize.height, Math.sqrt(16_000_000 / (logicalSize.width * logicalSize.height))) * 100) / 100);
      const response = await fetch("/api/map/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "image", project, view, logicalSize, scale, previewTime: playback.preview ? playback.cursor : null }),
      }).catch(() => { throw new Error("The local renderer is unavailable. Start Malaya World War II with npm run dev."); });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "The map picture could not be created.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `malaya-world-war-ii-map-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage({ text: "Map picture downloaded." });
    } catch (error) {
      setMessage({ error: true, text: error.message || "The map picture could not be created." });
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
    setLineDraft({ id: crypto.randomUUID(), kind, showLine: true, showLabel: kind === "text", name: kind === "text" ? "New label" : `Line ${project.lines.length + 1}`, style: "solid", shape: "straight", startArrow: false, endArrow: false, width: 3, path: [] });
    setSelectedId(null);
    setSection("lines");
    changeMode("drawLine");
  }

  function selectLine(id) {
    if (playback.preview) return;
    if (lineDraft?.id === id) { setPanelOpen(true); return; }
    if (!discardAllowed()) return;
    const line = project.lines.find((item) => item.id === id);
    if (!line) return;
    resetEditor();
    setLineDraft({ ...line, path: line.path.map((point) => ({ ...point })) });
    setSection("lines");
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
    if (playback.preview) return;
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
    if (!feature || playback.preview) return;
    const changes = { route: feature.route.map((stop) => stop.id === id ? { ...stop, ...position } : stop) };
    if (draft) updateDraft(changes); else updateUnit(changes);
  }

  function beginPreview(action) {
    if (!playback.preview) {
      if (!discardAllowed()) return;
      resetEditor();
      if (window.matchMedia("(max-width: 700px)").matches) setPanelOpen(false);
    }
    action();
  }

  function openVideoExport() {
    if (!range || mapStatus !== "ready" || !discardAllowed()) return;
    const view = mapRef.current?.getView();
    if (!view) return;
    editingView.current = view;
    setVideoCamera(view);
    playback.edit();
    resetEditor();
    setVideoOrientation("landscape");
    setVideoShowDate(true);
    setTimelineMinimized(true);
    setVideoOpen(true);
    if (window.matchMedia("(max-width: 700px)").matches) setPanelOpen(false);
  }

  function closeVideoExport() {
    playback.edit();
    setVideoOpen(false);
    setVideoFrame(null);
    setVideoCamera(null);
  }

  function orientVideo(next) {
    setVideoCamera(mapRef.current?.getView() ?? videoCamera);
    setVideoOrientation(next);
  }

  async function startVideoExport() {
    if (!videoFrame?.width || Math.min(videoFrame.width, videoFrame.height) < 90 || !range) throw new Error("Make the window larger to prepare the video frame.");
    const view = mapRef.current?.getView();
    if (!view) throw new Error("The map is not ready.");
    playback.pause();
    checkProjectSize(project);
    const response = await fetch("/api/video/jobs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project, view, orientation: videoOrientation, showDate: videoShowDate, logicalSize: videoFrame, duration: project.playbackDuration }),
    }).catch(() => { throw new Error("The local render service is unavailable. Start Malaya World War II with npm run dev."); });
    const result = await response.json().catch(() => ({}));
    if (response.status === 404) throw new Error("Start Malaya World War II with npm run dev to enable the local render service.");
    if (!response.ok) throw new Error(result.error || "The render service could not start this export.");
    return result;
  }

  const timeline = <Timeline range={range} duration={project.playbackDuration} onDuration={(playbackDuration) => setProject((current) => ({ ...current, playbackDuration }))} playback={playback} onRestart={() => beginPreview(playback.restart)} onSeek={(time) => beginPreview(() => { playback.pause(); playback.seek(time); })} disabled={mapStatus !== "ready"} minimized={timelineMinimized} onMinimizedChange={setTimelineMinimized} />;

  return (
      <div className={`app${mapFullscreen ? " map-fullscreen" : ""}`}>
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
          <span className="workspace-tag">PERSONAL WORKSPACE</span>
          <div className="header-actions">
            <button
              className="text-button header-timeline-button"
              disabled={!ready || !range}
              onClick={() => setTimelineMinimized((current) => !current)}
              aria-label={timelineMinimized ? "Show historical timeline" : "Hide historical timeline"}
              aria-expanded={!!range && !timelineMinimized}
              aria-controls={range ? "historical-timeline" : undefined}
              title={timelineMinimized ? "Show historical timeline" : "Hide historical timeline"}
            >
              <Clock3 size={18} />
              <span>Historical timeline</span>
            </button>
            <button
              className="text-button header-reset-button"
              disabled={!ready || !range || mapStatus !== "ready"}
              onClick={() => beginPreview(playback.restart)}
              aria-label="Reset animation to first date"
              title="Reset animation to first date"
            >
              <RotateCcw size={18} />
              <span>Reset</span>
            </button>
            <button
              className="text-button header-play-button"
              disabled={!ready || !range || mapStatus !== "ready"}
              onClick={playback.playing ? playback.pause : () => beginPreview(playback.play)}
              aria-label={playback.playing ? "Pause historical timeline" : "Play historical timeline"}
              title={range ? "Historical timeline" : "Add a movement route to enable playback"}
            >
              {playback.playing ? <Pause size={18} /> : <Play size={18} />}
              <span>{playback.playing ? "Pause" : "Play"}</span>
            </button>
            <button
              className="text-button header-edit-button"
              onClick={playback.edit}
              aria-label="Edit map"
              title="Edit map"
            >
              <Pencil size={18} />
              <span>Edit map</span>
            </button>
            <button
              className="new-map-button"
              disabled={!ready || importing || playback.preview || videoOpen}
              onClick={createNewMap}
              title="Start a new map"
            >
              <Plus size={16} />
              <span>New</span>
            </button>
            <button
              className="text-button"
              disabled={!ready || importing || playback.preview || videoOpen}
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
            <button className="export-button" disabled={!ready || !range || mapStatus !== "ready"} onClick={openVideoExport}><Film size={16} /><span>Export video</span></button>
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
        {!mapFullscreen && !timelineMinimized && timeline}
        {videoOpen && <VideoExportPanel orientation={videoOrientation} onOrientation={orientVideo} showDate={videoShowDate} onShowDate={setVideoShowDate} duration={project.playbackDuration} onDuration={(playbackDuration) => setProject((current) => ({ ...current, playbackDuration }))} playback={playback} range={range} onPlay={() => beginPreview(playback.play)} onRestart={() => beginPreview(playback.restart)} onSeek={(time) => beginPreview(() => { playback.pause(); playback.seek(time); })} onExport={startVideoExport} onClose={closeVideoExport} frameSize={videoFrame} />}
      </header>

      <main className={`workspace ${panelOpen ? "" : "panel-collapsed"}`}>
        <aside
          className="sidebar"
          aria-label="Badge controls"
          inert={!panelOpen}
        >
          <div className="sidebar-heading">
            <div>
              <p className="eyebrow">MAKE YOUR MARK</p>
              <h2>
                Your locations{" "}
                <span>{project.badges.length.toString().padStart(2, "0")}</span>
              </h2>
            </div>
            <button
              className="icon-button"
              title="Collapse panel"
              aria-label="Collapse panel"
              onClick={() => setPanelOpen(false)}
            >
              <PanelLeftClose size={19} />
            </button>
          </div>
          {playback.preview && <p className="sidebar-preview-note">Animation preview. Choose <strong>Edit map</strong> beside Play in the header to edit your features.</p>}
          <div className="sidebar-content" inert={playback.preview || videoOpen}>
            <div className="sidebar-tabs" aria-label="Map features">{["badges", "units", "lines", "paint"].map((tab) => <button key={tab} className={section === tab ? "active" : ""} onClick={() => switchSection(tab)}>{tab === "badges" ? "Badges" : tab === "units" ? "Equipment" : tab === "paint" ? "Paint" : "Lines & text"} <span>{project[tab === "paint" ? "paintStrokes" : tab].length}</span></button>)}</div>
            {section === "paint" ? <div className="paint-controls">
              <p className="intro-copy">Drag on the map to color an area. Paint stays attached to the map as you zoom.</p>
              <div className="paint-options" aria-label="Paint tool">{["paint", "erase"].map((tool) => <button key={tool} className={brush.tool === tool ? "active" : ""} onClick={() => setBrush((value) => ({ ...value, tool }))}>{tool === "paint" ? "Paint" : "Eraser"}</button>)}</div>
              <div className="paint-options" aria-label="Brush size">{["small", "medium", "big"].map((size) => <button key={size} className={brush.size === size ? "active" : ""} onClick={() => setBrush((value) => ({ ...value, size }))}>{size[0].toUpperCase() + size.slice(1)}</button>)}</div>
              <div className="paint-options" aria-label="Brush shape">{["circle", "rectangle"].map((shape) => <button key={shape} className={brush.shape === shape ? "active" : ""} onClick={() => setBrush((value) => ({ ...value, shape }))}>{shape[0].toUpperCase() + shape.slice(1)}</button>)}</div>
              <div className="paint-swatches" aria-label="Paint colors">{PAINT_COLORS.map(({ name, value }) => <button key={value} type="button" aria-label={name} aria-pressed={brush.color === value} className={brush.color === value ? "active" : ""} style={{ backgroundColor: value }} onClick={() => setBrush((current) => ({ ...current, color: value }))} />)}</div>
              <label className="paint-color">Color <input type="color" value={brush.color} onChange={(event) => setBrush((value) => ({ ...value, color: event.target.value }))} /></label>
              <label className="paint-opacity">Transparency <span>{Math.round(brush.opacity * 100)}% opacity</span><input type="range" min="10" max="100" step="5" value={Math.round(brush.opacity * 100)} onChange={(event) => setBrush((value) => ({ ...value, opacity: Number(event.target.value) / 100 }))} /></label>
              <button className="primary add-button" disabled={mapStatus !== "ready" || playback.preview || videoOpen} onClick={() => { setMode(mode === "paint" ? "navigate" : "paint"); }}>{mode === "paint" ? "Done painting" : "Start painting"}</button>
              <div className="paint-options"><button disabled={!project.paintStrokes.length} onClick={() => setProject((current) => ({ ...current, paintStrokes: current.paintStrokes.slice(0, -1) }))}>Undo</button><button disabled={!project.paintStrokes.length} onClick={() => { if (window.confirm("Clear all paint from this map?")) setProject((current) => ({ ...current, paintStrokes: [] })); }}>Clear paint</button></div>
            </div> : lineDraft ? <LineEditor line={lineDraft} onChange={updateLine} mode={mode} onMode={changeMode} onSave={saveLine} onCancel={() => { if (discardAllowed()) resetEditor(); }} onDelete={project.lines.some((line) => line.id === lineDraft.id) ? deleteLine : null} selectedPoint={selectedPoint} onSelectedPoint={setSelectedPoint} error={formError} mapReady={mapStatus === "ready"} isSatellite={isSatellite} /> : section === "lines" ? <>
              <p className="intro-copy">Trace boundaries and paths. Lines appear red on Map and white on Satellite.</p>
              <button className="primary add-button" disabled={!ready || mapStatus !== "ready"} onClick={() => addLine()}><Plus size={18} /> Draw line</button>
              <button className="secondary add-button" disabled={!ready || mapStatus !== "ready"} onClick={() => addLine("text")}><Plus size={18} /> Add text label</button>
              {mapStatus !== "ready" && <p className="field-hint">Connect Google Maps to draw new lines.</p>}
              {!project.lines.length ? <p className="field-hint">Click points on the map, finish drawing, then save your line.</p> : <ul className="badge-list">{project.lines.map((line) => <li key={line.id}><button className="badge-row" onClick={() => selectLine(line.id)} aria-label={`Edit line ${line.name}`}><span className="line-list-swatch" style={{ borderTopStyle: line.style, borderTopWidth: line.width, borderTopColor: isSatellite ? "#fff" : "#d62828", background: isSatellite ? "#46566a" : "transparent" }} /><div className="badge-row-copy"><strong>{line.name}</strong><span>{line.kind === "text" ? "Text label" : `${line.path.length} points · ${line.style}`}</span></div><ChevronRight size={15} /></button></li>)}</ul>}
            </> : unitDraft ? <UnitEditor unit={unitDraft} effectTargets={[...project.badges, ...project.units]} editing={project.units.some((item) => item.id === unitDraft.id)} onChange={updateUnit} onImage={(event) => uploadFeatureImage(event, "unit")} onSave={saveUnit} onCancel={() => { if (discardAllowed()) resetEditor(); }} onDelete={deleteUnit} onClone={cloneUnit} onPlace={() => { setMode(mode === "placeUnit" ? "navigate" : "placeUnit"); if (mode !== "placeUnit" && window.matchMedia("(max-width: 700px)").matches) setPanelOpen(false); }} onMode={changeMode} onFocus={(stop) => { const position = coordinates(stop.lat, stop.lng); if (position) mapRef.current?.focus(position); }} onPickTargetLocation={pickTargetLocation} targetLocationStopId={targetLocationStopId} onPickRouteLocation={pickRouteLocation} routeLocationStopId={routeLocationStopId} mode={mode} mapReady={mapStatus === "ready"} uploading={uploading} error={formError} /> : section === "units" ? <>
              <p className="intro-copy">Place tanks, warships, artillery, troops, and custom equipment images. Give each one a route through time.</p>
              <button className="primary add-button" disabled={!ready} onClick={addUnit}><Plus size={18} /> Add equipment</button>
              <div className="list-heading"><span>MAP EQUIPMENT</span><span>{project.units.length} / {MAX_UNITS}</span></div>
              {!project.units.length ? <p className="field-hint">Add equipment, choose its location, then create a movement route.</p> : <ul className="badge-list">{project.units.map((unit) => <li key={unit.id}><button className={`badge-row ${selectedId === unit.id ? "active" : ""}`} onClick={() => selectUnit(unit.id)}><span className="unit-list-mark">{unitImage(unit) ? <img src={unitImage(unit)} alt="" /> : unit.kind === "other" ? "✦" : unit.kind === "warship" ? "◢" : unit.kind === "artillery" ? "✹" : "●"}</span><div className="badge-row-copy"><strong>{unit.name}</strong><span>{unit.kind} · {unit.lat.toFixed(4)}, {unit.lng.toFixed(4)}</span></div><ChevronRight size={15} /></button></li>)}</ul>}
            </> : !draft ? (
              <>
                <p className="intro-copy">
                  A flag, a name, a place.
                  <br />
                  Make the map your own.
                </p>
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
                    {project.badges.length} / {MAX_BADGES}
                  </span>
                </div>
                {!project.badges.length ? (
                  <div className="empty-state">
                    <div className="empty-illustration">
                      <span className="orbit orbit-one" />
                      <span className="orbit orbit-two" />
                      <MapPin size={35} strokeWidth={1.3} />
                      <span className="orbit-dot" />
                    </div>
                    <h3>Your first mark starts here</h3>
                    <p>
                      Add a badge, upload a flag, and choose a spot on the map.
                    </p>
                    <div className="empty-note">
                      <span>01</span> ADD <i /> <span>02</span> PLACE <i />{" "}
                      <span>03</span> SAVE
                    </div>
                  </div>
                ) : (
                  <ul className="badge-list">
                    {project.badges.map((badge, index) => (
                      <li key={badge.id}>
                        <button
                          className={`badge-row ${selectedId === badge.id ? "active" : ""}`}
                          onClick={() => selectBadge(badge.id)}
                          title={`Edit ${badge.label}`}
                          aria-label={`Edit badge ${badge.label}`}
                        >
                          <div className="list-flag">
                            <img src={badge.flag} alt="" />
                          </div>
                          <div className="badge-row-copy">
                            <strong>{badge.label}</strong>
                            <span>
                              {badge.lat.toFixed(4)}, {badge.lng.toFixed(4)}
                            </span>
                          </div>
                          <span className="row-number">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <ChevronRight size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="field-note">
                  <Compass size={20} strokeWidth={1.4} />
                  <div>
                    <strong>A little room to explore.</strong>
                    <p>Pan, zoom, and mark the places that matter to you.</p>
                  </div>
                </div>
              </>
            ) : (
              <form className="editor" onSubmit={commitBadge}>
                <div className="editor-title">
                  <h3>{editing ? "Edit badge" : "New badge"}</h3>
                  <div className="editor-title-actions">
                    {editing && <button type="button" className="badge-settings-reset" onClick={resetBadgeSettings} title="Reset badge settings">
                      <RotateCcw size={14} /> <span>Reset settings</span>
                    </button>}
                    {editing && <button type="button" className="badge-settings-reset" onClick={cloneBadge} title="Create a copy of this badge">
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
                    <small>PNG, JPG or WebP · up to 5 MB</small>
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
                <fieldset className="symbol-field">
                  <legend className="field-label">Badge symbol</legend>
                  <div className="symbol-options">
                    {BADGE_SYMBOLS.map((symbol) => (
                      <label
                        className={`symbol-option ${draft.symbol === symbol.value ? "active" : ""}`}
                        key={symbol.value}
                      >
                        <input
                          type="radio"
                          name="badge-symbol"
                          value={symbol.value}
                          checked={draft.symbol === symbol.value}
                          onChange={() => updateDraft({ symbol: symbol.value })}
                        />
                        <span className="symbol-option-art" aria-hidden="true">
                          {symbol.paths.length ? (
                            <svg viewBox={symbol.viewBox}>
                              {symbol.paths.map((path) => (
                                <path
                                  key={path.d}
                                  fill="currentColor"
                                  fillRule={path.fillRule}
                                  d={path.d}
                                />
                              ))}
                            </svg>
                          ) : (
                            <span className="symbol-none-mark">—</span>
                          )}
                        </span>
                        <span className="symbol-option-label">
                          {symbol.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {draft.symbol === "custom" && <label className="upload-zone" htmlFor="symbol-image"><ImagePlus size={22} /><span><strong>{draft.symbolImage ? "Change symbol image" : "Choose symbol image"}</strong><small>PNG, JPG or WebP · up to 5 MB</small></span><Upload size={15} /><input id="symbol-image" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => uploadFeatureImage(event, "badge")} /></label>}
                <label className="field-label">Stars <span>{draft.stars ?? 0} / 5</span><select value={draft.stars ?? 0} onChange={(event) => updateDraft({ stars: Number(event.target.value) })}>{[0, 1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>{count === 0 ? "0 · No stars" : `${count} · ${"★".repeat(count)}`}</option>)}</select></label>
                <label className="field-label">Troop number<input type="number" min="0" max={Number.MAX_SAFE_INTEGER} step="1" required value={draft.troopCount ?? 0} onChange={(event) => { const troopCount = Number(event.target.value); if (Number.isSafeInteger(troopCount) && troopCount >= 0) updateDraft({ troopCount, route: draft.route.map((stop, index) => index === 0 ? { ...stop, troopCount } : stop) }); }} /></label>
                <p className="field-hint">Hidden when 0. Set troop numbers at route stops to increase or decrease them during movement.</p>
                <SizePicker value={draft.size} onChange={(size) => updateDraft({ size })} />
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
                {mapStatus !== "ready" && (
                  <p className="field-hint">
                    Connect the map, or enter coordinates below.
                  </p>
                )}
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
                {draft.route.length > 0 && <p className="field-hint">Edit stop A below to change this badge’s starting position.</p>}
                <VisibilityEditor visibility={draft.visibility} onChange={(visibility) => updateDraft({ visibility })} />
                <RouteEditor badge={draft} effectTargets={[...project.badges, ...project.units]} onChange={updateDraft} mapReady={mapStatus === "ready"} mode={mode} onMode={changeMode} onPickTargetLocation={pickTargetLocation} targetLocationStopId={targetLocationStopId} onPickRouteLocation={pickRouteLocation} routeLocationStopId={routeLocationStopId} onFocus={(stop) => { const position = coordinates(stop.lat, stop.lng); if (position) mapRef.current?.focus(position); }} />
                {formError && (
                  <p className="form-error" role="alert">
                    <AlertCircle size={15} />
                    {formError}
                  </p>
                )}
                <div className="editor-actions">
                  <button
                    className="primary"
                    type="submit"
                    disabled={uploading}
                  >
                    <Check size={17} />
                    {editing ? "Save changes" : "Save badge"}
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => {
                      if (discardAllowed()) resetEditor();
                    }}
                  >
                    Cancel
                  </button>
                </div>
                {editing && (
                  <button
                    className="delete-button"
                    type="button"
                    onClick={deleteBadge}
                  >
                    <Trash2 size={15} />
                    Delete badge
                  </button>
                )}
              </form>
            )}
          </div>
          <footer
            className={`sidebar-footer ${saveStatus === "error" ? "save-error" : ""}`}
            aria-live="polite"
          >
            <span className="status-dot" />
            <div>
              <strong>
                {saveStatus === "saved"
                  ? "Saved on this device"
                  : saveStatus === "saving"
                    ? "Saving your map…"
                    : saveStatus === "error"
                      ? "Not saved · export a backup"
                      : "Opening your workspace…"}
              </strong>
              <span>No account needed. Just your map.</span>
            </div>
            {saveStatus === "saved" && <Check size={15} />}
          </footer>
        </aside>

        <section ref={mapStageRef} className={`map-stage ${range ? "has-timeline" : ""}${videoOpen ? " video-framing" : ""}`} aria-label="Map workspace">
          <div className="map-placeholder" aria-hidden="true">
            <div className="globe-ring ring-one" />
            <div className="globe-ring ring-two" />
            <div className="globe-ring ring-three" />
            <span className="grid-label">A WORLD OF POSSIBILITIES</span>
          </div>
          {ready && (!videoOpen || videoFrame?.width > 0) && (
            <div className={videoOpen ? "video-frame" : "map-surface"} style={videoOpen ? { width: videoFrame.width, height: videoFrame.height } : undefined}>
            <MapCanvas
              key={videoOpen ? `video-${videoOrientation}` : "editor"}
              ref={mapRef}
              initialView={videoOpen ? videoCamera : editingView.current ?? initialView}
              badges={project.badges}
              units={project.units}
              draft={draft}
              unitDraft={unitDraft}
              targetLocationStopId={targetLocationStopId}
              selectedId={selectedId}
              mode={videoOpen ? "export" : mode}
              preview={playback.preview}
              previewTime={playback.cursor}
              animationRange={range}
              animationDuration={project.playbackDuration}
              lines={project.lines}
              paintStrokes={project.paintStrokes}
              brush={brush}
              onPaintStroke={(stroke) => setProject((current) => {
                const pointCount = current.paintStrokes.reduce((count, item) => count + item.points.length, stroke.points.length);
                if (current.paintStrokes.length >= MAX_PAINT_STROKES || pointCount > MAX_PAINT_POINTS) { setMessage({ error: true, text: "Paint limit reached. Undo or clear paint to continue." }); return current; }
                return { ...current, paintStrokes: [...current.paintStrokes, stroke] };
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
            {videoOpen && videoShowDate && <time className="video-date-stamp">{videoDate(playback.cursor)}</time>}
            </div>
          )}
          {!videoOpen && <div className="map-toolbar">
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
            <button className="map-button image-export-toolbar-button" disabled={!ready || mapStatus !== "ready" || pictureExporting || videoOpen} onClick={downloadPicture} aria-label="Download map picture" title="Download map picture">
              {pictureExporting ? <LoaderCircle size={16} className="spin" /> : <ImageDown size={16} />}
              <span>{pictureExporting ? "Creating picture…" : "Download picture"}</span>
            </button>
            <button
              className="map-button fullscreen-button"
              onClick={() => setMapFullscreen((current) => !current)}
              aria-label={mapFullscreen ? "Exit full screen map" : "Show full screen map"}
              aria-pressed={mapFullscreen}
              title={mapFullscreen ? "Exit full screen map (Esc)" : "Show full screen map"}
            >
              {mapFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              <span>{mapFullscreen ? "Exit full screen" : "Full screen"}</span>
            </button>
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
          {(timelineMinimized || mapFullscreen) && !videoOpen && timeline}
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
    </div>
  );
}
