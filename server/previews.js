import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { validateProject } from "../src/project-validation.js";

const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const digest = (value) => createHash("sha256").update(value).digest();

export function previewApi({ directory, adminKey, reply, readJson }) {
  const storage = resolve(directory);
  const key = adminKey?.trim() || "";

  async function list() {
    let entries;
    try { entries = await readdir(storage, { withFileTypes: true }); }
    catch (error) { if (error.code === "ENOENT") return []; throw error; }
    const previews = await Promise.all(entries.filter((entry) => entry.isDirectory() && idPattern.test(entry.name)).map(async (entry) => {
      try { return JSON.parse(await readFile(join(storage, entry.name, "metadata.json"), "utf8")); }
      catch (error) { if (error.code === "ENOENT") return null; throw error; }
    }));
    return previews.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  }

  return async function handlePreviews(req, res, path) {
    if (path !== "/api/previews" && !path.startsWith("/api/previews/")) return false;
    const id = path.slice("/api/previews/".length);
    const collection = path === "/api/previews";
    if (!collection && !idPattern.test(id)) { reply(res, 404, { error: "Preview not found or removed." }); return true; }
    const writing = (collection && req.method === "POST") || (!collection && req.method === "DELETE");
    if (writing) {
      if (!key) { reply(res, 503, { error: "Preview publishing is not configured on this server." }); return true; }
      const supplied = req.headers.authorization ?? "";
      if (!timingSafeEqual(digest(supplied), digest(`Bearer ${key}`))) {
        reply(res, 401, { error: "Enter a valid admin publishing key." }); return true;
      }
    }
    try {
      if (collection && req.method === "GET") {
        reply(res, 200, { publishingEnabled: Boolean(key), previews: await list() });
      } else if (!collection && req.method === "GET") {
        const publication = join(storage, id);
        const [metadata, project] = await Promise.all([
          readFile(join(publication, "metadata.json"), "utf8").then(JSON.parse),
          readFile(join(publication, "project.json"), "utf8").then(JSON.parse),
        ]);
        reply(res, 200, { ...metadata, project });
      } else if (collection && req.method === "POST") {
        let input, project;
        try {
          input = await readJson(req);
          if (typeof input?.title !== "string" || !input.title.trim() || input.title.trim().length > 80) throw new Error("Give the preview a title of 1–80 characters.");
          project = await validateProject(input.project);
        } catch (error) { reply(res, error.statusCode ?? 400, { error: error.message }); return true; }
        const metadata = { id: randomUUID(), title: input.title.trim(), createdAt: new Date().toISOString() };
        await mkdir(storage, { recursive: true });
        const staging = join(storage, `.${metadata.id}`);
        await mkdir(staging);
        try {
          await writeFile(join(staging, "project.json"), JSON.stringify(project), { flag: "wx", flush: true });
          await writeFile(join(staging, "metadata.json"), JSON.stringify(metadata), { flag: "wx", flush: true });
          await rename(staging, join(storage, metadata.id));
        } catch (error) { await rm(staging, { recursive: true, force: true }); throw error; }
        reply(res, 201, metadata);
      } else if (!collection && req.method === "DELETE") {
        const removed = join(storage, `.${id}-removed-${randomUUID()}`);
        await rename(join(storage, id), removed);
        await rm(removed, { recursive: true, force: true });
        reply(res, 200, { id });
      } else {
        reply(res, 405, { error: "Method not allowed." });
      }
    } catch (error) {
      if (error.code === "ENOENT") reply(res, 404, { error: "Preview not found or removed." });
      else {
        console.error("Preview storage operation failed:", error);
        reply(res, 500, { error: "The preview library is unavailable. Please try again." });
      }
    }
    return true;
  };
}
