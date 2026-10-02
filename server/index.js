import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium } from "playwright";
import ffmpegPath from "ffmpeg-static";
import { routeError, timelineRange, visibilityError } from "../src/timeline.js";
import { validatePaintStrokes } from "../src/paint.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(tmpdir(), `malaya-world-war-ii-video-${process.pid}`);
mkdirSync(outputDir, { recursive: true });
const dev = process.argv.includes("--dev");
const portIndex = process.argv.indexOf("--port");
const port = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : Number(process.env.PORT || (dev ? 5181 : 4173));
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Choose a valid port.");
const host = process.env.HOST || "127.0.0.1";
const allowedHosts = new Set(["127.0.0.1", "localhost", ...(process.env.ALLOWED_HOSTS || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean)]);
const renderOrigin = new URL(process.env.RENDER_ORIGIN || `http://127.0.0.1:${port}`).origin;
const jobs = new Map();
const queue = [];
let active = null;
let imageCaptureActive = false;
let vite;

function reply(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

function viewOf(job) {
  return { id: job.id, status: job.status, progress: job.progress, error: job.error };
}

async function readJson(req) {
  if (!req.headers["content-type"]?.startsWith("application/json")) throw new Error("Send JSON export settings.");
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 25 * 1024 * 1024) throw new Error("The map exceeds the 25 MB export limit.");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("The export settings are invalid JSON."); }
}

function point(value) {
  return value && typeof value.lat === "number" && typeof value.lng === "number" && Number.isFinite(value.lat) && Number.isFinite(value.lng) && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180;
}

function validate(input) {
  const project = input?.project;
  if (!project || project.version !== 6 || !Array.isArray(project.badges) || project.badges.length > 500 || !Array.isArray(project.units) || project.units.length > 500 || !Array.isArray(project.lines) || project.lines.length > 200) throw new Error("Choose a valid Malaya World War II map with at most 500 badges, 500 symbols, and 200 lines.");
  validatePaintStrokes(project.paintStrokes);
  if (Buffer.byteLength(JSON.stringify(project)) > 24 * 1024 * 1024) throw new Error("The map exceeds the 24 MB project limit.");
  for (const badge of project.badges) {
    if (!badge || !point(badge) || typeof badge.label !== "string" || badge.label.length > 80 || !["S", "M", "L", "XL"].includes(badge.size) || (badge.troopCount != null && (!Number.isSafeInteger(badge.troopCount) || badge.troopCount < 0)) || !Number.isInteger(badge.stars) || badge.stars < 0 || badge.stars > 5 || typeof badge.flag !== "string" || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(badge.flag) || badge.flag.length > 7_000_000 || (badge.symbolImage && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(badge.symbolImage) || badge.symbolImage.length > 7_000_000)) || routeError(badge.route) || visibilityError(badge.visibility)) throw new Error("A badge, route, or visibility date is invalid.");
  }
  for (const unit of project.units) {
    if (!unit || !point(unit) || typeof unit.name !== "string" || !unit.name.trim() || unit.name.length > 80 || !["tank", "warship", "artillery", "troop", "other"].includes(unit.kind) || !["S", "M", "L", "XL"].includes(unit.size) || typeof unit.showTrail !== "boolean" || (unit.image && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(unit.image) || unit.image.length > 7_000_000)) || routeError(unit.route) || visibilityError(unit.visibility)) throw new Error("A movable symbol, route, or visibility date is invalid.");
  }
  for (const line of project.lines) {
    if (!line || !Array.isArray(line.path) || line.path.length < 2 || line.path.length > 2000 || line.path.some((position) => !point(position)) || !["solid", "dashed"].includes(line.style) || ![3, 6, 10].includes(line.width)) throw new Error("A drawn line is invalid.");
  }
  if (!timelineRange([...project.badges, ...project.units])) throw new Error("Add a dated movement route or visibility date before exporting video.");
  const { orientation, logicalSize, view, duration, showDate } = input;
  const ratio = orientation === "portrait" ? [9, 16] : orientation === "landscape" ? [16, 9] : null;
  if (!ratio || !logicalSize || !Number.isInteger(logicalSize.width) || !Number.isInteger(logicalSize.height) || logicalSize.width < 90 || logicalSize.height < 90 || logicalSize.width > 1920 || logicalSize.height > 1920 || logicalSize.width * ratio[1] !== logicalSize.height * ratio[0]) throw new Error("Choose a valid portrait or landscape frame.");
  if (!view || !point(view.center) || !Number.isFinite(view.zoom) || view.zoom < 0 || view.zoom > 22 || !["roadmap", "satellite", "hybrid", "terrain"].includes(view.mapTypeId)) throw new Error("Choose a valid map view.");
  if (!Number.isInteger(duration) || duration < 5 || duration > 600 || typeof showDate !== "boolean") throw new Error("Choose a playback length from 5 to 600 seconds.");
  return input;
}

