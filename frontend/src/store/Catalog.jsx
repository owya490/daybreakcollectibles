import { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDB, listings } from '../data/db.js';
import { Drawer, Empty } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import ProductTile, { matches, isNew } from './ProductTile.jsx';
import { useShop } from './shop.jsx';
import { TYPE_LABEL, cls } from '../lib/util.js';

const FACETS = {
  slab: [['pokemon', 'Pokémon'], ['grade', 'PSA grade'], ['language', 'Language'], ['set', 'Set'], ['era', 'Release era'], ['rarity', 'Rarity']],
  single: [['pokemon', 'Pokémon'], ['language', 'Language'], ['set', 'Set'], ['rarity', 'Rarity'], ['condition', 'Condition'], ['variant', 'Variant']],
  sealed: [['productType', 'Product type'], ['language', 'Language'], ['set', 'Set'], ['releaseYear', 'Release year'], ['condition', 'Condition']],
  guard: [['design', 'Design'], ['artwork', 'Artwork'], ['colour', 'Colour'], ['style', 'Style']],
  all: [['type', 'Category'], ['language', 'Language'], ['set', 'Set'], ['pokemon', 'Pokémon']],
};
const PRICE_PRESETS = [['Under $50', 0, 50], ['$50 to $200', 50, 200], ['$200 to $500', 200, 500], ['$500 to $1,000', 500, 1000], ['$1,000+', 1000, null]];
const TITLES = { slab: ['PSA Slabs', 'Graded Pokémon cards in PSA holders. Each slab is individually listed with its certification number.'], single: ['Singles', 'Raw cards across Japanese, Korean, Chinese and English prints.'], sealed: ['Sealed Products', 'Booster boxes, Elite Trainer Boxes and bundles.'], guard: ['Extended Art Guards', 'Daybreak Originals. Let the artwork run past the PSA label.'] };
const MODE_TITLES = { new: ['New Arrivals', 'Added to the case in the last 30 days.'], featured: ['Featured', 'Hand-picked by the Daybreak team.'], sold: ['Recently Sold', 'A record of cards that found new homes. Similar pieces come through often.'], search: ['Search', ''], wishlist: ['Wishlist', 'Saved on this device.'] };

const val = (l, key) => (key === 'type' ? TYPE_LABEL[l.type] : key === 'grade' ? (l.grade ? `PSA ${l.grade}` : '') : l[key] ? String(l[key]) : '');

