import { TerritoryEngine } from "./territory-engine.js";

let generation = 0, request = 0, configured = Promise.resolve();
let engine = new TerritoryEngine();
let resetNeeded = true;
const cancelled = new Error("Obsolete territory calculation");
self.onmessage = ({ data }) => {
  if (data.type === "configure") {
    generation = data.generation; request++;
    const current = generation;
    configured = configured.catch(() => {}).then(async () => {
      if (current !== generation) throw cancelled;
      await engine.configure(data.config, data.badges, () => { if (current !== generation) throw cancelled; });
      resetNeeded = true;
    });
    configured.catch(() => {});
  } else if (data.type === "seek") {
    request = data.request;
    const current = request, gen = data.generation;
    const check = () => { if (gen !== generation || current !== request) throw cancelled; };
    // Serial reconstruction protects mutable ownership state during cooperative yields.
    configured = configured.catch((error) => { if (error !== cancelled) throw error; }).then(async () => {
      check();
      const result = await engine.seek(data.time, check, data.reset || resetNeeded);
      check();
      resetNeeded = false;
      self.postMessage({ ...result, generation: gen, request: current, time: data.time });
    }).catch((error) => {
      resetNeeded = true;
      if (error !== cancelled) {
        self.postMessage({ generation: gen, request: current, error: error.message });
        engine = new TerritoryEngine();
        throw error;
      }
    });
    configured.catch(() => {});
  }
};