function validateImageInput(input) {
  const project = input?.project;
  if (!project || project.version !== 6 || !Array.isArray(project.badges) || project.badges.length > 500 || !Array.isArray(project.units) || project.units.length > 500 || !Array.isArray(project.lines) || project.lines.length > 200) throw new Error("Choose a valid Malaya World War II map with at most 500 badges, 500 symbols, and 200 lines.");
  validatePaintStrokes(project.paintStrokes);
  if (Buffer.byteLength(JSON.stringify(project)) > 24 * 1024 * 1024) throw new Error("The map exceeds the 24 MB project limit.");
  const { view, logicalSize, scale, previewTime } = input;
  if (!view || !point(view.center) || !Number.isFinite(view.zoom) || view.zoom < 0 || view.zoom > 22 || !["roadmap", "satellite", "hybrid", "terrain"].includes(view.mapTypeId)) throw new Error("Choose a valid map view.");
  if (!logicalSize || !Number.isInteger(logicalSize.width) || !Number.isInteger(logicalSize.height) || logicalSize.width < 90 || logicalSize.height < 90 || logicalSize.width > 8192 || logicalSize.height > 8192 || !Number.isFinite(scale) || scale < 0.5 || scale > 2 || logicalSize.width * logicalSize.height * scale * scale > 16_000_000) throw new Error("Choose a smaller map image size.");
  if (previewTime != null && !Number.isFinite(previewTime)) throw new Error("The current map time is invalid.");
  return input;
}

