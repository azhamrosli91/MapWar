import { COMBAT_TYPES, DEFAULT_COMBAT_RANGES, defaultCombat, normalizeCombat } from "./combat.js";

export default function ForceSettings({ feature, groups, onChange, equipment = false }) {
  const combat = normalizeCombat(feature.combat, feature);
  const update = (changes) => onChange({ combat: { ...combat, ...changes } });
  return <div className="force-settings">
    <label className="field-label">Group<select value={feature.groupId} onChange={(event) => onChange({ groupId: event.target.value })}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
    {equipment && <label className="field-label">Quantity<input type="number" min="0" max="1000000000" step="1" required value={feature.quantity ?? 1} onChange={(event) => { const quantity = Number(event.target.value); if (Number.isSafeInteger(quantity) && quantity >= 0 && quantity <= 1e9) onChange({ quantity }); }} /></label>}
    <section aria-label="Movement & combat"><h3>Movement &amp; combat</h3>
      <label className="field-label">Combat type<select value={combat.type} onChange={(event) => update({ type: event.target.value, range: DEFAULT_COMBAT_RANGES[event.target.value] })}>{COMBAT_TYPES.map((type) => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}</select></label>
      
      <label className="field-label">Movement terrain<select value={combat.domain} onChange={(event) => update({ domain: event.target.value })}><option value="land">Land</option><option value="naval">Water</option><option value="air">Air</option></select></label>
      <div className="combat-fields">{[["range", "Firing radius (km)", 0, 2000], ["health", "Health per member", 1, 1e9], ["damage", "Damage per member", 0, 1e9], ["interval", "Firing interval (scenario minutes)", 1 / 60, 1440]].map(([key, label, min, max]) => <label className="field-label" key={key}>{label}<input type="number" min={min} max={max} step="any" required value={key === "interval" ? combat.interval / 60 : combat[key]} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value) && value >= min && value <= max) update({ [key]: key === "interval" ? value * 60 : value }); }} /></label>)}</div>
      <fieldset><legend>Can attack</legend>{["land", "naval", "air"].map((domain) => <label className="target-domain" key={domain}><input type="checkbox" checked={combat.targets.includes(domain)} onChange={(event) => update({ targets: event.target.checked ? [...combat.targets, domain] : combat.targets.filter((value) => value !== domain) })} />{domain === "naval" ? "Water" : domain}</label>)}</fieldset>
      <button type="button" className="secondary" onClick={() => onChange({ combat: defaultCombat(feature) })}>Reset combat preset</button>
    </section>
  </div>;
}
