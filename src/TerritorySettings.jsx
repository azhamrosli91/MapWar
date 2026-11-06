import { BADGE_TERRITORY_DEFAULTS, TERRITORY_DEFAULTS, chooseTerritoryOrigin } from "./territory.js";
import { WORLD_CAMPAIGN_ID, WORLD_THEATERS, enableWorldCampaign } from "./world-campaign.js";

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

export default function TerritorySettings({ project, onChange, onFocus }) {
  const settings = { ...TERRITORY_DEFAULTS, ...project.territory };
  const update = (changes) => onChange({ ...project, territory: { ...settings, ...changes } });
  const campaign = settings.campaign ?? { id: "malaya-1941-42-v1", initialGroupId: project.groups.find((g) => g.id === "bersekutu")?.id ?? project.groups[0]?.id, captureGroupId: project.groups.find((g) => g.id === "jepun")?.id ?? project.groups[1]?.id, hideLegacyCapturePaint: true };
  const world = campaign.id === WORLD_CAMPAIGN_ID;
  const colorFields = world ? [["initialGroupId", "Allies color"], ["captureGroupId", "Germany / European Axis color"], ["japanGroupId", "Japan color"]] : [["initialGroupId", "Initial territory color"], ["captureGroupId", "Japanese advance color"]];
  function chooseWorld() {
    const next = enableWorldCampaign(project);
    onChange(next);
    onFocus?.(next.view);
  }
  return <section className="territory-settings" aria-label="Territory settings">
    <h3>Dynamic Territory</h3>
    <button type="button" className="primary" disabled={project.groups.length + 3 > 256 && !world} onClick={chooseWorld}>Use World War II · 1939–1945</button>
    <p>Explore Germany versus the Allies and Japan versus the Allies across the whole world.</p>
    <label><input type="checkbox" checked={settings.enabled} onChange={(e) => update({ enabled: e.target.checked, origin: settings.origin ?? chooseTerritoryOrigin(project.badges, project.view.center) })} /> Enable Dynamic Territory</label>
    <label className="field-label">Territory method<select value={settings.mode} onChange={(e) => update({ mode: e.target.value, campaign: e.target.value === "campaign" ? campaign : settings.campaign })}><option value="routes">Badge route corridors</option><option value="campaign" disabled={project.groups.length < 2}>Historical land areas</option></select></label>
    {settings.mode === "campaign" ? <>
      <label className="field-label">Historical campaign<select value={campaign.id} onChange={(e) => e.target.value === WORLD_CAMPAIGN_ID ? chooseWorld() : update({ campaign: { id: "malaya-1941-42-v1", initialGroupId: campaign.initialGroupId, captureGroupId: world ? campaign.japanGroupId : campaign.captureGroupId, hideLegacyCapturePaint: campaign.hideLegacyCapturePaint } })}><option value={WORLD_CAMPAIGN_ID}>World War II · 1939–1945</option><option value="malaya-1941-42-v1">Malaya & Singapore · 1941–1942</option></select></label>
      {colorFields.map(([key, label]) => <label className="field-label" key={key}>{label}<select value={campaign[key]} onChange={(e) => {
        const next = { ...campaign, [key]: e.target.value };
        const other = colorFields.find(([field]) => field !== key && campaign[field] === e.target.value)?.[0];
        if (other) next[other] = campaign[key];
        update({ campaign: next });
      }}>{project.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>)}
      <label><input type="checkbox" checked={campaign.hideLegacyCapturePaint} onChange={(e) => update({ campaign: { ...campaign, hideLegacyCapturePaint: e.target.checked } })} /> Hide old campaign capture paint (keep it saved)</label>
      {world ? <>
        <div className="world-theater-controls" aria-label="Focus historical theater">{WORLD_THEATERS.map(({ name, ...view }) => <button type="button" key={name} onClick={() => { const next = { ...project.view, ...view, heading: 0 }; onChange({ ...project, view: next }); onFocus?.(next); }}>{name}</button>)}</div>
        <p>Use the timeline from September 1939 to September 1945. Colors show country-scale alliance and occupation milestones. Purple marks divided or contested areas, including China and the Eastern Front; gray means neutral or outside the tracked alliances. European Axis includes Italy and partners; Japan includes aligned Thailand. Finland is shown with its Axis co-belligerents during 1941–1944.</p>
        <p>Coastlines and country borders are modern. Colonial territories follow their wartime powers where tracked. Changes summarize campaigns and liberation periods; they are not exact daily frontlines or wartime borders. Allied control after surrender does not imply Allied membership.</p>
        <p>Historical references: <a href="https://encyclopedia.ushmm.org/content/en/article/world-war-ii-key-dates" target="_blank" rel="noreferrer">USHMM WWII timeline</a> · <a href="https://www.awm.gov.au/collection/E84717" target="_blank" rel="noreferrer">Australian War Memorial</a>. Boundaries: Natural Earth (public domain).</p>
      </> : <p>Malaysia, Thailand and Singapore start in the initial color. Thailand changes on 8 December 1941; Malaya and Singapore change as dated historical localities fall. Filled areas follow coastlines, independently of badge routes. The advancing boundary is a schematic interpolation between those locations.</p>}
    </> : <label className="field-label">Grid Resolution (metres)<input type="number" min="25" max="5000" step="any" value={settings.cellSizeMeters} onChange={(e) => { const value = Number(e.target.value); if (value >= 25 && value <= 5000) update({ cellSizeMeters: value }); }} /></label>}
    <label className="field-label">Territory Opacity · {Math.round(settings.opacity * 100)}%<input type="range" min="0" max="100" value={Math.round(settings.opacity * 100)} onChange={(e) => update({ opacity: Number(e.target.value) / 100 })} /></label>
    <label><input type="checkbox" checked={settings.showFrontline} onChange={(e) => update({ showFrontline: e.target.checked })} /> {world && settings.mode === "campaign" ? "Show territory outlines" : "Show Frontline"}</label>
    {settings.mode === "routes" && <><label><input type="checkbox" checked={settings.showDebugGrid} onChange={(e) => update({ showDebugGrid: e.target.checked })} /> Show Debug Grid</label>
      <p>Enable capture in each badge’s settings. Territory uses group colors and remains separate from manual paint. All coverage must stay within 3,000 km of the fixed origin.</p>
      {settings.origin && <><small>Origin: {settings.origin.lat.toFixed(4)}, {settings.origin.lng.toFixed(4)}</small><button type="button" disabled={settings.enabled} onClick={() => update({ origin: chooseTerritoryOrigin(project.badges, project.view.center) })}>Reset origin from routes</button></>}
    </>}
  </section>;
}
