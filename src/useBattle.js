import { useEffect, useMemo, useRef, useState } from "react";
import { distance, initialForces, isVisible } from "./combat.js";
import { checkProjectSize, coordinates } from "./data.js";
import { MAX_STOPS, routeError, scenarioTime } from "./timeline.js";

export default function useBattle(project, setProject, activeGroupId) {
  const [mode, setMode] = useState("edit");
  const [selectedIds, setSelectedIds] = useState([]);
  const [notice, setNotice] = useState("");
  const [startAt, setStartAt] = useState(null);
  const sessionStart = useRef(null);
  const history = useRef([]);
  const [undoCount, setUndoCount] = useState(0);
  const live = useRef(null);
  live.current = { project, selectedIds, activeGroupId, mode, startAt };
  const frame = useMemo(() => mode !== "command" ? null : {
    at: startAt,
    forces: initialForces(project).map((force) => {
      const last = force.route.at(-1);
      return { ...force, lat: Number(last?.lat ?? force.lat), lng: Number(last?.lng ?? force.lng),
        count: last?.troopCount ?? force.count, visible: isVisible(force, startAt) };
    }),
  }, [mode, project, startAt]);

  function start(time) {
    const at = Math.floor(time / 60000) * 60000;
    if (!Number.isSafeInteger(at) || Math.abs(at) > 8640000000000000 || scenarioTime(new Date(at).toISOString().slice(0, 16)) === null) {
      setNotice("Choose a valid scenario starting date and time."); return;
    }
    sessionStart.current = { badges: project.badges, units: project.units };
    history.current = [];
    setUndoCount(0);
    setStartAt(at); setSelectedIds([]); setNotice(""); setMode("command");
  }
  function select(ids, additive = false) {
    const current = live.current;
    const permitted = ids.filter((id) => [...current.project.badges, ...current.project.units].some((feature) =>
      feature.id === id && feature.groupId === current.activeGroupId && isVisible(feature, current.startAt)));
    setSelectedIds((previous) => additive
      ? [...previous.filter((id) => !permitted.includes(id)), ...permitted.filter((id) => !previous.includes(id))]
      : permitted);
  }
  function command(destination) {
    const current = live.current;
    if (current.mode !== "command" || !coordinates(destination?.lat, destination?.lng)) return;
    const selected = new Set(current.selectedIds);
    if (!selected.size) { setNotice("Select badges or equipment in the active group first."); return; }
    const notices = [];
    let changed = 0;
    const append = (feature, equipment) => {
      if (!selected.has(feature.id) || feature.groupId !== current.activeGroupId) return feature;
      const name = feature.label ?? feature.name;
      const problem = routeError(feature.route);
      if (problem) { notices.push(name + ": " + problem); return feature; }
      const force = initialForces({ badges: equipment ? [] : [feature], units: equipment ? [feature] : [] })[0];
      if (!force.combat.speed) { notices.push(name + ": stationary forces cannot move."); return feature; }
      const route = structuredClone(feature.route);
      if (!route.length) route.push({ id: crypto.randomUUID(), lat: Number(feature.lat), lng: Number(feature.lng),
        dateTime: new Date(current.startAt).toISOString().slice(0, 16), size: feature.size,
        ...(equipment ? {} : { troopCount: feature.troopCount ?? 0 }), effect: "none" });
      if (route.length >= MAX_STOPS) { notices.push(name + ": movement route has reached " + MAX_STOPS + " stops."); return feature; }
      const last = route.at(-1);
      const meters = distance(last, destination);
      if (meters < 1) return feature;
      const departure = Math.max(scenarioTime(last.dateTime), current.startAt);
      // Route timestamps use minute precision; each destination must follow the last stop.
      const arrival = departure + Math.max(1, Math.ceil(meters / (force.combat.speed / 3.6) / 60)) * 60000;
      route.push({ id: crypto.randomUUID(), lat: Number(destination.lat), lng: Number(destination.lng),
        dateTime: new Date(arrival).toISOString().slice(0, 16), size: last.size,
        ...(equipment ? {} : { troopCount: last.troopCount ?? feature.troopCount ?? 0 }), effect: "none" });
      const nextProblem = routeError(route);
      if (nextProblem) { notices.push(name + ": " + nextProblem); return feature; }
      changed++;
      return { ...feature, route, showTrail: true };
    };
    try {
      const updated = { ...current.project, badges: current.project.badges.map((feature) => append(feature, false)), units: current.project.units.map((feature) => append(feature, true)) };
      if (changed) {
        checkProjectSize(updated);
        history.current.push({ badges: current.project.badges, units: current.project.units });
        setUndoCount(history.current.length);
        live.current = { ...current, project: updated };
        setProject(updated);
      }
      setNotice(notices.join(" ") || (changed ? "Destination added to " + changed + " movement route(s)." : "Choose a different destination."));
    } catch (error) { setNotice(error.message); }
  }
  function edit() {
    sessionStart.current = null;
    history.current = [];
    setUndoCount(0);
    setMode("edit"); setSelectedIds([]); setNotice("");
  }
  function undo() {
    if (live.current.mode !== "command" || !history.current.length) return;
    const updated = { ...live.current.project, ...history.current.pop() };
    live.current = { ...live.current, project: updated };
    setProject(updated);
    setUndoCount(history.current.length);
    setNotice("Last destination undone.");
  }
  function cancel() {
    if (live.current.mode !== "command") return;
    if (sessionStart.current) {
      const updated = { ...live.current.project, ...sessionStart.current };
      live.current = { ...live.current, project: updated };
      setProject(updated);
    }
    edit();
  }
  useEffect(() => { setSelectedIds([]); }, [activeGroupId]);
  return { mode, frame, selectedIds, replayId: null, replay: null, snapshot: null,
    busy: false, notice, start, select, command, edit, cancel, undo, canUndo: undoCount > 0, stop: () => setSelectedIds([]), save: () => true };
}
