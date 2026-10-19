export async function previewRequest(path = "", options = {}) {
  const response = await fetch(`/api/previews${path}`, { cache: "no-store", ...options });
  let data;
  try { data = await response.json(); }
  catch { throw new Error("The preview library could not be reached. Please try again."); }
  if (!response.ok) throw new Error(data.error || "The preview request failed. Please try again.");
  return data;
}

export function previewUrl(id) {
  const url = new URL("/preview", window.location.origin);
  url.searchParams.set("id", id);
  return url.href;
}
