// Country-scale overview, not a reconstruction of daily military frontlines.
export const WORLD_CAMPAIGN_ID = "world-1939-45-v1";
export const WORLD_CAMPAIGN_DATES = ["1939-09-01T00:00", "1945-09-02T12:00"];
export const WORLD_GROUPS = [
  { id: "ww2-allies", name: "Allies", color: "#3478d4" },
  { id: "ww2-european-axis", name: "Germany / European Axis", color: "#b33c40" },
  { id: "ww2-japan", name: "Japan", color: "#df982e" },
];
export const WORLD_THEATERS = [
  { name: "Whole world", center: { lat: 20, lng: 15 }, zoom: 2 },
  { name: "Europe", center: { lat: 51, lng: 15 }, zoom: 4 },
  { name: "North Africa", center: { lat: 29, lng: 20 }, zoom: 4 },
  { name: "Asia & Pacific", center: { lat: 15, lng: 135 }, zoom: 3 },
];
export const WORLD_LEGEND = [
  ["allies", "Allies / Allied control", "#3478d4", "initialGroupId"],
  ["germany", "European Axis / occupation", "#b33c40", "captureGroupId"],
  ["japan", "Japan / occupation", "#df982e", "japanGroupId"],
  ["mixed", "Divided / contested", "#9876ad"],
  ["neutral", "Neutral / untracked", "#939b9d"],
];

export function enableWorldCampaign(project) {
  const groups = [...project.groups];
  // Reuse previously created factions without changing any existing group colors.
  const ids = WORLD_GROUPS.map((group) => {
    const existing = groups.find((item) => item.id === group.id);
    if (existing) return existing.id;
    groups.push({ ...group });
    return group.id;
  });
  if (groups.length > 256) throw new Error("Remove unused groups before adding the WWII factions.");
  return { ...project, groups, view: { ...project.view, center: WORLD_THEATERS[0].center, zoom: WORLD_THEATERS[0].zoom, heading: 0 },
    territory: { ...project.territory, enabled: true, mode: "campaign", campaign: {
      id: WORLD_CAMPAIGN_ID, initialGroupId: ids[0], captureGroupId: ids[1], japanGroupId: ids[2], hideLegacyCapturePaint: true,
    } } };
}

