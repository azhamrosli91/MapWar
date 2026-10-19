import { useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";
import { previewUrl } from "./preview-client.js";

export default function SharePreviewButton({ id }) {
  const [message, setMessage] = useState("");
  const [fallback, setFallback] = useState(false);
  const inputRef = useRef(null);
  const url = previewUrl(id);
  useEffect(() => {
    if (fallback) { inputRef.current?.focus(); inputRef.current?.select(); }
  }, [fallback]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setFallback(false);
      setMessage("Link copied.");
    } catch {
      setFallback(true);
      setMessage("Select and copy this link.");
      inputRef.current?.select();
    }
  }
  return <div className="preview-share">
    <button type="button" className="secondary" onClick={copy}><Copy size={16} />Copy link</button>
    {message && <small role="status">{message}</small>}
    {fallback && <input ref={inputRef} aria-label="Preview link" readOnly value={url} onFocus={(event) => event.target.select()} />}
  </div>;
}
