export default function VisibilityEditor({ visibility, onChange }) {
  const current = visibility ?? { showAt: "", hideAt: "" };
  return <section className="visibility-editor" aria-label="Timeline visibility">
    <h4>Timeline visibility</h4>
    <p className="field-hint">Choose when this feature appears or disappears during playback. Leave a date blank to keep that side open.</p>
    <label>Show from<input type="datetime-local" min="0001-01-01T00:00" max="9999-12-31T23:59" step="60" value={current.showAt} onChange={(event) => onChange({ ...current, showAt: event.target.value })} /></label>
    <label>Hide at<input type="datetime-local" min="0001-01-01T00:00" max="9999-12-31T23:59" step="60" value={current.hideAt} onChange={(event) => onChange({ ...current, hideAt: event.target.value })} /></label>
    {(current.showAt || current.hideAt) && <button className="secondary" type="button" onClick={() => onChange({ showAt: "", hideAt: "" })}>Always visible</button>}
  </section>;
}
