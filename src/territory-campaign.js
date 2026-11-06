import { scenarioTime } from "./timeline.js";

// A fixed historical arrival surface: independent of badge movement and frame rate.
// Interpolation is schematic between documented localities, not a surveyed battle line.
export function campaignArrival(sites, lat, lng) {
  if (!sites.length) return Infinity;
  const cos = Math.cos(lat * Math.PI / 180);
  const origin = sites[0].time;
  let weights = 0, sum = 0;
  for (const site of sites) {
    const d = (site.lat - lat) ** 2 + ((site.lng - lng) * cos) ** 2;
    if (d < 1e-14) return site.time;
    // Every anchor participates: no discontinuity where a nearest-neighbor list changes.
    // Inverse-fourth weighting keeps distant campaign locations from overwhelming a town.
    const weight = 1 / (d * d);
    weights += weight; sum += (site.time - origin) * weight;
  }
  return origin + sum / weights;
}

function buildField(sites, bounds, step, completeAt) {
  const [west, south, east, north] = bounds;
  const columns = Math.ceil((east - west) / step), rows = Math.ceil((north - south) / step);
  const vertices = [];
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
    const lat = south + y * (north - south) / rows, lng = west + x * (east - west) / columns;
    vertices.push({ lat, lng, time: campaignArrival(sites, lat, lng) });
  }
  return { vertices, columns, rows, completeAt: scenarioTime(completeAt), startAt: Math.min(...sites.map((s) => s.time)), bounds };
}

export function compileCampaign(data) {
  const sites = data.sites.map((site) => ({ ...site, time: scenarioTime(site.dateTime) }));
  return {
    countries: data.countries,
    thailandChangeAt: scenarioTime(data.thailandChangeAt),
    malaya: buildField(sites.filter((s) => s.area === "malaya"), [99.5, 1.1, 105, 6.9], 0.04, data.malayaCompleteAt),
    singapore: buildField(sites.filter((s) => s.area === "singapore"), [103.55, 1.15, 104.15, 1.5], 0.003, data.singaporeCompleteAt),
  };
}

function clipTriangle(vertices, time) {
  const output = [], crossings = [];
  for (let i = 0; i < 3; i++) {
    const a = vertices[i], b = vertices[(i + 1) % 3];
    const inside = a.time <= time, nextInside = b.time <= time;
    if (inside) output.push(a);
    if (inside !== nextInside) {
      const f = (time - a.time) / (b.time - a.time);
      const point = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      output.push(point); crossings.push(point);
    }
  }
  return { output, crossings };
}

export function countryPath(geometry, project) {
  const path = new Path2D();
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  for (const polygon of polygons) for (const ring of polygon) {
    ring.forEach(([lng, lat], index) => { const p = project({ lat, lng }); if (index) path.lineTo(p.x, p.y); else path.moveTo(p.x, p.y); });
    path.closePath();
  }
  return path;
}

export function campaignMask(field, projected, time) {
  const fill = new Path2D(), border = new Path2D();
  const polygon = (points) => {
    if (points.length < 3) return;
    fill.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) fill.lineTo(p.x, p.y);
    fill.closePath();
  };
  const stride = field.columns + 1;
  for (let y = 0; y < field.rows; y++) {
    let run = -1;
    const flush = (x) => {
      if (run < 0) return;
      polygon([projected[y * stride + run], projected[y * stride + x], projected[(y + 1) * stride + x], projected[(y + 1) * stride + run]]);
      run = -1;
    };
    for (let x = 0; x < field.columns; x++) {
      const i = y * stride + x, ids = [i, i + 1, i + stride + 1, i + stride];
      const values = ids.map((id) => field.vertices[id].time);
      if (values.every((v) => v <= time)) { if (run < 0) run = x; continue; }
      flush(x);
      if (values.every((v) => v > time)) continue;
      const points = ids.map((id, n) => ({ ...projected[id], time: values[n] }));
      for (const triangle of [[points[0], points[1], points[2]], [points[0], points[2], points[3]]]) {
        const { output, crossings } = clipTriangle(triangle, time);
        polygon(output);
        if (crossings.length === 2) { border.moveTo(crossings[0].x, crossings[0].y); border.lineTo(crossings[1].x, crossings[1].y); }
      }
    }
    flush(field.columns);
  }
  return { fill, border };
}
