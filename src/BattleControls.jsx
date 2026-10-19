import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_SCENARIO_DATE, scenarioTime } from "./timeline.js";

export default function BattleControls({ battle, beforeStart, mapReady, playback }) {
  const dialogRef = useRef(null);
  const [startDate, setStartDate] = useState(DEFAULT_SCENARIO_DATE);
  const [dateError, setDateError] = useState("");
  useEffect(() => { dialogRef.current?.close(); }, [battle.mode]);
  function start() {
    const time = scenarioTime(startDate);
    if (time === null) { setDateError("Choose a valid starting date and time."); return; }
    setDateError("");
    if (beforeStart()) {
      battle.start(time);
    }
  }
  function stop() {
    battle.edit();
    playback.edit();
  }
  return <div className="battle-launcher">
    <button type="button" className="text-button" aria-haspopup="dialog" onClick={() => dialogRef.current?.showModal()}>Battle controls</button>
    {createPortal(<dialog ref={dialogRef} className="battle-dialog" aria-labelledby="battle-dialog-title">
      <div className="battle-dialog-heading"><h3 id="battle-dialog-title">Battle controls</h3><button type="button" aria-label="Close battle controls" onClick={() => dialogRef.current?.close()}>×</button></div>
      <div className="battle-controls">
        <label className="field-label">Starting scenario date and time<input type="datetime-local" min="0001-01-01T00:00" max="9999-12-31T23:59" step="60" required disabled={battle.mode === "command"} value={startDate} onChange={(event) => { setStartDate(event.target.value); setDateError(""); }} /></label>
        {dateError && <p className="form-error" role="alert">{dateError}</p>}
        <div className="group-actions">
          <button type="button" className="primary" disabled={!mapReady || battle.busy || battle.mode === "command"} onClick={start}>{battle.busy ? "Starting…" : "Start"}</button>
          <button type="button" disabled={battle.mode !== "command"} onClick={stop}>Finish planning</button>
          {battle.mode === "command" && <>
            <button type="button" disabled={!battle.canUndo} onClick={battle.undo}>Undo last point</button>
            <button type="button" onClick={() => { battle.cancel(); playback.edit(); }}>Cancel planning</button>
          </>}
        </div>
        <p>Select multiple badges or equipment, then right-click destinations to add movement route stops. Use Play to preview the routes.</p>
        {battle.notice && <p className="battle-notice" role="status">{battle.notice}</p>}
      </div>
    </dialog>, document.body)}
  </div>;
}
