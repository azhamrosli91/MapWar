import { BADGE_TERRITORY_DEFAULTS, TERRITORY_DEFAULTS, chooseTerritoryOrigin } from "./territory.js";

export function BadgeTerritorySettings({ badge, onChange }) {
  const settings = { ...BADGE_TERRITORY_DEFAULTS, ...badge.territory };
  const update = (changes) => onChange({ territory: { ...settings, ...changes } });
  return <section className="territory-settings" aria-label="Badge territory capture">
    <h3>Territory capture</h3>
    <label><input type="checkbox" checked={settings.captureEnabled} onChange={(e) => update({ captureEnabled: e.target.checked })} /> Enable Territory Capture</label>
    <label className="field-label">Capture Radius (metres)<input type="number" min="1" max="50000" step="any" required value={settings.captureRadiusMeters} onChange={(e) => { const value = Number(e.target.value); if (value >= 1 && value <= 50000) update({ captureRadiusMeters: value }); }} /></label>
    {badge.combat?.domain && badge.combat.domain !== "land" && <label><input type="checkbox" checked={settings.allowNonLandCapture} onChange={(e) => update({ allowNonLandCapture: e.target.checked })} /> Allow geometric capture by this naval or aerial badge (no terrain filtering)</label>}
    <p>Captures follow saved dated routes, including hidden portions. A first stop captures once. Equipment and editor dragging do not capture territory.</p>
  </section>;
}

export default function TerritorySettings({ project, onChange }) {
  const settings = { ...TERRITORY_DEFAULTS, ...project.territory };
  const update = (changes) => onChange({ ...project, territory: { ...settings, ...changes } });
  const campaign = settings.campaign ?? { id: "malaya-1941-42-v1", initialGroupId: project.groups.find((g) => g.id === "bersekutu")?.id ?? project.groups[0]?.id, captureGroupId: project.groups.find((g) => g.id === "jepun")?.id ?? project.groups[1]?.id, hideLegacyCapturePaint: true };
  return <section className="territory-settings" aria-label="Territory settings">
    <h3>Dynamic Territory</h3>
    <label><input type="checkbox" checked={settings.enabled} onChange={(e) => update({ enabled: e.target.checked, origin: settings.origin ?? chooseTerritoryOrigin(project.badges, project.view.center) })} /> Enable Dynamic Territory</label>
    <label className="field-label">Territory method<select value={settings.mode} onChange={(e) => update({ mode: e.target.value, campaign: e.target.value === "campaign" ? campaign : settings.campaign })}><option value="routes">Badge route corridors</option><option value="campaign" disabled={project.groups.length < 2}>Historical land areas · Malaya 1941–42</option></select></label>
    {settings.mode === "campaign" ? <>
      {[["initialGroupId", "Initial territory color"], ["captureGroupId", "Japanese advance color"]].map(([key, label]) => <label className="field-label" key={key}>{label}<select value={campaign[key]} onChange={(e) => { const next = { ...campaign, [key]: e.target.value }; const other = key === "initialGroupId" ? "captureGroupId" : "initialGroupId"; if (next[other] === next[key]) next[other] = project.groups.find((g) => g.id !== next[key]).id; update({ campaign: next }); }}>{project.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>)}
      <label><input type="checkbox" checked={campaign.hideLegacyCapturePaint} onChange={(e) => update({ campaign: { ...campaign, hideLegacyCapturePaint: e.target.checked } })} /> Hide old campaign capture paint (keep it saved)</label>
      <p>Malaysia, Thailand and Singapore start in the initial color. Thailand changes on 8 December 1941; Malaya and Singapore change as dated historical localities fall. Filled areas follow coastlines, independently of badge routes. The advancing boundary is a schematic interpolation between those locations.</p>
    </> : <label className="field-label">Grid Resolution (metres)<input type="number" min="25" max="5000" step="any" value={settings.cellSizeMeters} onChange={(e) => { const value = Number(e.target.value); if (value >= 25 && value <= 5000) update({ cellSizeMeters: value }); }} /></label>}
    <label className="field-label">Territory Opacity · {Math.round(settings.opacity * 100)}%<input type="range" min="0" max="100" value={Math.round(settings.opacity * 100)} onChange={(e) => update({ opacity: Number(e.target.value) / 100 })} /></label>
    <label><input type="checkbox" checked={settings.showFrontline} onChange={(e) => update({ showFrontline: e.target.checked })} /> Show Frontline</label>
    {settings.mode === "routes" && <><label><input type="checkbox" checked={settings.showDebugGrid} onChange={(e) => update({ showDebugGrid: e.target.checked })} /> Show Debug Grid</label>
      <p>Enable capture in each badge’s settings. Territory uses group colors and remains separate from manual paint. All coverage must stay within 3,000 km of the fixed origin.</p>
      {settings.origin && <><small>Origin: {settings.origin.lat.toFixed(4)}, {settings.origin.lng.toFixed(4)}</small><button type="button" disabled={settings.enabled} onClick={() => update({ origin: chooseTerritoryOrigin(project.badges, project.view.center) })}>Reset origin from routes</button></>}
    </>}
  </section>;
}