async function captureMapImage(input) {
  let browser;
  try {
    try {
      browser = await chromium.launch({ headless: true, args: ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"] });
    } catch (error) {
      if (/executable doesn't exist|please run.*playwright install/i.test(error.message || "")) throw new Error("Install the local browser with npm run setup:video before downloading a picture.");
      throw error;
    }
    const context = await browser.newContext({ viewport: input.logicalSize, deviceScaleFactor: input.scale });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    await page.goto(`${renderOrigin}/render.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !!window.fieldmarkRender);
    await page.evaluate((value) => window.fieldmarkRender.load(value), input);
    await page.waitForFunction(() => window.fieldmarkRender?.ready || window.fieldmarkRender?.status === "error", { timeout: 30000 });
    const status = await page.evaluate(() => window.fieldmarkRender?.status);
    if (status !== "ready") throw new Error("Google Maps could not be loaded for the picture.");
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
    });
    return await page.locator("#render-surface").screenshot({ type: "png", animations: "disabled", timeout: 30000 });
  } finally {
    await browser?.close().catch(() => {});
  }
}

async function render(job) {
  const input = job.input;
  const format = input.orientation === "portrait" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
  const scale = format.width / input.logicalSize.width;
  const range = timelineRange([...input.project.badges, ...input.project.units]);
  const frames = input.duration * 30;
  const origin = renderOrigin;
  let browser;
  let encoder;
  try {
    browser = await chromium.launch({ headless: true, args: ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"] });
    job.browser = browser;
    if (job.cancelled) return;
    const context = await browser.newContext({ viewport: input.logicalSize, deviceScaleFactor: scale });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    await page.goto(`${origin}/render.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !!window.fieldmarkRender);
    await page.evaluate((value) => window.fieldmarkRender.load(value), input);
    await page.waitForFunction(() => window.fieldmarkRender?.ready, { timeout: 30000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
    });
    if (job.cancelled) return;
    job.status = "rendering";
    encoder = spawn(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", "30", "-vcodec", "png", "-i", "pipe:0", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", job.file], { windowsHide: true, stdio: ["pipe", "ignore", "pipe"] });
    job.encoder = encoder;
    let ffmpegError = "";
    encoder.stderr.on("data", (chunk) => { ffmpegError = (ffmpegError + chunk.toString()).slice(-4000); });
    const done = new Promise((resolveDone, rejectDone) => {
      encoder.once("error", rejectDone);
      encoder.once("close", (code) => code === 0 ? resolveDone() : rejectDone(new Error(ffmpegError || `FFmpeg exited with code ${code}.`)));
    });
    done.catch(() => {});
    let writeError = null;
    encoder.stdin.on("error", (error) => { writeError = error; });
    const surface = page.locator("#render-surface");
    for (let frame = 0; frame < frames; frame++) {
      if (job.cancelled) return;
      if (writeError) throw writeError;
      const time = range.start + (range.end - range.start) * frame / (frames - 1);
      await page.evaluate((value) => window.fieldmarkRender.seek(value), time);
      const image = await surface.screenshot({ type: "png", animations: "disabled", timeout: 30000 });
      if (!encoder.stdin.write(image)) await Promise.race([once(encoder.stdin, "drain"), done.then(() => { throw new Error("The encoder stopped before all frames were written."); })]);
      job.progress = Math.floor((frame + 1) / frames * 100);
    }
    job.status = "finishing";
    encoder.stdin.end();
    await done;
    if (!job.cancelled) job.status = "completed";
  } finally {
    if (job.cancelled) encoder?.kill();
    await browser?.close().catch(() => {});
    job.browser = null;
    job.encoder = null;
    job.finished = Date.now();
    job.input = null;
    if (job.status !== "completed") rmSync(job.file, { force: true });
  }
}

function schedule() {
  if (active || !queue.length) return;
  const job = queue.shift();
  active = job;
  render(job).catch((error) => {
    if (!job.cancelled) { job.status = "failed"; job.error = error.message || "Rendering failed."; }
  }).finally(() => { active = null; schedule(); });
}

async function handleApi(req, res, path) {
  if (req.headers.origin) {
    let origin;
    try { origin = new URL(req.headers.origin); }
    catch { return reply(res, 403, { error: "Invalid request origin." }); }
    if (origin.host !== req.headers.host) return reply(res, 403, { error: "Only this app can start a render." });
  }
  if (path === "/api/map/image" && req.method === "POST") {
    if (active || queue.length || imageCaptureActive) return reply(res, 429, { error: "Wait for the current export to finish before downloading a picture." });
    let input;
    try { input = validateImageInput(await readJson(req)); }
    catch (error) { return reply(res, 400, { error: error.message }); }
    if (active || queue.length || imageCaptureActive) return reply(res, 429, { error: "Wait for the current export to finish before downloading a picture." });
    imageCaptureActive = true;
    try {
      const image = await captureMapImage(input);
      const filename = `malaya-world-war-ii-map-${new Date().toISOString().slice(0, 10)}.png`;
      res.writeHead(200, { "Content-Type": "image/png", "Content-Length": image.length, "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" });
      res.end(image);
    } catch (error) { return reply(res, 500, { error: error.message || "The map picture could not be created." }); }
    finally { imageCaptureActive = false; }
    return;
  }
  if (path === "/api/video/jobs" && req.method === "POST") {
    if (queue.length >= 2) return reply(res, 429, { error: "Two videos are already waiting. Try again when one finishes." });
    try {
      const input = validate(await readJson(req));
      const id = randomUUID();
      const job = { id, input, orientation: input.orientation, status: "queued", progress: 0, error: null, cancelled: false, created: Date.now(), file: join(outputDir, `${id}.mp4`) };
      jobs.set(id, job);
      queue.push(job);
      schedule();
      return reply(res, 202, viewOf(job));
    } catch (error) { return reply(res, 400, { error: error.message }); }
  }
  const match = /^\/api\/video\/jobs\/([a-f0-9-]{36})(\/file)?$/.exec(path);
  if (!match) return reply(res, 404, { error: "Video job not found." });
  const job = jobs.get(match[1]);
  if (!job) return reply(res, 404, { error: "Video job not found or expired." });
  if (match[2] && req.method === "GET") {
    if (job.status !== "completed" || !existsSync(job.file)) return reply(res, 409, { error: "Video is not ready." });
    res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": statSync(job.file).size, "Content-Disposition": `attachment; filename="malaya-world-war-ii-${job.orientation}-${job.id.slice(0, 8)}.mp4"`, "Cache-Control": "private, max-age=3600" });
    createReadStream(job.file).pipe(res);
    return;
  }
  if (req.method === "GET" && !match[2]) return reply(res, 200, viewOf(job));
  if (req.method === "DELETE" && !match[2]) {
    if (!["completed", "failed", "cancelled"].includes(job.status)) {
      job.cancelled = true;
      job.status = "cancelled";
      const index = queue.indexOf(job);
      if (index >= 0) queue.splice(index, 1);
      if (index >= 0) { job.finished = Date.now(); job.input = null; }
      job.encoder?.kill();
      job.browser?.close().catch(() => {});
      rmSync(job.file, { force: true });
    }
    return reply(res, 200, viewOf(job));
  }
  return reply(res, 405, { error: "Method not allowed." });
}

const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
const server = createServer(async (req, res) => {
  try {
    const requestHost = req.headers.host ?? "";
    let hostname;
    if (requestHost && !/[\s\/\\@?#]/.test(requestHost)) {
      try { hostname = new URL(`http://${requestHost}`).hostname; }
      catch { /* Invalid Host headers are rejected below. */ }
    }
    if (allowedHosts.has(hostname)) {
      const path = new URL(req.url, `http://${requestHost}`).pathname;
      if (path === "/healthz" && req.method === "GET") return reply(res, 200, { status: "ok" });
      if (path.startsWith("/api/")) return await handleApi(req, res, path);
      if (dev) return vite.middlewares(req, res, () => reply(res, 404, { error: "Page not found." }));
      let file = resolve(root, "dist", `.${decodeURIComponent(path)}`);
      if (!file.startsWith(resolve(root, "dist") + sep) && file !== resolve(root, "dist")) return reply(res, 403, { error: "Invalid path." });
      if (path === "/" || !existsSync(file) || !statSync(file).isFile()) file = join(root, "dist", "index.html");
      res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" });
      createReadStream(file).pipe(res);
      return;
    }
    return reply(res, 403, { error: "This hostname is not allowed." });
  } catch (error) {
    if (!res.headersSent) reply(res, 500, { error: error.message || "Server error." });
  }
});

if (dev) {
  const { createServer: createViteServer } = await import("vite");
  vite = await createViteServer({ root, server: { middlewareMode: true, hmr: { server } }, appType: "spa" });
}
server.listen(port, host, () => console.log(`Malaya World War II with video export: http://${host}:${port}`));
setInterval(() => {
  for (const [id, job] of jobs) {
    if (job !== active && !queue.includes(job) && Date.now() - (job.finished ?? job.created) > 3600000) {
      rmSync(job.file, { force: true });
      jobs.delete(id);
    }
  }
}, 60000).unref();
