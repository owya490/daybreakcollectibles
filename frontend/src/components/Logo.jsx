import { useDB } from '../data/db.js';

/**
 * Logo slot. The real Daybreak crane-and-sun stamp must be used unchanged:
 * upload it in Admin > Settings > Brand (or replace public/logo.png), and it
 * renders here everywhere. Until then a deliberately plain TEMPORARY placeholder
 * seal is shown, which is not a redesign of the logo.
 */
export function LogoMark({ size = 40, inverse = false }) {
  const logo = useDB((s) => s.settings.logoDataUrl);
  if (logo) return <img src={logo} alt="Daybreak Collectibles" style={{ width: size, height: size, objectFit: 'contain' }} />;
  const fg = inverse ? '#D8D2B3' : '#00009E';
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Daybreak Collectibles (temporary logo placeholder)">
      <title>Temporary placeholder: upload the Daybreak crane and sun stamp in Admin Settings</title>
      <circle cx="24" cy="24" r="22.5" fill="none" stroke={fg} strokeWidth="1.5" />
      <circle cx="24" cy="24" r="19" fill="none" stroke={fg} strokeWidth="0.6" strokeDasharray="1.5 2" />
      <text x="24" y="30.5" textAnchor="middle" fontFamily="Cormorant Garamond, Georgia, serif" fontWeight="700" fontSize="19" fill={fg}>DB</text>
    </svg>
  );
}

export default function Logo({ inverse = false, size = 40 }) {
  return (
    <span className="brand">
      <LogoMark size={size} inverse={inverse} />
      <span className="brand-word">
        <b>DAYBREAK</b>
        <small>Collectibles</small>
      </span>
    </span>
  );
}
