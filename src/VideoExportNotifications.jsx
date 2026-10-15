import { Download, Film, X } from "lucide-react";

function statusText(job) {
  if (job.cancelling) return "Cancelling…";
  switch (job.status) {
    case "submitting": return "Sending video…";
    case "queued": return "Waiting to render…";
    case "rendering": return `Rendering ${job.progress}%`;
    case "finishing": return "Finishing MP4…";
    case "completed": return "Your video is ready to download.";
    case "cancelled": return "Export cancelled.";
    default: return "Video export failed.";
  }
}

export default function VideoExportNotifications({ exports }) {
  const { jobs, visible, setVisible, cancel, retry, dismiss } = exports;
  if (!jobs.length) return null;
  const pending = jobs.filter((job) => ["submitting", "queued", "rendering", "finishing"].includes(job.status));
  const completed = jobs.filter((job) => job.status === "completed").length;
  const failed = jobs.filter((job) => job.status === "failed").length;
  const rendering = pending.find((job) => job.status === "rendering");
  const summary = [pending.length ? `${pending.length} rendering${rendering ? ` · ${rendering.progress}%` : ""}` : "", completed ? `${completed} ready` : "", failed ? `${failed} failed` : ""].filter(Boolean).join(" · ") || "View exports";

  if (!visible) return <button className="video-progress-launcher" onClick={() => setVisible(true)} aria-label={`Show video progress: ${summary}`} aria-expanded="false">
    <Film size={17} /><span role="status">Video exports · {summary}</span>
  </button>;

  return <section className="video-export-notifications" aria-label="Video export progress">
    <div className="video-progress-heading"><Film size={18} /><strong>Video exports</strong><button className="icon-button" onClick={() => setVisible(false)} aria-label="Hide video progress"><X size={17} /></button></div>
    <p className="video-background-hint">You can keep editing while your videos render.</p>
    <div className="video-progress-list">{jobs.map((job) => {
      const active = ["submitting", "queued", "rendering", "finishing"].includes(job.status);
      const file = job.status === "completed" ? `/api/video/jobs/${job.id}/file` : null;
      return <article className="video-progress-item" key={job.key} aria-label={job.label}>
        <div className="video-progress-title"><strong>{job.label}</strong>{!active && <button className="icon-button" onClick={() => dismiss(job.key)} aria-label={`Dismiss ${job.label}`}><X size={15} /></button>}</div>
        <p role="status">{statusText(job)}</p>
        {active && <progress aria-label={`Rendering progress for ${job.label}`} max="100" value={job.status === "rendering" ? job.progress : undefined} />}
        {job.notice && <p className="video-progress-note">{job.notice}</p>}
        {job.error && <p className="video-progress-error" role="alert">{job.error}</p>}
        {job.connectionError && <p className="video-progress-error" role="alert">{job.connectionError}</p>}
        <div className="video-progress-actions">
          {active && <button className="secondary" disabled={job.cancelling} onClick={() => cancel(job.key)}>Cancel export</button>}
          {["failed", "cancelled"].includes(job.status) && <button className="secondary" onClick={() => retry(job.key)}>Retry video</button>}
          {file && <a className="primary" href={file} download><Download size={15} /> Download MP4</a>}
        </div>
        {file && <details className="video-progress-preview"><summary>Preview video</summary><video src={file} controls preload="none" aria-label={`Preview ${job.label}`} /></details>}
      </article>;
    })}</div>
  </section>;
}
