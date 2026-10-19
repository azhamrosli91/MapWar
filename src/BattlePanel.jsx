import { Flag, X } from "lucide-react";
import { unitImage } from "./badge.js";
import { isDefeated } from "./combat.js";
import { videoDate } from "./video.js";

export default function BattlePanel({ battle, activeGroupId, onFocus }) {
  const forces = (battle.frame?.forces ?? []).filter((force) => force.groupId === activeGroupId && !isDefeated(force) && force.visible);
  const selected = forces.filter((force) => battle.selectedIds.includes(force.id));
  return <section className="battle-panel" aria-label="Battle selection and orders">
    <div className="battle-panel-heading">
      <div><strong>{selected.length} selected</strong><time>{videoDate(battle.frame?.at)}</time></div>
      <div className="battle-panel-actions">
        <button type="button" onClick={() => battle.edit()}>Finish planning</button>
        <button type="button" disabled={!battle.canUndo} onClick={battle.undo}>Undo last point</button>
        <button type="button" onClick={battle.cancel}>Cancel planning</button>
        <button type="button" disabled={!forces.length} onClick={() => battle.select(forces.map((force) => force.id))}>Select all</button>
        <button type="button" disabled={!selected.length} onClick={() => battle.select([])}>Clear</button>
      </div>
    </div>
    <p className="battle-panel-help">Drag to pan · Click to select · Shift / Ctrl / ⌘ click or drag to select multiple · Right-click to add stops · Play to preview</p>
    {selected.length > 0 && <div className="battle-selection-cards" aria-label="Selected badges and equipment">
      {selected.map((force) => {
        const image = force.featureType === "unit" ? unitImage(force) : force.flag;
        return <div className="battle-selection-card" key={force.id}>
          <button className="battle-card-focus" type="button" onClick={() => onFocus(force)} title="Show on map">
            <span className="battle-card-art">{image ? <img src={image} alt="" /> : <Flag size={24} />}</span>
            <strong>{force.label ?? force.name}</strong>
            <span>{force.count.toLocaleString()} {force.featureType === "badge" ? "troops" : "equipment"}</span>
            <small>{force.route.length ? `${force.route.length} route stops` : "No movement route"}</small>
          </button>
          <button type="button" className="battle-card-remove" aria-label={`Deselect ${force.label ?? force.name}`} onClick={() => battle.select([force.id], true)}><X size={12} /></button>
        </div>;
      })}
    </div>}
    {battle.notice && <p className="battle-notice" role="status">{battle.notice}</p>}
  </section>;
}
