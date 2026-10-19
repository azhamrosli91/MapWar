import { EMPTY_PROJECT, validateProject as validateProjectData, validateImageData } from "./project-validation.js";
export { DEFAULT_VIEW, EMPTY_PROJECT, MAX_BADGES, MAX_UNITS, checkProjectSize, coordinates, clearInvalidFiringTargets, normalizeLine } from "./project-validation.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateProject(input) {
  return validateProjectData(input, normalizeImage);
}

function decodeImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(
        new Error(
          "This image could not be opened. Choose a PNG, JPEG, or WebP image.",
        ),
      );
    image.src = source;
  });
}

async function normalizeImage(source) {
  validateImageData(source);
  const image = await decodeImage(source);
  if (
    !image.naturalWidth ||
    !image.naturalHeight ||
    image.naturalWidth * image.naturalHeight > 40_000_000
  ) {
    throw new Error("Choose a flag image smaller than 40 megapixels.");
  }
  const ratio = Math.min(
    1,
    512 / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export async function readFlag(file) {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > MAX_IMAGE_BYTES
  ) {
    throw new Error("Choose a PNG, JPEG, or WebP image under 5 MB.");
  }
  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () =>
      reject(new Error("The image could not be read. Please try again."));
    reader.readAsDataURL(file);
  });
  return normalizeImage(source);
}

let databasePromise;
function openDatabase() {
  if (!databasePromise)
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open("fieldmark", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("projects");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error("Browser storage is blocked by another tab."));
    });
  return databasePromise;
}

export async function loadProject() {
  const db = await openDatabase();
  const value = await new Promise((resolve, reject) => {
    const request = db
      .transaction("projects")
      .objectStore("projects")
      .get("current");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return value ? validateProject(value) : EMPTY_PROJECT;
}

export async function saveProject(project) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("projects", "readwrite");
    transaction.objectStore("projects").put(project, "current");
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error || new Error("Saving was interrupted."));
  });
}

export function exportProject(project, filename) {
  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const safeBaseName = String(filename ?? "")
    .trim()
    .replace(/\.json$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/[. ]+$/g, "")
    .trim();
  anchor.download = `${safeBaseName || `malaya-world-war-ii-${new Date().toISOString().slice(0, 10)}`}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return anchor.download;
}
