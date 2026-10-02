import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const directory = dirname(fileURLToPath(import.meta.url));
const point = {
  singora: [7.2123, 100.5909], kotaBharu: [6.1248, 102.2378], jitra: [6.2668, 100.4197],
  gurun: [5.8202, 100.4772], kampar: [4.3, 101.15], ipoh: [4.5987, 101.09],
  sadao: [6.6364, 100.4213], baling: [5.5507, 100.7976],
  kroh: [5.7058, 100.9994], betong: [5.7718, 101.0715],
  patani: [6.8686, 101.2501], telukIntan: [4.0256, 101.0208],
  machang: [5.7677, 102.2381], kualaLipis: [4.1872, 102.053],
  jerantut: [4.2834, 102.5575], chemor: [4.7195, 101.121],
  gopeng: [4.4768, 101.1681], bidor: [4.1139, 101.2884],
  tanjongMalim: [3.69, 101.5235], alorSetar: [6.1232, 100.3684],
  slimRiver: [3.827, 101.4023], kualaLumpur: [3.1517, 101.6942],
  kualaKrai: [5.5312, 102.1994], kuantan: [3.7974, 103.3219],
  gemas: [2.5795, 102.6138], segamat: [2.582, 102.6191],
  gemencheh: [2.5955, 102.519], bulohKasap: [2.5511, 102.7681],
  payaLang: [2.6028, 102.703],
  muar: [2.05, 102.5667], bakri: [2.0425, 102.654], paritSulong: [1.9759, 102.883],
  yongPeng: [2.0132, 103.0571], ayerHitam: [1.9182, 103.1795],
  labis: [2.3834, 103.0199], kluang: [2.0323, 103.3191],
  simpangRenggam: [1.8267, 103.3087], paloh: [2.183, 103.1977],
  mersing: [2.4299, 103.8355], endau: [2.6522, 103.6225],
  jemaluang: [2.2758, 103.8579], kotaTinggi: [1.7337, 103.9007],
  johorBahru: [1.4582, 103.7649], causeway: [1.446, 103.769], sarimbun: [1.4352, 103.6986],
  tengah: [1.3639, 103.7287], bukitTimah: [1.3279, 103.7936],
  kranji: [1.4252, 103.762], limChuKang: [1.431, 103.7195],
  bukitBrown: [1.3337, 103.8307], macRitchie: [1.3448, 103.8239],
  braddell: [1.3437, 103.847],
  singapore: [1.2899, 103.8519], pasirPanjang: [1.2762, 103.7915],
  bukitChandu: [1.2797, 103.7941], singaporeHarbour: [1.255, 103.81],
  kuantanSea: [3.65, 104.05], kotaBharuSea: [6.22, 102.35],
};

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(name, data) {
  const tag = Buffer.from(name);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const check = Buffer.alloc(4);
  check.writeUInt32BE(crc32(Buffer.concat([tag, data])));
  return Buffer.concat([size, tag, data, check]);
}

