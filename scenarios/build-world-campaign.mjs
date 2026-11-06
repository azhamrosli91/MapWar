import { readFile, writeFile } from "node:fs/promises";

const revision = "f1890d9f152c896d250a77557a5751a93d494776";
const url = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${revision}/geojson/ne_50m_admin_0_countries.geojson`;
const response = await fetch(url);
if (!response.ok) throw new Error(`Natural Earth download failed: ${response.status}`);
const collection = await response.json();
const regional = JSON.parse(await readFile(new URL("../public/territory/malaya-1941-42-v1.json", import.meta.url), "utf8"));
const countries = Object.fromEntries(collection.features
  .filter((feature) => feature.properties.ADM0_A3 !== "ATA")
  .map((feature) => [feature.properties.ADM0_A3, { name: feature.properties.NAME, geometry: feature.geometry }]));
// Retain detailed coastlines for the existing regional campaign and tiny Singapore.
Object.assign(countries, regional.countries);
const output = {
  id: "world-1939-45-v1", countries,
  sources: [
    { name: "Natural Earth 1:50m country boundaries", revision, license: "Public domain", url },
    ...regional.sources.filter((source) => source.license),
    { name: "USHMM: World War II key dates", url: "https://encyclopedia.ushmm.org/content/en/article/world-war-ii-key-dates" },
    { name: "Australian War Memorial: Invasion of Malaya", url: "https://www.awm.gov.au/collection/E84717" },
    { name: "Australian War Memorial: Battle for Singapore", url: "https://www.awm.gov.au/collection/E84308" },
  ],
  note: "Country-scale WWII alignment and occupation milestones on modern borders and coastlines, not reconstructed wartime boundaries. Modern successor states stand in for historical colonies and the Soviet Union. Mixed areas represent divided control or a campaign period, not surveyed frontlines. Changes summarize campaigns rather than the precise day every locality changed hands. Neutral includes countries outside tracked alliances. European Axis includes co-belligerent Finland; Japan includes aligned Thailand. Allied control after surrender does not imply Allied membership.",
};
await writeFile(new URL("../public/territory/world-1939-45-v1.json", import.meta.url), JSON.stringify(output));
console.log(`Built worldwide WWII geometry: ${Object.keys(countries).length} areas.`);
