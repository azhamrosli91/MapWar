import { useCallback, useEffect, useRef, useState } from "react";
import { VIDEO_REQUEST_LIMIT } from "./video.js";

const activeStatuses = new Set(["submitting", "queued", "rendering", "finishing"]);

export default function useVideoJobs() {
  const [jobs, setJobs] = useState([]);
  const [visible, setVisible] = useState(true);
  const current = useRef([]);
  const inputs = useRef(new Map());
  const attempts = useRef(new Map());
  const mounted = useRef(true);
  const sequence = useRef(0);

  const update = useCallback((transform) => {
    current.current = transform(current.current);
    if (mounted.current) setJobs(current.current);
  }, []);

  const patch = useCallback((key, changes) => {
    update((items) => items.map((item) => item.key === key ? { ...item, ...changes } : item));
  }, [update]);

  useEffect(() => {
    mounted.current = true;
    let stopped = false;
    let timer;
    async function poll() {
      const pending = current.current.filter((job) => job.id && activeStatuses.has(job.status) && !job.cancelling);
      await Promise.all(pending.map(async (job) => {
        const attempt = attempts.current.get(job.key);
        try {
          const response = await fetch(`/api/video/jobs/${job.id}`);
          const next = await response.json();
          const latest = current.current.find((item) => item.key === job.key);
          if (stopped || attempts.current.get(job.key) !== attempt || !latest || !activeStatuses.has(latest.status) || latest.cancelling) return;
          if (!response.ok) {
            if (response.status === 404) {
              patch(job.key, { status: "failed", error: "This export expired or the render service restarted. You can retry the video.", connectionError: "" });
              return;
            }
            throw new Error(next.error || "Could not check video progress. Retrying…");
          }
          patch(job.key, { ...next, connectionError: "" });
          if (next.status === "completed") inputs.current.delete(job.key);
        } catch (failure) {
          const latest = current.current.find((item) => item.key === job.key);
          if (!stopped && attempts.current.get(job.key) === attempt && latest && activeStatuses.has(latest.status) && !latest.cancelling) patch(job.key, { connectionError: failure.message });
        }
      }));
      if (!stopped) timer = setTimeout(poll, 800);
    }
    timer = setTimeout(poll, 800);
    return () => { stopped = true; mounted.current = false; clearTimeout(timer); };
  }, [patch]);

  async function submit(key, input, label, notice) {
    const attempt = (attempts.current.get(key) ?? 0) + 1;
    attempts.current.set(key, attempt);
    inputs.current.set(key, input);
    const entry = { key, label, notice, id: null, status: "submitting", progress: 0, error: "", connectionError: "", cancelling: false };
    update((items) => items.some((item) => item.key === key) ? items.map((item) => item.key === key ? entry : item) : [...items, entry]);
    try {
      const body = JSON.stringify(input);
      if (new Blob([body]).size > VIDEO_REQUEST_LIMIT) throw new Error("This video exceeds the 32 MB export limit. Use a shorter recording or a smaller map.");
      const response = await fetch("/api/video/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const next = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(next.error || "The render service could not start this video.");
      if (attempts.current.get(key) !== attempt) {
        // Cancellation can happen while the upload is still in flight.
        await fetch(`/api/video/jobs/${next.id}`, { method: "DELETE" });
        return;
      }
      patch(key, next);
    } catch (failure) {
      if (attempts.current.get(key) === attempt) patch(key, { status: "failed", error: failure.message || "Video export failed. You can retry your recording." });
    }
  }

  function start(input, name, notice = "") {
    const key = crypto.randomUUID();
    const label = `${name || "Map video"} · Video ${++sequence.current}`;
    setVisible(true);
    void submit(key, input, label, notice);
  }

  function retry(key) {
    const job = current.current.find((item) => item.key === key);
    const input = inputs.current.get(key);
    if (!job || !input || activeStatuses.has(job.status)) return;
    void submit(key, input, job.label, job.notice);
  }

  async function cancel(key) {
    const job = current.current.find((item) => item.key === key);
    if (!job || !activeStatuses.has(job.status) || job.cancelling) return;
    if (!job.id) {
      attempts.current.set(key, (attempts.current.get(key) ?? 0) + 1);
      patch(key, { status: "cancelled" });
      return;
    }
    const attempt = attempts.current.get(key);
    patch(key, { cancelling: true });
    try {
      const response = await fetch(`/api/video/jobs/${job.id}`, { method: "DELETE" });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || "Could not cancel the export.");
      if (attempts.current.get(key) !== attempt) return;
      patch(key, { ...next, cancelling: false, connectionError: "" });
      if (next.status === "completed") inputs.current.delete(key);
    } catch (failure) {
      if (attempts.current.get(key) === attempt) patch(key, { cancelling: false, connectionError: failure.message });
    }
  }

  function dismiss(key) {
    const job = current.current.find((item) => item.key === key);
    if (!job || activeStatuses.has(job.status)) return;
    attempts.current.delete(key);
    inputs.current.delete(key);
    update((items) => items.filter((item) => item.key !== key));
  }

  return { jobs, visible, setVisible, start, retry, cancel, dismiss };
}
