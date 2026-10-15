import { Download, LoaderCircle, X } from "lucide-react";
import ExportFrameOptions from "./ExportFrameOptions.jsx";

export default function PictureExportPanel({ orientation, onOrientation, busy, error, mapReady, frameSize, onDownload, onClose }) {
  return <section className="video-export-panel" aria-label="Picture export">
    <div className="video-export-heading"><strong>Download picture</strong><span>Pan and zoom inside the frame to choose the view.</span><button className="icon-button" disabled={busy} onClick={onClose} aria-label="Close picture export"><X size={17} /></button></div>
    <div className="video-export-controls">
      <ExportFrameOptions orientation={orientation} onOrientation={onOrientation} disabled={busy} />
      <button className="primary" disabled={busy || !mapReady || !frameSize || Math.min(frameSize.width, frameSize.height) < 90} onClick={onDownload}>{busy ? <LoaderCircle size={15} className="spin" /> : <Download size={15} />} {busy ? "Creating picture…" : "Download PNG"}</button>
    </div>
    {busy && <p className="video-job" role="status">Creating your framed picture…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
