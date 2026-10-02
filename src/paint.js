export const BRUSH_SIZES = { small: 1, medium: 2, big: 4 };
export const MAX_PAINT_STROKES = 2000;
export const MAX_PAINT_POINTS = 200000;

export function brushDimensions(shape, size) {
  const factor = BRUSH_SIZES[size] ?? BRUSH_SIZES.medium;
  return shape === "rectangle" ? { width: 36 * factor, height: 24 * factor } : { width: 24 * factor, height: 24 * factor };
}

export function validatePaintStrokes(strokes) {
  if (!Array.isArray(strokes) || strokes.length > MAX_PAINT_STROKES) throw new Error(`Use at most ${MAX_PAINT_STROKES} paint strokes.`);
  const ids = new Set();
  let points = 0;
  for (const stroke of strokes) {
    if (!stroke || typeof stroke.id !== "string" || !stroke.id || stroke.id.length > 100 || ids.has(stroke.id) ||
      !["paint", "erase"].includes(stroke.tool) || !["circle", "rectangle"].includes(stroke.shape) ||
      !/^#[0-9a-fA-F]{6}$/.test(stroke.color) || !Number.isFinite(stroke.zoom) || stroke.zoom < 0 || stroke.zoom > 22 ||
      (stroke.opacity !== undefined && (!Number.isFinite(stroke.opacity) || stroke.opacity < 0.1 || stroke.opacity > 1)) ||
      !Number.isFinite(stroke.width) || stroke.width < 1 || stroke.width > 500 ||
      !Number.isFinite(stroke.height) || stroke.height < 1 || stroke.height > 500 ||
      !Array.isArray(stroke.points) || !stroke.points.length ||
      stroke.points.some((point) => !point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng) || Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180)) {
      throw new Error("A paint stroke has invalid settings or coordinates.");
    }
    ids.add(stroke.id);
    points += stroke.points.length;
    if (points > MAX_PAINT_POINTS) throw new Error(`Use at most ${MAX_PAINT_POINTS} paint points.`);
  }
  return strokes;
}
