// Shared great-circle interpolation for authored routes (scenario fractions, not wall time).
const radians = Math.PI / 180;
export const EARTH_RADIUS = 6378137;
export function sphericalInterpolate(a, b, fraction) {
  const lat1 = a.lat * radians, lat2 = b.lat * radians;
  const lng1 = a.lng * radians, lng2 = b.lng * radians;
  const angle = 2 * Math.asin(Math.min(1, Math.sqrt(Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2)));
  if (angle < 1e-12) return { lat: a.lat, lng: a.lng };
  const sin = Math.sin(angle);
  // Antipodal routes have no unique shortest path; territory rejects these separately.
  if (Math.abs(sin) < 1e-12) return { lat: a.lat, lng: a.lng };
  const u = Math.sin((1 - fraction) * angle) / sin, v = Math.sin(fraction * angle) / sin;
  const x = u * Math.cos(lat1) * Math.cos(lng1) + v * Math.cos(lat2) * Math.cos(lng2);
  const y = u * Math.cos(lat1) * Math.sin(lng1) + v * Math.cos(lat2) * Math.sin(lng2);
  return { lat: Math.atan2(u * Math.sin(lat1) + v * Math.sin(lat2), Math.hypot(x, y)) / radians, lng: Math.atan2(y, x) / radians };
}
