import { useEffect, useRef, useState } from "react";
import { ExternalLink, LoaderCircle, Trash2, X } from "lucide-react";
import { previewRequest, previewUrl } from "./preview-client.js";
import SharePreviewButton from "./SharePreviewButton.jsx";

export default function PreviewLibrary({ project, mapFileName, hasDraft, onClose }) {
  const dialogRef = useRef(null);
  const [library, setLibrary] = useState(null);
  const [adminKey, setAdminKey] = useState("");
  const [title, setTitle] = useState((mapFileName.replace(/\.json$/i, "") || "My field map").slice(0, 80));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    previewRequest("", { signal: controller.signal }).then(setLibrary).catch((error) => {
      if (!controller.signal.aborted) setError(error.message);
    });
    return () => controller.abort();
  }, [reload]);

  const authorization = { Authorization: `Bearer ${adminKey.trim()}` };
  async function publish(event) {
    event.preventDefault();
    if (busy || hasDraft || !library?.publishingEnabled) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const publication = await previewRequest("", {
        method: "POST", headers: { ...authorization, "Content-Type": "application/json" },
        body: JSON.stringify({ title, project }),
      });
      setLibrary((current) => ({ ...current, previews: [publication, ...current.previews] }));
      setNotice("Published a fixed copy. Open its preview or copy its link below.");
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  async function remove(publication) {
    if (busy || !window.confirm(`Remove “${publication.title}”? Its shared link will stop working.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await previewRequest(`/${publication.id}`, { method: "DELETE", headers: authorization });
      setLibrary((current) => ({ ...current, previews: current.previews.filter((item) => item.id !== publication.id) }));
      setNotice("Preview removed.");
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }

  return <dialog ref={dialogRef} className="preview-library" aria-labelledby="preview-library-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="preview-library-heading">
      <h2 id="preview-library-title">Preview library</h2>
      <button type="button" className="icon-button" aria-label="Close preview library" disabled={busy} onClick={onClose}><X size={20} /></button>
    </div>
    <div className="preview-library-content">
      <p>Publish a fixed copy for anyone to view and play. Future editor changes won’t change an existing preview.</p>
      {error && <p className="form-error" role="alert">{error} <button type="button" disabled={busy} onClick={() => { setError(""); setReload((value) => value + 1); }}>Refresh library</button></p>}
      {notice && <p className="preview-notice" role="status">{notice}</p>}
      {!library && !error && <p role="status"><LoaderCircle size={16} className="spin" /> Loading previews…</p>}
      {library?.publishingEnabled === false && <p className="preview-notice">Publishing is not configured on this server. Published previews are still available below.</p>}
      {library?.publishingEnabled && <form className="preview-publish" onSubmit={publish}>
        <label className="field-label">Admin publishing key<input type="password" autoComplete="off" value={adminKey} disabled={busy} onChange={(event) => setAdminKey(event.target.value)} placeholder="Enter your publishing key" /></label>
        <label className="field-label">Preview title<input value={title} maxLength={80} required disabled={busy} onChange={(event) => setTitle(event.target.value)} /></label>
        {hasDraft && <p className="field-hint">Save or cancel the active edits in the editor before publishing.</p>}
        <button className="primary" type="submit" disabled={busy || hasDraft || !adminKey.trim() || !title.trim()}>{busy ? "Please wait…" : "Publish current map"}</button>
      </form>}
      {library && <section aria-label="Published previews" className="preview-publications">
        <h3>Published previews</h3>
        {!library.previews.length && <p>No previews have been published yet.</p>}
        {library.previews.map((publication) => <article className="preview-publication" key={publication.id}>
          <div><strong>{publication.title}</strong><time dateTime={publication.createdAt}>{new Date(publication.createdAt).toLocaleString()}</time></div>
          <div className="preview-publication-actions">
            <a className="secondary" href={previewUrl(publication.id)} target="_blank" rel="noreferrer"><ExternalLink size={15} />Open preview</a>
            <SharePreviewButton id={publication.id} />
            {library.publishingEnabled && <button className="secondary preview-remove" type="button" disabled={busy || !adminKey.trim()} onClick={() => remove(publication)}><Trash2 size={15} />Remove</button>}
          </div>
        </article>)}
      </section>}
    </div>
  </dialog>;
}
