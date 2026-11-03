import { Link } from 'react-router-dom';
import { ProductImage } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { useShop } from './shop.jsx';
import { aud, cls, COND_SHORT, LANG_SHORT } from '../lib/util.js';

export const isNew = (l, days = 14) => Date.now() - new Date(l.createdAt).getTime() < days * 86400000;

export function metaLine(l) {
  if (l.type === 'guard') return [l.design, l.colour].filter(Boolean).join(' · ');
  if (l.type === 'sealed') return [l.productType, l.set].filter(Boolean).join(' · ');
  return [l.set, l.number].filter(Boolean).join(' · ');
}

export function searchText(l) {
  return [l.name, l.pokemon, l.set, l.setCode, l.number, l.cert, l.sku, l.language, l.variant, l.rarity, l.productType, l.design, l.artwork, l.colour].filter(Boolean).join(' ').toLowerCase();
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
  return (
    <Link to={`/item/${l.unitId}`} className={cls('ptile', sold && 'sold')}>
      <ProductImage product={l} compact />
      <div className="tl">
        {l.demo && <span className="badge dark">Sample</span>}
        {!sold && isNew(l) && <span className="badge red">New</span>}
        {sold && <span className="badge dark">Sold</span>}
      </div>
      <div className="tr">
        <button className={cls('wish', wished && 'on')} aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'} onClick={(e) => { e.preventDefault(); shop.toggleWish(l.unitId); }}>
          <Icon name="heart" size={17} stroke={wished ? 0 : 1.8} style={wished ? { fill: 'currentColor' } : undefined} />
        </button>
      </div>
      <div className="over">
        <div className="nm">{l.name}</div>
        <div className="meta">{metaLine(l)}{l.language && l.type !== 'guard' ? ` · ${LANG_SHORT[l.language] || l.language}` : ''}</div>
        <div className="row between" style={{ marginTop: 4 }}>
          <div className="price">{aud(l.ask)}</div>
          <span className="badge cream">
            {l.type === 'slab' ? `PSA ${l.grade}` : l.type === 'single' ? (COND_SHORT[l.condition] || l.condition) : sold ? 'Sold out' : l.available > 1 ? `${l.available} in stock` : 'Last one'}
          </span>
        </div>
      </div>
    </Link>
  );
}
