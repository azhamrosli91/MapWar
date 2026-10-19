import { useId, useState } from "react";
import { createPortal } from "react-dom";

export default function HelpTooltip({ label, description, children }) {
  const id = useId();
  const [position, setPosition] = useState(null);
  function show(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const width = Math.min(300, window.innerWidth - 24);
    setPosition({ top: bounds.bottom + 8, left: Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12)), width });
  }
  return <span className="feature-tab-trigger" onMouseEnter={show} onMouseLeave={() => setPosition(null)} onFocus={show} onBlur={() => setPosition(null)} aria-describedby={position ? id : undefined}>
    {children}
    {position && createPortal(<span id={id} className="feature-tab-tooltip" role="tooltip" style={position}>
      <strong>{label}</strong>
      <span>{description}</span>
    </span>, document.body)}
  </span>;
}