export default function Catalog({ type, mode }) {
  const s = useDB();
  const shop = useShop();
  const [sp, setSp] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(24);
  const q = sp.get('q') || '';
  const sort = sp.get('sort') || (mode === 'sold' ? 'sold' : 'newest');
  const availability = sp.get('availability') || (mode === 'sold' ? 'sold' : 'in');
  const min = sp.get('min') ? Number(sp.get('min')) : null;
  const max = sp.get('max') ? Number(sp.get('max')) : null;
  const facetDefs = FACETS[type || 'all'];
  useEffect(() => setLimit(24), [sp, type, mode]);

  // Base set before facet filters
  const base = useMemo(() => {
    let xs = listings(s, { includeSold: true });
    if (type) xs = xs.filter((l) => l.type === type);
    if (mode === 'new') xs = xs.filter((l) => isNew(l, 30));
    if (mode === 'featured') xs = xs.filter((l) => l.featured);
    if (mode === 'wishlist') xs = xs.filter((l) => shop.wish.includes(l.unitId));
    if (q) xs = xs.filter((l) => matches(l, q));
    return xs;
  }, [s, type, mode, q, shop.wish]);

  const selected = (key) => sp.getAll(key);
  const passAvail = (l) => (availability === 'all' ? true : availability === 'sold' ? l.status === 'sold' || l.available <= 0 : l.status !== 'sold' && l.available > 0);
  const passPrice = (l) => (min === null || l.ask >= min) && (max === null || l.ask < max);
  const passFacets = (l, except) => facetDefs.every(([key]) => {
    if (key === except) return true;
    const sel = selected(key);
    if (key === 'grade' && sel.includes('PSA 8')) return sel.some((g) => g === val(l, key)) || (Number(l.grade) <= 8);
    return !sel.length || sel.includes(val(l, key));
  });

  const results = useMemo(() => {
    const xs = base.filter((l) => passAvail(l) && passPrice(l) && passFacets(l));
    const by = {
      newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      'price-asc': (a, b) => a.ask - b.ask,
      'price-desc': (a, b) => b.ask - a.ask,
      grade: (a, b) => (Number(b.grade) || 0) - (Number(a.grade) || 0),
      sold: (a, b) => new Date(b.soldAt || b.updatedAt) - new Date(a.soldAt || a.updatedAt),
      name: (a, b) => a.name.localeCompare(b.name),
    }[sort] || (() => 0);
    return [...xs].sort(by);
  }, [base, sp]);

  const counts = useMemo(() => {
    const out = {};
    for (const [key] of facetDefs) {
      const m = new Map();
      for (const l of base) {
        if (!passAvail(l) || !passPrice(l) || !passFacets(l, key)) continue;
        const v = val(l, key);
        if (v) m.set(v, (m.get(v) || 0) + 1);
      }
      out[key] = [...m.entries()].sort((a, b) => (key === 'grade' ? b[0].localeCompare(a[0], undefined, { numeric: true }) : b[1] - a[1] || a[0].localeCompare(b[0])));
    }
    return out;
  }, [base, sp]);

  const toggle = (key, v) => {
    const next = new URLSearchParams(sp);
    const cur = next.getAll(key);
    next.delete(key);
    (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).forEach((x) => next.append(key, x));
    setSp(next, { replace: true });
  };
  const setParam = (key, v) => { const next = new URLSearchParams(sp); if (v === null || v === '' || v === undefined) next.delete(key); else next.set(key, v); setSp(next, { replace: true }); };
  const setPrice = (a, b) => { const next = new URLSearchParams(sp); a === null ? next.delete('min') : next.set('min', a); b === null ? next.delete('max') : next.set('max', b); next.delete('budget'); setSp(next, { replace: true }); };
  const clearAll = () => setSp(q ? { q } : {}, { replace: true });

  const [title, sub] = mode ? MODE_TITLES[mode] : TITLES[type] || ['Shop all', 'Everything currently in the Daybreak case.'];
  const activeChips = [
    ...facetDefs.flatMap(([key]) => selected(key).map((v) => ({ key, v, label: v }))),
    ...(min !== null || max !== null ? [{ key: 'price', label: max === null ? `$${min}+` : `$${min || 0} to $${max}` }] : []),
  ];
  const availCounts = { in: base.filter((l) => l.status !== 'sold' && l.available > 0).length, sold: base.filter((l) => l.status === 'sold' || l.available <= 0).length };

  const filterPanel = (
    <>
      <div className="facet">
        <h6>Sort by</h6>
        <div className="chips">
          {[['newest', 'Newest'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'], ...(type === 'slab' ? [['grade', 'Grade']] : []), ['name', 'Name']].map(([k, l]) => (
            <button key={k} className={cls('chip', sort === k && 'on')} onClick={() => setParam('sort', k === 'newest' ? null : k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="facet">
        <h6>Price (AUD)</h6>
        <div className="chips">
          <button className={cls('chip', min === null && max === null && 'on')} onClick={() => setPrice(null, null)}>Any price</button>
          {PRICE_PRESETS.map(([l, a, b]) => {
            const n = base.filter((x) => passAvail(x) && passFacets(x) && x.ask >= a && (b === null || x.ask < b)).length;
            return <button key={l} className={cls('chip', min === a && max === b && 'on')} onClick={() => setPrice(a, b)}>{l} <span className="n">{n}</span></button>;
          })}
        </div>
        <PriceRange min={min} max={max} onApply={setPrice} />
      </div>
      <div className="facet">
        <h6>Availability</h6>
        <div className="chips">
          <button className={cls('chip', availability === 'in' && 'on')} onClick={() => setParam('availability', null)}>In stock <span className="n">{availCounts.in}</span></button>
          <button className={cls('chip', availability === 'sold' && 'on')} onClick={() => setParam('availability', 'sold')}>Sold <span className="n">{availCounts.sold}</span></button>
          <button className={cls('chip', availability === 'all' && 'on')} onClick={() => setParam('availability', 'all')}>All</button>
        </div>
      </div>
      {facetDefs.map(([key, label]) => counts[key]?.length > 0 && (
        <div className="facet" key={key}>
          <h6>{label}</h6>
          <div className="chips">
            {counts[key].slice(0, 30).map(([v, n]) => <button key={v} className={cls('chip', selected(key).includes(v) && 'on')} onClick={() => toggle(key, v)}>{v} <span className="n">{n}</span></button>)}
          </div>
        </div>
      ))}
    </>
  );

  return (
    <div className="wrap" style={{ paddingBottom: 120 }}>
      <div className="cat-head">
        <div>
          <div className="crumbs"><Link to="/">Home</Link><span>/</span><span>{title}</span></div>
          <h1>{mode === 'search' ? (q ? `“${q}”` : 'Search') : title}</h1>
          {(sub || mode === 'search') && <p className="muted" style={{ marginTop: 6, maxWidth: 620 }}>{mode === 'search' ? `${results.length} result${results.length === 1 ? '' : 's'} across slabs, singles, sealed and guards.` : sub}</p>}
        </div>
      </div>
      <div className="toolbar">
        <button className="btn secondary sm" onClick={() => setOpen(true)}><Icon name="filter" size={16} /> Filter & sort{activeChips.length > 0 && <span className="badge solid" style={{ height: 18 }}>{activeChips.length}</span>}</button>
        <select className="select" style={{ width: 'auto', height: 32, fontSize: 13 }} value={sort} onChange={(e) => setParam('sort', e.target.value === 'newest' ? null : e.target.value)} aria-label="Sort">
          <option value="newest">Recently added</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option>
          {type === 'slab' && <option value="grade">Grade: high to low</option>}<option value="name">Name A to Z</option>{mode === 'sold' && <option value="sold">Recently sold</option>}
        </select>
        <div className="active-filters">
          {activeChips.map((c) => <button key={c.key + c.label} className="chip" onClick={() => (c.key === 'price' ? setPrice(null, null) : toggle(c.key, c.v))}>{c.label} <Icon name="x" size={12} /></button>)}
          {activeChips.length > 0 && <button className="btn ghost sm" onClick={clearAll}>Clear all</button>}
        </div>
        <span className="muted small" style={{ marginLeft: 'auto' }}>{results.length} item{results.length === 1 ? '' : 's'}</span>
      </div>
      {sp.get('budget') && (
        <div className="row wrap" style={{ marginBottom: 16 }}>{PRICE_PRESETS.map(([l, a, b]) => <button key={l} className="chip" onClick={() => setPrice(a, b)}>{l}</button>)}</div>
      )}
      {results.length === 0 ? (
        <Empty title={mode === 'wishlist' ? 'Nothing saved yet' : 'Nothing matches just yet'} action={<button className="btn secondary" onClick={clearAll}>Clear filters</button>}>
          {mode === 'wishlist' ? 'Tap the heart on any card to keep it here.' : 'Try fewer filters, or check back soon. New stock lands after every show.'}
        </Empty>
      ) : (
        <>
          <div className="pgrid">{results.slice(0, limit).map((l) => <ProductTile key={l.unitId} l={l} />)}</div>
          {results.length > limit && <div className="center" style={{ marginTop: 28 }}><button className="btn secondary lg" onClick={() => setLimit((n) => n + 24)}>Show more ({results.length - limit} remaining)</button></div>}
        </>
      )}
      {open && (
        <Drawer title="Filters" onClose={() => setOpen(false)} footer={<button className="btn lg block" onClick={() => setOpen(false)}>Show {results.length} item{results.length === 1 ? '' : 's'}</button>}>
          {filterPanel}
        </Drawer>
      )}
    </div>
  );
}

function PriceRange({ min, max, onApply }) {
  const [a, setA] = useState(min ?? '');
  const [b, setB] = useState(max ?? '');
  useEffect(() => { setA(min ?? ''); setB(max ?? ''); }, [min, max]);
  return (
    <form className="price-range" onSubmit={(e) => { e.preventDefault(); onApply(a === '' ? null : Number(a), b === '' ? null : Number(b)); }}>
      <input className="input" inputMode="numeric" placeholder="Min" value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ''))} aria-label="Minimum price" />
      <span className="muted">to</span>
      <input className="input" inputMode="numeric" placeholder="Max" value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, ''))} aria-label="Maximum price" />
      <button className="btn sm secondary">Apply</button>
    </form>
  );
}
