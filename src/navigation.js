export function createNavigator() {
  const worker = new Worker(new URL("./navigation.worker.js", import.meta.url), { type: "module" });
  const pending = new Map();
  let active = 0, failed = false;
  function dispatch() {
    for (const [id, item] of pending) {
      if (active >= 2) break;
      if (item.sent) continue;
      item.sent = true; active++; worker.postMessage({ ...item.input, id });
    }
  }
  worker.onmessage = ({ data }) => {
    const item = pending.get(data.id);
    if (!item) return;
    pending.delete(data.id);
    active--;
    if (data.error) item.reject(new Error(data.error)); else item.resolve(data.result);
    dispatch();
  };
  worker.onerror = () => { failed = true; for (const item of pending.values()) item.reject(new Error("Terrain navigation is unavailable.")); pending.clear(); active = 0; };
  return {
    request(input) {
      const id = crypto.randomUUID();
      const promise = new Promise((resolve, reject) => {
        if (failed) { reject(new Error("Terrain navigation is unavailable. Reload the map to retry.")); return; }
        pending.set(id, { resolve, reject, input, sent: false }); dispatch();
      });
      return { promise, cancel() {
        const item = pending.get(id);
        if (!item) return;
        if (item.sent) { worker.postMessage({ type: "cancel", id }); active--; }
        item.reject(new Error("Cancelled")); pending.delete(id); dispatch();
      } };
    },
    dispose() { failed = true; worker.terminate(); for (const item of pending.values()) item.reject(new Error("Cancelled")); pending.clear(); },
  };
}
