import { useState } from "react";
import VisibilityEditor from "./VisibilityEditor.jsx";
import { visibilityError } from "./timeline.js";

export default function PaintVisibilityEditor({ group, onSave }) {
  const [draft, setDraft] = useState(null);
  const visibility = draft ?? group?.paintVisibility ?? { showAt: "", hideAt: "" };
  const error = visibilityError(visibility);
  return <div>
    <p>Timeline dates apply to all paint in this group.</p>
    <VisibilityEditor visibility={visibility} onChange={setDraft} />
    {error && <p role="alert">{error}</p>}
    <button type="button" className="secondary" disabled={!draft || !!error} onClick={() => { onSave(visibility); setDraft(null); }}>Save paint dates</button>
  </div>;
}
