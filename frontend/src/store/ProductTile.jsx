import { Link } from 'react-router-dom';
import { ProductImage } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { useShop } from './shop.jsx';
import { aud, cls, CONDITIONS, LANG_SHORT } from '../lib/util.js';

export const isNew = (l, days = 14) => Date.now() - new Date(l.createdAt).getTime() < days * 86400000;

export function metaLine(l) {
  if (l.type === 'guard') return [l.design, l.colour].filter(Boolean).join(' · ');
  if (l.type === 'sealed') return [l.productType, l.set].filter(Boolean).join(' · ');
  return [l.set, l.number].filter(Boolean).join(' · ');
}

export function searchText(l) {
  return [l.name, l.pokemon, l.set, l.setCode, l.number, l.cert, l.sku, l.language, l.variant, l.rarity, l.productType, l.design, l.artwork, l.colour, l.grade && `psa ${l.grade}`].filter(Boolean).join(' ').toLowerCase();
}
export function matches(l, q) {
  if (!q) return true;
  const hay = searchText(l);
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w) || hay.includes(w.replace(/^0+/, '')));
}

export default function ProductTile({ l }) {
  const shop = useShop();
  const sold = l.status === 'sold' || l.available <= 0;
  const wished = shop.wish.includes(l.unitId);
  const right = l.type === 'slab' ? `PSA ${l.grade}` : l.type === 'single' ? (CONDITIONS.includes(l.condition) ? l.condition : l.condition) : sold ? '' : l.available > 1 ? `${l.available} available` : 'Last one';
  return (
    <Link to={`/item/${l.unitId}`} className={cls('ptile', sold && 'sold')}>
      <div className="well">
        <ProductImage product={l} compact />
        <div className="tl">
          {sold && <span className="badge">Sold</span>}
          {!sold && isNew(l) && <span className="badge red">New</span>}
        </div>
        <div className={cls('tr', wished && 'on')}>
          <button className={cls('wish', wished && 'on')} aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'} onClick={(e) => { e.preventDefault(); shop.toggleWish(l.unitId); }}>
            <Icon name="heart" size={16} stroke={wished ? 0 : 1.4} style={wished ? { fill: 'currentColor' } : undefined} />
          </button>
        </div>
      </div>
      <div className="cap">
        <div className="meta truncate">{metaLine(l) || 'Daybreak'}{l.language && l.type !== 'guard' ? ` · ${LANG_SHORT[l.language] || l.language}` : ''}</div>
        <div className="nm">{l.name}</div>
        <div className="pr"><span className="price">{aud(l.ask)}</span>{right && <span className="cond">{right}</span>}</div>
      </div>
    </Link>
  );
}
