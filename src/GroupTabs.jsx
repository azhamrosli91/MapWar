import { useEffect, useRef, useState } from "react";
import { clearInvalidFiringTargets } from "./data.js";

const colors = ["#3478d4", "#cf4d4d", "#54a35a", "#e2b537", "#8b62b5", "#158f90"];
export default function GroupTabs({ project, activeId, onSelect, onChange, locked }) {
  const [deleting, setDeleting] = useState(false);
  const [destination, setDestination] = useState("");
  const [nameDialog, setNameDialog] = useState(null);
  const [name, setName] = useState("");
  const dialogRef = useRef(null);
  useEffect(() => {
    if (nameDialog && !locked) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [nameDialog, locked]);
  function openNameDialog(item = null) {
    if (locked) return;
    setName(item?.name ?? "");
    setDeleting(false);
    setDestination("");
    setNameDialog({ id: item?.id ?? null });
  }
  function saveName(event) {
    event.preventDefault();
    if (locked || !name.trim()) return;
    if (nameDialog.id) {
      onChange({ ...project, groups: project.groups.map((item) => item.id === nameDialog.id ? { ...item, name: name.trim() } : item) });
    } else {
      if (project.groups.length >= 100) return;
      const added = { id: crypto.randomUUID(), name: name.trim(), color: colors[project.groups.length % colors.length] };
      onChange({ ...project, groups: [...project.groups, added] });
      onSelect(added.id);
    }
    setNameDialog(null);
  }
  const group = project.groups.find((item) => item.id === activeId) ?? project.groups[0];
  const settingsGroup = project.groups.find((item) => item.id === nameDialog?.id);
  function update(changes) { onChange({ ...project, groups: project.groups.map((item) => item.id === settingsGroup.id ? { ...item, ...changes } : item) }); }
  function reorder(delta) {
    const groups = [...project.groups], index = groups.findIndex((item) => item.id === settingsGroup.id), next = index + delta;
    if (next < 0 || next >= groups.length) return;
    [groups[index], groups[next]] = [groups[next], groups[index]];
    onChange({ ...project, groups });
  }
  function remove() {
    if (locked || !settingsGroup || !destination || project.groups.length === 1) return;
    const updated = { ...project, groups: project.groups.filter((item) => item.id !== settingsGroup.id) };
    for (const key of ["badges", "units", "lines", "paintStrokes"]) updated[key] = project[key].flatMap((item) => item.groupId !== settingsGroup.id ? [item] : destination === "delete" ? [] : [{ ...item, groupId: destination }]);
    onChange(clearInvalidFiringTargets(updated));
    if (activeId === settingsGroup.id) onSelect(updated.groups[0].id);
    setDeleting(false); setNameDialog(null);
  }
  return <div className="group-controls">
    <div className="group-tab-bar">
      <div className="group-tabs" role="tablist" aria-label="Groups">{project.groups.map((item) => <button type="button" role="tab" aria-selected={item.id === group.id} className={item.id === group.id ? "active" : ""} style={{ "--group-color": item.color }} key={item.id} title={`${item.name} · Right-click to rename`} onContextMenu={(event) => { event.preventDefault(); openNameDialog(item); }} onKeyDown={(event) => { if (event.key === "F2") { event.preventDefault(); openNameDialog(item); } }} onClick={() => { onSelect(item.id); setDeleting(false); }}><i /><span className="group-tab-name">{item.name}</span><span className="group-tab-count" aria-label={`${project.badges.filter((badge) => badge.groupId === item.id).length} badges`}>{project.badges.filter((badge) => badge.groupId === item.id).length}</span></button>)}</div>
      <button className="group-add-tab" type="button" aria-label="Add group" title="Add group" disabled={locked || project.groups.length >= 100} onClick={() => openNameDialog()}>+</button>
    </div>
    <dialog className="group-name-dialog" ref={dialogRef} onCancel={() => setNameDialog(null)} onClose={() => setNameDialog(null)} aria-labelledby="group-name-title">
      <form onSubmit={saveName}>
        <h3 id="group-name-title">{nameDialog?.id ? "Group settings" : "New group"}</h3>
        <label htmlFor="group-name">Group name</label>
        <input id="group-name" autoFocus required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
        {settingsGroup && !locked && <div className="group-settings">
          <label>Color<input type="color" value={settingsGroup.color} onChange={(event) => update({ color: event.target.value })} /></label>
          <div className="group-actions">
            <button type="button" onClick={() => reorder(-1)} disabled={project.groups[0].id === settingsGroup.id}>Move left</button>
            <button type="button" onClick={() => reorder(1)} disabled={project.groups.at(-1).id === settingsGroup.id}>Move right</button>
            <button type="button" disabled={project.groups.length === 1} onClick={() => { setDeleting(true); setDestination(""); }}>Delete group</button>
          </div>
          {deleting && <div className="group-delete">
            <label>Objects in this group<select value={destination} onChange={(event) => setDestination(event.target.value)}><option value="">Choose what happens…</option>{project.groups.filter((item) => item.id !== settingsGroup.id).map((item) => <option key={item.id} value={item.id}>Move to {item.name}</option>)}<option value="delete">Delete this group and its objects</option></select></label>
            <button type="button" className="delete-button" disabled={!destination} onClick={remove}>Confirm group deletion</button>
            <button type="button" onClick={() => setDeleting(false)}>Cancel deletion</button>
          </div>}
        </div>}
        <div className="group-actions"><button type="button" onClick={() => setNameDialog(null)}>Cancel</button><button type="submit" disabled={locked || !name.trim()}>{nameDialog?.id ? "Save name" : "Create group"}</button></div>
      </form>
    </dialog>
  </div>;
}
