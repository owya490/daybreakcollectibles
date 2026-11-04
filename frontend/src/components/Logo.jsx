import { useDB } from '../data/db.js';
import crest from '../assets/brand/crest.png';
import wordmarkNavy from '../assets/brand/wordmark-navy.png';
import wordmarkCream from '../assets/brand/wordmark-cream.png';
import seal from '../assets/brand/seal.png';
import cloudBand from '../assets/brand/cloud-band.png';

export const BRAND = { crest, wordmarkNavy, wordmarkCream, seal, cloudBand };

/** The Daybreak crest (crane and rising sun). An uploaded override in Settings takes precedence. */
export function LogoMark({ size = 40, style }) {
  const override = useDB((s) => s.settings.logoDataUrl);
  return <img src={override || crest} alt="Daybreak Collectibles crest" style={{ height: size, width: 'auto', display: 'block', ...style }} />;
}

/** Full wordmark: DAYBREAK / COLLECTIBLES with the 朝の光 seal. */
export function Wordmark({ height = 40, inverse = false, style }) {
  return <img src={inverse ? wordmarkCream : wordmarkNavy} alt="Daybreak Collectibles" style={{ height, width: 'auto', display: 'block', ...style }} />;
}

export default function Logo({ inverse = false, size = 40, crestOnly = false }) {
  if (crestOnly) return <LogoMark size={size} />;
  return (
    <span className="brand">
      <LogoMark size={size} />
      <Wordmark height={size * 0.62} inverse={inverse} />
    </span>
  );
}