const rules = new Map();
function track(codes, initial, changes = []) {
  for (const code of codes.split(" ")) rules.set(code, { initial, changes: changes.map(([date, state]) => [Date.parse(`${date}T00:00:00Z`), state]) });
}
const gb = [["1939-09-03", "allies"]];
track("GBR IND PAK BGD LKA NPL BTN CAN AUS NZL ZAF ZMB ZWE BWA LSO SWZ MWI KEN UGA TZA NGA GHA GMB SLE GGY JEY IMN BMU FLK GIB BLZ GUY JAM TTO BHS BRB ATG DMA GRD KNA LCA VCT MUS SYC MLT CYP PSE ISR JOR FJI SLB VUT", "neutral", gb);
track("CAN", "neutral", [["1939-09-10", "allies"]]);
track("ZAF", "neutral", [["1939-09-06", "allies"]]);
track("DEU AUT CZE SVK ALB", "germany", [["1945-05-08", "allies"]]);
track("ITA", "neutral", [["1940-06-10", "germany"], ["1943-09-08", "mixed"], ["1945-05-02", "allies"]]);
track("HUN", "neutral", [["1940-11-20", "germany"], ["1944-09-23", "mixed"], ["1945-04-04", "allies"]]);
track("ROU", "neutral", [["1940-11-23", "germany"], ["1944-08-23", "allies"]]);
track("BGR", "neutral", [["1941-03-01", "germany"], ["1944-09-09", "allies"]]);
track("FIN", "neutral", [["1939-11-30", "mixed"], ["1940-03-13", "neutral"], ["1941-06-25", "germany"], ["1944-09-19", "mixed"], ["1945-04-27", "neutral"]]);
track("POL", "mixed", [["1941-06-22", "germany"], ["1944-07-22", "mixed"], ["1945-05-08", "allies"]]);
track("FRA", "neutral", [["1939-09-03", "allies"], ["1940-05-10", "mixed"], ["1942-11-11", "germany"], ["1944-06-06", "mixed"], ["1945-05-08", "allies"]]);
track("DNK", "neutral", [["1940-04-09", "germany"], ["1945-05-05", "allies"]]);
track("NOR", "neutral", [["1940-04-09", "mixed"], ["1940-06-10", "germany"], ["1945-05-08", "allies"]]);
track("BEL NLD LUX", "neutral", [["1940-05-10", "mixed"], ["1940-05-28", "germany"], ["1944-09-01", "mixed"], ["1945-05-05", "allies"]]);
track("SRB HRV BIH SVN MNE MKD KOS", "neutral", [["1941-04-06", "mixed"], ["1941-04-17", "germany"], ["1944-09-01", "mixed"], ["1945-05-08", "allies"]]);
track("GRC", "neutral", [["1940-10-28", "allies"], ["1941-04-06", "mixed"], ["1941-06-01", "germany"], ["1944-10-12", "mixed"], ["1945-05-08", "allies"]]);
track("RUS KAZ UZB TKM KGZ TJK ARM AZE GEO", "neutral", [["1941-06-22", "allies"]]);
track("UKR BLR MDA", "neutral", [["1941-06-22", "mixed"], ["1944-08-31", "allies"]]);
track("EST LVA LTU", "neutral", [["1940-06-17", "mixed"], ["1941-07-01", "germany"], ["1944-09-01", "mixed"], ["1945-05-09", "allies"]]);
track("JPN KOR PRK TWN", "japan", [["1945-09-02", "allies"]]);
track("CHN", "mixed", [["1945-09-02", "allies"]]);
track("USA", "neutral", [["1941-12-08", "allies"]]);
track("MYS BRN", "neutral", [["1939-09-03", "allies"], ["1941-12-08", "mixed"], ["1942-04-01", "japan"], ["1945-06-10", "mixed"], ["1945-09-02", "allies"]]);
track("SGP", "neutral", [["1939-09-03", "allies"], ["1942-02-08", "mixed"], ["1942-02-15", "japan"], ["1945-09-02", "allies"]]);
track("HKG", "neutral", [["1939-09-03", "allies"], ["1941-12-08", "mixed"], ["1941-12-25", "japan"], ["1945-09-02", "allies"]]);
track("THA", "neutral", [["1941-12-08", "mixed"], ["1942-01-25", "japan"], ["1945-08-16", "neutral"]]);
track("MMR", "neutral", [["1939-09-03", "allies"], ["1942-01-20", "mixed"], ["1945-09-02", "allies"]]);
track("VNM LAO KHM", "neutral", [["1939-09-03", "allies"], ["1940-09-22", "mixed"], ["1945-03-09", "japan"], ["1945-09-02", "mixed"]]);
track("PHL", "neutral", [["1941-12-08", "mixed"], ["1942-05-06", "japan"], ["1944-10-20", "mixed"], ["1945-09-02", "allies"]]);
track("IDN", "neutral", [["1940-05-10", "allies"], ["1942-01-11", "mixed"], ["1942-03-09", "japan"], ["1945-08-17", "mixed"]]);
track("PNG", "neutral", [["1939-09-03", "allies"], ["1942-01-23", "mixed"], ["1945-09-02", "allies"]]);
track("SLB", "neutral", [["1939-09-03", "allies"], ["1942-05-03", "mixed"], ["1945-09-02", "allies"]]);
track("PLW FSM MHL MNP", "japan", [["1944-02-17", "mixed"], ["1945-09-02", "allies"]]);
track("GUM", "neutral", [["1941-12-10", "japan"], ["1944-08-10", "allies"]]);
track("LBY", "neutral", [["1940-06-10", "mixed"], ["1943-02-02", "allies"]]);
track("ETH ERI SOM", "mixed", [["1941-11-27", "allies"]]);
track("EGY", "allies", [["1940-09-13", "mixed"], ["1942-11-11", "allies"]]);
track("DZA MAR TUN", "neutral", [["1939-09-03", "allies"], ["1940-06-25", "mixed"], ["1942-11-08", "mixed"], ["1943-05-13", "allies"]]);
track("SEN MLI MRT NER TCD CMR GAB COG CAF BFA BEN CIV GIN MDG DJI COM", "neutral", [["1939-09-03", "allies"], ["1940-06-25", "mixed"], ["1943-05-13", "allies"]]);
track("COD RWA BDI SUR", "neutral", [["1940-05-10", "allies"]]);
track("BRA", "neutral", [["1942-08-22", "allies"]]);
track("MEX", "neutral", [["1942-05-22", "allies"]]);
track("CUB PAN CRI GTM HND NIC SLV HTI DOM", "neutral", [["1941-12-12", "allies"]]);
track("MNG", "neutral", [["1945-08-09", "allies"]]);
track("TUR", "neutral", [["1945-02-23", "allies"]]);
track("IRN", "neutral", [["1941-08-25", "mixed"], ["1943-09-09", "allies"]]);
track("IRQ", "neutral", [["1941-04-01", "mixed"], ["1941-06-01", "allies"]]);
track("SYR LBN", "neutral", [["1939-09-03", "allies"], ["1940-06-25", "mixed"], ["1941-07-14", "allies"]]);

export function worldCountryState(code, time) {
  const rule = rules.get(code);
  if (!rule) return "neutral";
  let state = rule.initial;
  for (const [at, next] of rule.changes) {
    if (time < at) break;
    state = next;
  }
  return state;
}
