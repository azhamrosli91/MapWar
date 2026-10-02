import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Flag } from "lucide-react";
import { BADGE_SYMBOLS, unitImage } from "./badge.js";

function targetInfo(target) {
  const isBadge = target.label != null;
  const symbolValue = isBadge
    ? target.symbol
    : target.kind === "troop"
      ? "person"
      : target.kind === "other"
        ? "helmet"
        : target.kind;

  return {
    isBadge,
    name: target.label || target.name || "Unnamed target",
    symbol: BADGE_SYMBOLS.find((item) => item.value === symbolValue),
    image: isBadge ? (symbolValue === "custom" ? target.symbolImage : "") : unitImage(target),
  };
}

function TargetBadge({ target }) {
  const { isBadge, symbol, image } = targetInfo(target);
  return (
    <span className={`effect-target-badge${isBadge ? " has-flag" : ""}`} aria-hidden="true">
      {isBadge && (
        <span className="effect-target-flag">
          {target.flag ? <img src={target.flag} alt="" draggable="false" /> : <Flag size={17} />}
        </span>
      )}
      {image ? (
        <img className="effect-target-symbol-image" src={image} alt="" draggable="false" />
      ) : symbol?.paths.length ? (
        <svg className="effect-target-symbol" viewBox={symbol.viewBox} style={isBadge ? undefined : { color: target.color ?? "#ffffff" }}>
          {symbol.paths.map((path) => <path key={path.d} d={path.d} fillRule={path.fillRule} />)}
        </svg>
      ) : <span className="effect-target-symbol-empty" />}
    </span>
  );
}

function TargetCopy({ target, id }) {
  const { isBadge, name } = targetInfo(target);
  return (
    <span className="effect-target-copy" id={id}>
      <span className="effect-target-name">{name}</span>
      <small>{isBadge ? "Badge" : "Equipment"}</small>
    </span>
  );
}

export default function EffectTargetPicker({ targets, value, onChange, label = "Effect target" }) {
  const [open, setOpen] = useState(false);
  const selectedIndex = targets.findIndex((target) => target.id === value);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const pickerRef = useRef(null);
  const pickerId = useId();
  const labelId = `${pickerId}-label`;
  const listboxId = `${pickerId}-listbox`;
  const valueId = `${pickerId}-value`;
  const selectedTarget = selectedIndex < 0 ? null : targets[selectedIndex];

  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutsidePointer(event) {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  function openPicker() {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function selectTarget(target, index) {
    onChange(target.id);
    setActiveIndex(index);
    setOpen(false);
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openPicker();
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + direction + targets.length) % targets.length);
    } else if (event.key === "Home" || event.key === "End") {
      if (!targets.length) return;
      event.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex(event.key === "Home" ? 0 : targets.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) openPicker();
      else if (targets[activeIndex]) selectTarget(targets[activeIndex], activeIndex);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="field-label effect-target-field">
      <div className="effect-target-label" id={labelId}>{label}</div>
      <div className="effect-target-picker" ref={pickerRef}>
        <button
          className="effect-target-trigger"
          type="button"
          role="combobox"
          aria-labelledby={`${labelId} ${valueId}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          disabled={!targets.length}
          onClick={() => open ? setOpen(false) : openPicker()}
          onKeyDown={handleKeyDown}
          onBlur={(event) => {
            if (!pickerRef.current?.contains(event.relatedTarget)) setOpen(false);
          }}
        >
          {selectedTarget ? <>
            <TargetBadge target={selectedTarget} />
            <TargetCopy target={selectedTarget} id={valueId} />
          </> : <span className="effect-target-placeholder" id={valueId}>Choose a target</span>}
          <ChevronDown size={16} className="effect-target-chevron" aria-hidden="true" />
        </button>
        {open && <div className="effect-target-menu" id={listboxId} role="listbox" aria-labelledby={labelId}>
          {targets.map((target, index) => (
            <div
              className="effect-target-option"
              id={`${listboxId}-option-${index}`}
              key={target.id}
              role="option"
              aria-selected={target.id === value}
              data-active={index === activeIndex || undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectTarget(target, index)}
            >
              <TargetBadge target={target} />
              <TargetCopy target={target} />
            </div>
          ))}
        </div>}
      </div>
    </div>
  );
}
