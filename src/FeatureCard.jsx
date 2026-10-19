import { Flag } from "lucide-react";
import { BADGE_SYMBOLS } from "./badge.js";
import HelpTooltip from "./HelpTooltip.jsx";

export default function FeatureCard({ name, image, visual, badge, active, onClick, details }) {
  const symbol = badge && BADGE_SYMBOLS.find((item) => item.value === badge.symbol);
  return <HelpTooltip label={name} description={<>{details.map(([label, value]) => <span className="feature-card-detail" key={label}>{label}: {value}</span>)}</>}>
    <button type="button" className={`feature-card${active ? " active" : ""}${badge ? " feature-card-badge" : ""}`} onClick={onClick} aria-label={`Edit ${name}`}>
      <span className="feature-card-image">{badge ? <>
        <span className="feature-card-flag">{badge.flag ? <img src={badge.flag} alt="Flag" /> : <Flag size={30} />}</span>
        <span className="feature-card-symbol">{badge.symbol === "custom" && badge.symbolImage ? <img src={badge.symbolImage} alt="Custom symbol" /> : symbol?.paths.length > 0 && <svg viewBox={symbol.viewBox} aria-label={symbol.label}>{symbol.paths.map((path) => <path key={path.d} fill="currentColor" fillRule={path.fillRule} d={path.d} />)}</svg>}</span>
      </> : image ? <img src={image} alt="" /> : visual}</span>
      <span className="feature-card-name">{name}</span>
    </button>
  </HelpTooltip>;
}