function rgbaPng(width, height, colorAt) {
  const pixels = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = y * (1 + width * 4) + 1 + x * 4;
      const [red, green, blue] = colorAt(x, y);
      pixels[offset] = red;
      pixels[offset + 1] = green;
      pixels[offset + 2] = blue;
      pixels[offset + 3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
}

// The Hinomaru identifies land formations; the supplied rising-sun image is a naval ensign.
function japaneseNationalFlag() {
  return rgbaPng(300, 200, (x, y) =>
    (x - 150) ** 2 + (y - 100) ** 2 <= 60 ** 2 ? [188, 0, 45] : [255, 255, 255]);
}

function britishUnionFlag() {
  return rgbaPng(300, 150, (x, y) => {
    const diagonal = Math.min(Math.abs(y - x / 2), Math.abs(y - (150 - x / 2)));
    if (Math.abs(x - 150) < 12 || Math.abs(y - 75) < 12) return [200, 16, 46];
    if (Math.abs(x - 150) < 22 || Math.abs(y - 75) < 22) return [255, 255, 255];
    if (diagonal < 6) return [200, 16, 46];
    if (diagonal < 14) return [255, 255, 255];
    return [1, 33, 105];
  });
}

const image = async (name, mime) => `data:${mime};base64,${(await readFile(join(directory, "assets", name))).toString("base64")}`;
const flags = {
  japan: `data:image/png;base64,${japaneseNationalFlag()}`,
  britain: `data:image/png;base64,${britishUnionFlag()}`,
  naval: await image("japan-naval-ensign.webp", "image/webp"),
  india: await image("british-india-red-ensign.png", "image/png"),
  australia: await image("australia.webp", "image/webp"),
};
const stopPlaces = new Map();

function stops(prefix, entries) {
  return entries.map(([dateTime, place, size = "M", effect = "none"], index) => {
    const id = `${prefix}-stop-${index + 1}`;
    if (!point[place]) throw new Error(`Unknown map point: ${place}`);
    stopPlaces.set(id, place);
    return { id, lat: point[place][0], lng: point[place][1], dateTime, size, effect };
  });
}

function badge(id, label, flag, symbol, entries, visibility = {}, options = {}) {
  const route = stops(id, entries);
  return {
    id, label, lat: route[0].lat, lng: route[0].lng, flag, symbol,
    symbolImage: "", stars: 0, size: route[0].size, route,
    showTrail: options.showTrail ?? true,
    visibility: { showAt: visibility.showAt ?? "", hideAt: visibility.hideAt ?? "" },
  };
}

function unit(id, name, kind, entries, visibility = {}, options = {}) {
  const route = stops(id, entries);
  return {
    id, name, kind, image: "", lat: route[0].lat, lng: route[0].lng,
    size: route[0].size, route, showTrail: options.showTrail ?? false,
    visibility: { showAt: visibility.showAt ?? "", hideAt: visibility.hideAt ?? "" },
  };
}

function detailBadge(id, label, flag, entries, hideAt = "", symbol = "helmet") {
  const smallEntries = entries.map(([dateTime, place, effect = "none"]) => [dateTime, place, "S", effect]);
  return badge(id, label, flag, symbol, smallEntries,
    { showAt: entries[0][0], hideAt }, { showTrail: false });
}

const end = "1942-02-15T20:30";
const project = {
  version: 5,
  view: { center: { lat: 4.16, lng: 102.25 }, zoom: 7, mapTypeId: "satellite" },
  playbackDuration: 90,
  badges: [
    badge("japanese-west", "Japanese 25th Army · western advance", flags.japan, "tank", [
      ["1941-12-08T01:45", "singora", "L"],
      ["1941-12-13T12:00", "jitra", "L", "firing"],
      ["1941-12-28T12:00", "ipoh", "L"],
      ["1942-01-07T12:00", "slimRiver", "L", "booming"],
      ["1942-01-11T12:00", "kualaLumpur", "L"],
      ["1942-01-14T12:00", "gemas", "L", "firing"],
      ["1942-01-18T12:00", "muar", "L", "firing"],
      ["1942-01-24T12:00", "yongPeng", "M"],
      ["1942-01-31T12:00", "johorBahru", "M"],
      ["1942-02-08T23:00", "sarimbun", "L", "firing"],
      ["1942-02-09T12:00", "tengah", "L"],
      ["1942-02-11T12:00", "bukitTimah", "L", "booming"],
      [end, "singapore", "L"],
    ], { showAt: "1941-12-08T01:45" }),
    badge("japanese-east", "Japanese 25th Army · eastern advance", flags.japan, "helmet", [
      ["1941-12-08T01:45", "kotaBharu", "M", "firing"],
      ["1941-12-22T12:00", "kualaKrai", "M"],
      ["1942-01-05T12:00", "kuantan", "M"],
      ["1942-01-26T12:00", "endau", "M"],
      ["1942-01-27T12:00", "jemaluang", "M", "firing"],
      ["1942-01-30T12:00", "kotaTinggi", "M"],
      ["1942-01-31T12:00", "johorBahru", "M"],
      ["1942-02-09T12:00", "tengah", "M"],
      [end, "singapore", "M"],
    ], { showAt: "1941-12-08T01:45" }),
    badge("indian-north", "British-Indian northern defence", flags.india, "helmet", [
      ["1941-12-08T01:45", "jitra", "L"],
      ["1941-12-17T12:00", "gurun", "L", "firing"],
      ["1941-12-30T12:00", "kampar", "L", "firing"],
      ["1942-01-07T12:00", "slimRiver", "M", "booming"],
      ["1942-01-11T12:00", "kualaLumpur", "M"],
      ["1942-01-14T12:00", "segamat", "M"],
      ["1942-01-31T12:00", "johorBahru", "M"],
      ["1942-02-08T23:00", "tengah", "M", "firing"],
      [end, "singapore", "S"],
    ], { showAt: "1941-12-08T01:45", hideAt: end }),
    badge("australian-twenty-second", "22nd Australian Brigade · eastern Johor", flags.australia, "helmet", [
      ["1941-12-08T01:45", "mersing", "L"],
      ["1942-01-17T12:00", "jemaluang", "L"],
      ["1942-01-27T12:00", "jemaluang", "L", "firing"],
      ["1942-01-31T12:00", "johorBahru", "M"],
      ["1942-02-08T23:00", "sarimbun", "L", "firing"],
      ["1942-02-11T12:00", "bukitTimah", "M", "crack"],
      [end, "singapore", "S"],
    ], { showAt: "1941-12-08T01:45", hideAt: end }),
    badge("australian-twenty-seventh", "27th Australian Brigade · western Johor", flags.australia, "helmet", [
      ["1941-12-08T01:45", "kotaTinggi", "M"],
      ["1942-01-10T12:00", "segamat", "L"],
      ["1942-01-14T12:00", "gemas", "L", "firing"],
      ["1942-01-18T12:00", "bakri", "M", "firing"],
      ["1942-01-24T12:00", "yongPeng", "M"],
      ["1942-01-30T12:00", "johorBahru", "M"],
      ["1942-02-08T23:00", "causeway", "M", "firing"],
      ["1942-02-11T12:00", "bukitTimah", "S"],
      [end, "singapore", "S"],
    ], { showAt: "1941-12-08T01:45", hideAt: end }),
    badge("indian-forty-fifth", "45th Indian Brigade · Muar sector", flags.india, "helmet", [
      ["1942-01-14T12:00", "muar", "M"],
      ["1942-01-18T12:00", "bakri", "M", "firing"],
      ["1942-01-22T12:00", "paritSulong", "S", "crack"],
    ], { showAt: "1942-01-14T12:00", hideAt: "1942-01-24T12:00" }),
    badge("japanese-landing", "Japanese landing fleet · Kota Bharu", flags.naval, "warship", [
      ["1941-12-08T01:45", "kotaBharuSea", "M"],
      ["1941-12-09T12:00", "kotaBharu", "S", "firing"],
    ], { showAt: "1941-12-08T01:45", hideAt: "1941-12-11T12:00" }, { showTrail: false }),
  ],
  units: [
    unit("force-z", "Force Z · Prince of Wales & Repulse", "warship", [
      ["1941-12-08T12:00", "singaporeHarbour", "L"],
      ["1941-12-10T12:00", "kuantanSea", "L", "booming"],
    ], { showAt: "1941-12-08T12:00", hideAt: "1941-12-11T12:00" }, { showTrail: true }),
    unit("japanese-tanks", "Japanese tank advance", "tank", [
      ["1941-12-13T12:00", "jitra", "M"],
      ["1942-01-07T12:00", "slimRiver", "M", "firing"],
      ["1942-01-14T12:00", "gemas", "M", "firing"],
      ["1942-01-18T12:00", "bakri", "M"],
      ["1942-02-11T12:00", "bukitTimah", "S", "booming"],
    ], { showAt: "1941-12-13T12:00" }),
    unit("australian-artillery", "Australian artillery · Johor", "artillery", [
      ["1942-01-14T12:00", "gemas", "M", "firing"],
      ["1942-01-18T12:00", "bakri", "M", "firing"],
      ["1942-01-24T12:00", "yongPeng", "M"],
      ["1942-02-08T23:00", "sarimbun", "S", "firing"],
    ], { showAt: "1942-01-14T12:00", hideAt: end }),
    unit("malay-regiment", "1st Battalion, Malay Regiment · Pasir Panjang", "troop", [
      ["1942-02-13T12:00", "pasirPanjang", "M", "firing"],
      ["1942-02-14T12:00", "bukitChandu", "M", "firing"],
    ], { showAt: "1942-02-13T12:00", hideAt: end }),
  ],
  lines: [],
};
const overview = structuredClone(project);
project.playbackDuration = 120;

// Small formation markers show a documented sector or notable action; the broad badges above carry the campaign overview.
project.badges.push(
  detailBadge("jp-fifth-division", "Japan · 5th Infantry Division", flags.japan, [
    ["1941-12-08T02:00", "singora"], ["1941-12-13T12:00", "jitra", "firing"],
    ["1941-12-15T12:00", "gurun"], ["1942-01-01T12:00", "kampar", "firing"],
    ["1942-01-07T12:00", "slimRiver", "booming"], ["1942-01-14T12:00", "gemas"],
    ["1942-02-08T23:00", "limChuKang", "firing"],
    ["1942-02-14T12:00", "bukitBrown", "firing"], [end, "singapore"],
  ]),
  detailBadge("jp-eighteenth-division", "Japan · 18th Infantry Division", flags.japan, [
    ["1942-01-01T12:00", "singora"], ["1942-01-31T12:00", "johorBahru"],
    ["1942-02-08T23:00", "sarimbun", "firing"],
    ["1942-02-11T12:00", "bukitTimah", "firing"],
    ["1942-02-14T12:00", "pasirPanjang", "firing"], [end, "singapore"],
  ]),
  detailBadge("jp-imperial-guards", "Japan · Imperial Guards Division", flags.japan, [
    ["1942-01-02T12:00", "telukIntan"], ["1942-01-16T12:00", "muar", "firing"],
    ["1942-01-31T12:00", "johorBahru"], ["1942-02-09T12:00", "kranji", "firing"],
    [end, "singapore"],
  ]),
  detailBadge("jp-ninth-brigade", "Japan · 9th Infantry Brigade", flags.japan, [
    ["1941-12-08T02:00", "singora"], ["1941-12-13T12:00", "jitra", "firing"],
    ["1941-12-15T12:00", "gurun"], ["1942-01-01T12:00", "kampar", "firing"],
  ], "1942-01-03T12:00"),
  detailBadge("jp-twenty-first-brigade", "Japan · 21st Infantry Brigade", flags.japan, [
    ["1941-12-08T02:00", "patani"], ["1941-12-13T12:00", "baling", "firing"],
    ["1942-01-07T12:00", "slimRiver", "booming"],
  ], "1942-01-09T12:00"),
  detailBadge("jp-eleventh-regiment", "Japan · 11th Infantry Regiment", flags.japan, [
    ["1941-12-08T02:00", "singora"], ["1941-12-13T12:00", "jitra"],
    ["1942-01-02T12:00", "telukIntan", "firing"],
  ], "1942-01-04T12:00"),
  detailBadge("jp-forty-first-regiment", "Japan · 41st Infantry Regiment", flags.japan, [
    ["1941-12-08T02:00", "singora"], ["1941-12-13T12:00", "jitra"],
    ["1942-01-01T12:00", "kampar", "firing"],
  ], "1942-01-03T12:00"),
  detailBadge("jp-forty-second-regiment", "Japan · 42nd Infantry Regiment", flags.japan, [
    ["1941-12-08T02:00", "patani"], ["1941-12-13T12:00", "baling"],
    ["1942-01-07T12:00", "slimRiver", "booming"],
  ], "1942-01-09T12:00"),
  detailBadge("jp-fifty-sixth-regiment", "Japan · 56th Infantry Regiment", flags.japan, [
    ["1941-12-08T01:45", "kotaBharu", "firing"],
    ["1941-12-13T12:00", "machang"], ["1941-12-30T12:00", "kuantan"],
  ], "1942-01-02T12:00"),
  detailBadge("jp-fourth-guards", "Japan · 4th Guards Regiment detachment", flags.japan, [
    ["1942-01-02T12:00", "telukIntan", "firing"],
    ["1942-01-03T12:00", "telukIntan"],
  ], "1942-01-05T12:00"),
);

project.badges.push(
  detailBadge("ind-eleventh-division", "11th Indian Infantry Division", flags.india, [
    ["1941-12-08T12:00", "jitra"], ["1941-12-15T12:00", "gurun", "firing"],
    ["1941-12-30T12:00", "kampar", "firing"],
    ["1942-01-07T12:00", "slimRiver", "crack"],
  ], "1942-01-08T12:00"),
  detailBadge("ind-sixth-brigade", "6th Indian Infantry Brigade", flags.india, [
    ["1941-12-08T12:00", "jitra"],
    ["1941-12-12T12:00", "jitra"], ["1941-12-14T12:00", "gurun", "firing"],
  ], "1941-12-18T12:00"),
  detailBadge("ind-fifteenth-brigade", "15th Indian Infantry Brigade", flags.india, [
    ["1941-12-08T12:00", "jitra"], ["1941-12-14T12:00", "gurun", "firing"],
  ], "1941-12-18T12:00"),
  detailBadge("ind-sixth-fifteenth", "Combined 6th/15th Indian Brigade", flags.india, [
    ["1941-12-18T12:00", "gurun"], ["1941-12-30T12:00", "kampar", "firing"],
    ["1942-01-04T12:00", "slimRiver"],
  ], "1942-01-08T12:00"),
  detailBadge("ind-twenty-eighth-brigade", "28th Indian Infantry Brigade", flags.india, [
    ["1941-12-08T12:00", "ipoh"], ["1941-12-12T12:00", "jitra"],
    ["1941-12-14T12:00", "gurun", "firing"],
    ["1941-12-30T12:00", "kampar"],
    ["1942-01-07T12:00", "slimRiver", "crack"],
  ], "1942-01-08T12:00"),
  detailBadge("ind-twelfth-brigade", "12th Indian Infantry Brigade", flags.india, [
    ["1941-12-13T12:00", "ipoh"], ["1941-12-14T12:00", "baling"],
    ["1941-12-26T12:00", "chemor", "firing"],
    ["1941-12-28T12:00", "gopeng", "firing"],
    ["1942-01-02T12:00", "bidor"],
    ["1942-01-07T12:00", "slimRiver", "crack"],
  ], "1942-01-08T12:00"),
  detailBadge("ind-eighth-brigade", "8th Indian Infantry Brigade · Kelantan", flags.india, [
    ["1941-12-08T01:45", "kotaBharu", "firing"],
    ["1941-12-13T12:00", "machang", "firing"],
    ["1941-12-19T12:00", "kualaKrai"],
    ["1941-12-23T12:00", "kualaLipis"],
    ["1942-01-05T12:00", "jerantut"],
  ], "1942-01-07T12:00"),
  detailBadge("ind-twenty-second-brigade", "22nd Indian Infantry Brigade · east", flags.india, [
    ["1941-12-08T12:00", "kuantan"],
    ["1941-12-23T12:00", "kuantan", "firing"],
    ["1942-01-05T12:00", "jerantut"],
    ["1942-01-24T12:00", "paloh"],
    ["1942-01-28T12:00", "paloh", "crack"],
  ], "1942-01-29T12:00"),
  detailBadge("ind-first-eighth-punjab", "1/8th Punjab · Laycol detachment", flags.india, [
    ["1941-12-08T12:00", "sadao", "firing"],
    ["1941-12-12T12:00", "jitra"],
    ["1941-12-14T12:00", "gurun", "firing"],
  ], "1941-12-16T12:00"),
  detailBadge("ind-third-sixteenth-punjab", "3/16th Punjab Regiment", flags.india, [
    ["1941-12-08T12:00", "kroh"],
    ["1941-12-12T12:00", "betong", "firing"],
    ["1941-12-15T12:00", "baling"],
  ], "1941-12-17T12:00"),
  detailBadge("ind-second-twelfth-ffr", "2/12th Frontier Force Regiment", flags.india, [
    ["1941-12-08T01:45", "kotaBharu", "firing"],
    ["1941-12-13T12:00", "machang"],
    ["1941-12-19T12:00", "kualaKrai"],
    ["1942-01-05T12:00", "kuantan", "firing"],
  ], "1942-01-07T12:00"),
  detailBadge("ind-second-second-gurkha", "2/2nd Gurkha Rifles", flags.india, [
    ["1941-12-30T12:00", "kampar"],
    ["1942-01-01T12:00", "slimRiver"],
    ["1942-01-07T12:00", "slimRiver", "firing"],
  ], "1942-01-08T12:00"),
  detailBadge("ind-second-ninth-gurkha", "2/9th Gurkha Rifles", flags.india, [
    ["1941-12-30T12:00", "kampar"],
    ["1942-01-05T12:00", "slimRiver"],
    ["1942-01-07T12:00", "slimRiver", "firing"],
  ], "1942-01-08T12:00"),
  detailBadge("uk-eighteenth-division", "British 18th Infantry Division", flags.britain, [
    ["1942-02-11T12:00", "macRitchie"],
    ["1942-02-14T12:00", "bukitBrown", "firing"],
    [end, "braddell"],
  ], end),
  detailBadge("uk-fifty-third-brigade", "British 53rd Infantry Brigade", flags.britain, [
    ["1942-01-16T12:00", "labis"], ["1942-01-18T12:00", "yongPeng"],
    ["1942-01-24T12:00", "ayerHitam"],
    [end, "braddell", "crack"],
  ], end),
);

project.badges.push(
  detailBadge("au-two-eighteenth", "Australia · 2/18th Battalion", flags.australia, [
    ["1941-12-08T12:00", "mersing"],
    ["1942-01-17T12:00", "jemaluang"],
    ["1942-01-27T03:00", "jemaluang", "firing"],
    ["1942-02-08T23:00", "sarimbun", "firing"],
    ["1942-02-11T12:00", "bukitTimah"], [end, "singapore"],
  ], end),
  detailBadge("au-two-nineteenth", "Australia · 2/19th Battalion", flags.australia, [
    ["1941-12-08T12:00", "jemaluang"],
    ["1942-01-17T12:00", "bakri"],
    ["1942-01-19T12:00", "bakri", "firing"],
    ["1942-01-22T12:00", "paritSulong", "crack"],
    ["1942-01-23T12:00", "yongPeng"],
    ["1942-01-26T12:00", "johorBahru"],
    ["1942-02-08T23:00", "sarimbun", "firing"],
    [end, "singapore"],
  ], end),
  detailBadge("au-two-twentieth", "Australia · 2/20th Battalion", flags.australia, [
    ["1941-12-08T12:00", "mersing"],
    ["1942-01-26T12:00", "mersing", "firing"],
    ["1942-01-31T12:00", "limChuKang"],
    ["1942-02-08T23:00", "limChuKang", "firing"],
    [end, "singapore"],
  ], end),
  detailBadge("au-two-twenty-sixth", "Australia · 2/26th Battalion", flags.australia, [
    ["1941-12-08T12:00", "kotaTinggi"],
    ["1942-01-10T12:00", "segamat"],
    ["1942-01-14T12:00", "payaLang", "firing"],
    ["1942-01-23T12:00", "yongPeng"],
    ["1942-01-24T12:00", "ayerHitam"],
    ["1942-01-27T12:00", "simpangRenggam", "firing"],
    ["1942-02-09T12:00", "kranji", "firing"],
    [end, "singapore"],
  ], end),
  detailBadge("au-two-twenty-ninth", "Australia · 2/29th Battalion", flags.australia, [
    ["1941-12-08T12:00", "segamat"],
    ["1942-01-14T12:00", "bulohKasap"],
    ["1942-01-17T12:00", "bakri"],
    ["1942-01-18T12:00", "bakri", "firing"],
    ["1942-01-22T12:00", "paritSulong", "crack"],
    ["1942-01-23T12:00", "yongPeng"],
    ["1942-01-31T12:00", "johorBahru"],
    [end, "singapore"],
  ], end),
  detailBadge("au-two-thirtieth", "Australia · 2/30th Battalion", flags.australia, [
    ["1941-12-08T12:00", "jemaluang"],
    ["1942-01-10T12:00", "segamat"],
    ["1942-01-14T15:45", "gemas", "firing"],
    ["1942-01-15T12:00", "gemas", "firing"],
    ["1942-01-24T12:00", "ayerHitam"],
    ["1942-02-09T12:00", "kranji", "firing"],
    [end, "singapore"],
  ], end),
  detailBadge("au-two-tenth-field", "Australia · 2/10th Field Regiment", flags.australia, [
    ["1941-12-08T12:00", "mersing"],
    ["1942-01-21T12:00", "mersing", "firing"],
    ["1942-01-27T03:00", "jemaluang", "firing"],
    ["1942-01-31T12:00", "johorBahru"],
    ["1942-02-08T23:00", "sarimbun", "firing"],
    [end, "singapore"],
  ], end, "artillery"),
  detailBadge("au-two-fifteenth-field", "Australia · 2/15th Field Regiment · western sector", flags.australia, [
    ["1941-12-08T12:00", "kluang"],
    ["1942-01-13T12:00", "payaLang"],
    ["1942-01-18T12:00", "gemas", "firing"],
    ["1942-01-31T12:00", "johorBahru"],
    ["1942-02-08T23:00", "sarimbun", "firing"],
    [end, "singapore"],
  ], end, "artillery"),
  detailBadge("au-sixty-fifth-battery", "Australia · 65th Battery, 2/15th Field", flags.australia, [
    ["1942-01-13T12:00", "muar"],
    ["1942-01-18T12:00", "bakri", "firing"],
    ["1942-01-22T12:00", "paritSulong", "firing"],
    ["1942-01-23T12:00", "yongPeng"],
  ], "1942-01-25T12:00", "artillery"),
  detailBadge("au-two-fourth-antitank", "Australia · 2/4th Anti-Tank · 13th Battery", flags.australia, [
    ["1942-01-17T12:00", "bakri"],
    ["1942-01-18T12:00", "bakri", "firing"],
  ], "1942-01-21T12:00", "artillery"),
);

project.units.push(
  unit("au-two-thirtieth-b-company", "2/30th Battalion · B Company, Gemencheh", "troop", [
    ["1942-01-14T15:45", "gemencheh", "S", "firing"],
    ["1942-01-15T12:00", "gemas", "S"],
  ], { showAt: "1942-01-14T15:45", hideAt: "1942-01-16T12:00" }),
  unit("au-two-nineteenth-d-company", "2/19th Battalion · D Company, Endau", "troop", [
    ["1942-01-07T12:00", "jemaluang", "S"],
    ["1942-01-14T12:00", "endau", "S", "firing"],
    ["1942-01-17T12:00", "jemaluang", "S"],
  ], { showAt: "1942-01-07T12:00", hideAt: "1942-01-18T12:00" }),
  unit("au-two-twentieth-c-company", "2/20th Battalion · C Company, Endau", "troop", [
    ["1942-01-07T12:00", "mersing", "S"],
    ["1942-01-14T12:00", "endau", "S", "firing"],
    ["1942-01-26T12:00", "mersing", "S"],
  ], { showAt: "1942-01-07T12:00", hideAt: "1942-01-27T12:00" }),
);

project.units.push({
  id: "malay-regiment-second", name: "2nd Battalion, Malay Regiment · Pasir Panjang",
  kind: "troop", image: "", size: "S", lat: point.pasirPanjang[0], lng: point.pasirPanjang[1],
  route: [], showTrail: false,
  visibility: { showAt: "1942-02-13T12:00", hideAt: end },
});

await writeFile(join(directory, "malaya-singapore-1941-42.json"), `${JSON.stringify(overview, null, 2)}\n`);
await writeFile(join(directory, "malaya-singapore-detailed-1941-42.json"), `${JSON.stringify(project, null, 2)}\n`);
const awm = "https://www.awm.gov.au/collection/";
const sources = {
  "au-two-eighteenth": `${awm}U56061`, "au-two-nineteenth": `${awm}U56062`,
  "au-two-twentieth": `${awm}U56063`, "au-two-twenty-sixth": `${awm}U56069`,
  "au-two-twenty-ninth": `${awm}U56072`, "au-two-thirtieth": `${awm}U56073`,
  "au-two-tenth-field": `${awm}U54400`, "au-two-fifteenth-field": `${awm}U54405`,
  "au-sixty-fifth-battery": `${awm}U54405`, "au-two-fourth-antitank": `${awm}011300`,
  "au-two-thirtieth-b-company": "https://www.awm.gov.au/articles/blog/gemencheh-bridge",
  "au-two-nineteenth-d-company": `${awm}U56062`,
  "au-two-twentieth-c-company": `${awm}U56063`,
  "uk-eighteenth-division": "https://www.nhb.gov.sg/what-we-do/our-work/sector-development/museum-roundtable/2024-battle-for-singapore",
  "uk-fifty-third-brigade": "https://history.army.mil/portals/143/Images/Publications/catalog/11-1.pdf",
  "malay-regiment": "https://www.nhb.gov.sg/bukitchandu/whats-on/exhibitions/into-battle",
  "malay-regiment-second": "https://biblioasia.nlb.gov.sg/vol-18/issue-2/jul-sep-2022/kranji-war-cemetery/",
};
const officialJapaneseOrder = "https://s3-ap-southeast-2.amazonaws.com/awm-media/collection/RCDIG1070100/document/5519429.PDF";
const officialIndianCampaign = "https://s3-ap-southeast-2.amazonaws.com/awm-media/collection/RCDIG1070591/document/5519874.PDF";
const csvCell = (value) => `"${String(value).replaceAll('"', '""')}"`;
const waypointRows = ["formation,stop,date_and_time,place,latitude,longitude,size,effect,coordinate_note,context_source_url"];
for (const formation of [...project.badges, ...project.units]) {
  for (const [index, stop] of formation.route.entries()) {
    waypointRows.push([
      formation.label ?? formation.name, index + 1, stop.dateTime,
      stopPlaces.get(stop.id), stop.lat, stop.lng, stop.size, stop.effect,
      "Representative locality; not a verified unit GPS position",
      sources[formation.id] ?? (formation.id.startsWith("jp-") ? officialJapaneseOrder
        : formation.id.startsWith("ind-") ? officialIndianCampaign : `${awm}E84717`),
    ].map(csvCell).join(","));
  }
}
await writeFile(join(directory, "malaya-singapore-waypoints.csv"), `${waypointRows.join("\n")}\n`);
console.log(`Created ${project.badges.length} badges and ${project.units.length} symbol markers.`);
