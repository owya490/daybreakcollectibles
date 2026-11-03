import { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDB, productById, locationPath, updateUnits, availableQty, addInventory, findDuplicateProduct, findCert, getState } from '../data/db.js';
import { ProductImage, Modal, useToast, useConfirm, Field, MoneyInput, Empty } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import UnitEditor from './UnitEditor.jsx';
import { LocationSelect, MarketBadge } from './common.jsx';
import { suggestAsk, roundPrice } from '../services/pricing.js';
import { aud, cls, TYPE_LABEL, toCSV, parseCSV, download, num, fmtDate, COND_SHORT, LANGUAGES } from '../lib/util.js';

export function exportInventoryCSV(rows, s) {
  const csv = toCSV(rows, [
    { label: 'SKU', get: (r) => r.sku }, { label: 'Type', get: (r) => TYPE_LABEL[r.type] }, { label: 'Product', get: (r) => r.name }, { label: 'Pokemon', get: (r) => r.pokemon },
    { label: 'Set', get: (r) => r.set }, { label: 'Number', get: (r) => r.number }, { label: 'Language', get: (r) => r.language }, { label: 'Variant', get: (r) => r.variant },
    { label: 'Condition', get: (r) => r.condition }, { label: 'PSA Grade', get: (r) => r.grade }, { label: 'PSA Cert', get: (r) => r.cert }, { label: 'Cert Verified', get: (r) => (r.certVerified ? 'yes' : 'no') },
    { label: 'Quantity', get: (r) => r.qty }, { label: 'Cost (AUD)', get: (r) => r.cost }, { label: 'Asking (AUD)', get: (r) => r.ask }, { label: 'Market (AUD)', get: (r) => r.market?.aud ?? '' },
    { label: 'Market Source', get: (r) => r.market?.source ?? '' }, { label: 'Location', get: (r) => locationPath(s, r.locationId) }, { label: 'Date Acquired', get: (r) => (r.acquiredAt || '').slice(0, 10) },
    { label: 'Status', get: (r) => r.status }, { label: 'Published', get: (r) => (r.published ? 'yes' : 'no') },
  ]);
  download(`daybreak-inventory-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
}

export default function Inventory() {
  const s = useDB();
  const toast = useToast();
  const confirm = useConfirm();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  const [type, setType] = useState(sp.get('type') || '');
  const [status, setStatus] = useState('in');
  const [loc, setLoc] = useState('');
  const [pub, setPub] = useState('');
  const [lang, setLang] = useState('');
  const [sort, setSort] = useState('new');
  const [sel, setSel] = useState([]);
  const [edit, setEdit] = useState(null);
  const [bulk, setBulk] = useState(null);
  const [importing, setImporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [limit, setLimit] = useState(100);
  useEffect(() => { setQ(sp.get('q') || ''); }, [sp]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const locIds = loc ? new Set([loc, ...descendants(s, loc)]) : null;
    let xs = s.units.map((u) => ({ ...productById(s, u.productId), ...u, unitId: u.id, avail: availableQty(u) })).filter((r) => r.name);
    xs = xs.filter((r) => (status === 'in' ? r.status === 'available' && r.qty > 0 : status === 'all' ? r.status !== 'archived' : r.status === status)
      && (!type || r.type === type) && (!locIds || locIds.has(r.locationId)) && (!pub || (pub === 'yes') === !!r.published) && (!lang || r.language === lang)
      && (!t || [r.name, r.sku, r.cert, r.set, r.number, r.pokemon, r.notes].filter(Boolean).join(' ').toLowerCase().includes(t)));
    const by = { new: (a, b) => new Date(b.createdAt) - new Date(a.createdAt), name: (a, b) => a.name.localeCompare(b.name), 'ask-desc': (a, b) => b.ask - a.ask, 'ask-asc': (a, b) => a.ask - b.ask, margin: (a, b) => (b.ask - b.cost) - (a.ask - a.cost), loc: (a, b) => locationPath(s, a.locationId).localeCompare(locationPath(s, b.locationId)), old: (a, b) => new Date(a.acquiredAt) - new Date(b.acquiredAt) }[sort];
    return xs.sort(by);
  }, [s, q, type, status, loc, pub, lang, sort]);

  const totals = rows.reduce((a, r) => ({ qty: a.qty + r.qty, ask: a.ask + r.ask * r.qty, cost: a.cost + r.cost * r.qty }), { qty: 0, ask: 0, cost: 0 });
  const allSel = rows.length > 0 && rows.slice(0, limit).every((r) => sel.includes(r.unitId));
  const toggle = (id) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const dupCerts = useMemo(() => { const m = {}; s.units.forEach((u) => { if (u.cert && u.status !== 'archived') m[u.cert] = (m[u.cert] || 0) + 1; }); return Object.keys(m).filter((k) => m[k] > 1); }, [s]);

  return (
    <>
      <div className="page-head">
        <div><h1>Inventory</h1><p>{rows.length} records · {totals.qty} units · {aud(totals.ask, { round: true })} at asking · {aud(totals.cost, { round: true })} cost</p></div>
        <div className="row wrap">
          <button className="btn secondary" onClick={() => setImporting(true)}><Icon name="upload" size={16} />Import CSV</button>
          <button className="btn secondary" onClick={() => exportInventoryCSV(rows, s)}><Icon name="download" size={16} />CSV</button>
          <button className="btn secondary" onClick={() => { setPrinting(true); setTimeout(() => { window.print(); setPrinting(false); }, 200); }}><Icon name="printer" size={16} />PDF</button>
          <Link to="/admin/inventory/new" className="btn"><Icon name="plus" size={16} />Add</Link>
        </div>
      </div>
      {dupCerts.length > 0 && <div className="notice danger" style={{ marginBottom: 12 }}>Duplicate PSA cert numbers detected: {dupCerts.join(', ')}. Search for them and archive the double-counted record.</div>}
      <div className="filters-bar">
        <input className="input search" placeholder="Search name, SKU, cert, set, number" value={q} onChange={(e) => { setQ(e.target.value); setSp(e.target.value ? { q: e.target.value } : {}, { replace: true }); }} />
        <select className="select" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="in">In stock</option><option value="sold">Sold</option><option value="archived">Archived</option><option value="all">All (not archived)</option></select>
        <div style={{ minWidth: 160, flex: "1 1 160px", maxWidth: 240 }}><LocationSelect value={loc} onChange={(v) => setLoc(v || '')} /></div>
        <select className="select" value={pub} onChange={(e) => setPub(e.target.value)}><option value="">Online: any</option><option value="yes">Published</option><option value="no">Unpublished</option></select>
        <select className="select" value={lang} onChange={(e) => setLang(e.target.value)}><option value="">All languages</option>{LANGUAGES.map((l) => <option key={l}>{l}</option>)}</select>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}><option value="new">Newest</option><option value="old">Oldest acquired</option><option value="name">Name</option><option value="ask-desc">Price high-low</option><option value="ask-asc">Price low-high</option><option value="margin">Margin</option><option value="loc">Location</option></select>
      </div>
      {sel.length > 0 && (
        <div className="bulkbar">
          <b>{sel.length} selected</b>
          <button className="btn secondary sm" onClick={() => setBulk('price')}>Edit prices</button>
          <button className="btn secondary sm" onClick={() => setBulk('move')}>Move location</button>
          <button className="btn secondary sm" onClick={() => { updateUnits(sel, { published: true }, 'bulk.publish'); toast(`${sel.length} published`); }}>Publish</button>
          <button className="btn secondary sm" onClick={() => { updateUnits(sel, { published: false }, 'bulk.unpublish'); toast(`${sel.length} unpublished`); }}>Unpublish</button>
          <button className="btn secondary sm" onClick={() => { updateUnits(sel, { labelPrintedAt: null }, 'bulk.label-queue'); toast('Queued for label printing'); }}>Queue labels</button>
          <button className="btn secondary sm" onClick={async () => { if (await confirm({ title: `Archive ${sel.length} items?`, body: 'Archived items leave the storefront and stock totals. History is kept.', ok: 'Archive', danger: true })) { updateUnits(sel, { status: 'archived', published: false }, 'bulk.archive'); setSel([]); toast('Archived'); } }}>Archive</button>
          <button className="btn ghost sm" style={{ color: '#fff', marginLeft: 'auto' }} onClick={() => setSel([])}>Clear</button>
        </div>
      )}
      {rows.length === 0 ? <Empty title="No stock matches" action={<Link to="/admin/scan" className="btn">Scan a card</Link>}>Change the filters, or add something new.</Empty> : (<>
        <div className="table-wrap responsive">
          <table className="t">
            <thead><tr>
              <th style={{ width: 30 }}><input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? [] : rows.slice(0, limit).map((r) => r.unitId))} aria-label="Select all" /></th>
              <th></th><th>Item</th><th>Type</th><th>Grade / cond.</th><th>Language</th><th className="num">Qty</th><th className="num">Cost</th><th className="num">Asking</th><th>Market</th><th>Location</th><th>Online</th>
            </tr></thead>
            <tbody>{rows.slice(0, limit).map((r) => (
              <tr key={r.unitId} className={cls('click', sel.includes(r.unitId) && 'sel')} onClick={() => setEdit(r.unitId)}>
                <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.includes(r.unitId)} onChange={() => toggle(r.unitId)} aria-label={`Select ${r.sku}`} /></td>
                <td><div className="thumb-sm"><ProductImage product={r} compact /></div></td>
                <td><div className="cell-title">{r.name}</div><div className="cell-sub">{r.sku} · {[r.set, r.number].filter(Boolean).join(' · ')}{r.demo ? ' · sample' : ''}</div></td>
                <td><span className="badge grey">{TYPE_LABEL[r.type]}</span></td>
                <td>{r.type === 'slab' ? <span className="badge solid">PSA {r.grade}</span> : COND_SHORT[r.condition] || r.condition}{r.cert && <div className="cell-sub">{r.cert} {r.certVerified ? '✓' : ''}</div>}</td>
                <td className="small">{r.language || '-'}</td>
                <td className="num">{r.qty}{r.avail < r.qty && r.status === 'available' ? <div className="cell-sub">{r.qty - r.avail} held</div> : null}</td>
                <td className="num">{aud(r.cost)}</td>
                <td className="num"><b>{aud(r.ask)}</b></td>
                <td><MarketBadge market={r.market} /></td>
                <td className="small">{locationPath(s, r.locationId)}</td>
                <td>{r.published ? <span className="badge green">Live</span> : <span className="badge grey">Hidden</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="inv-cards">
          {rows.slice(0, limit).map((r) => (
            <div key={r.unitId} className="inv-card" onClick={() => setEdit(r.unitId)}>
              <input type="checkbox" checked={sel.includes(r.unitId)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(r.unitId)} aria-label={`Select ${r.sku}`} style={{ width: 20, height: 20 }} />
              <ProductImage product={r} compact />
              <div style={{ minWidth: 0 }}><div className="cell-title truncate">{r.name}</div><div className="cell-sub truncate">{r.type === 'slab' ? `PSA ${r.grade}` : COND_SHORT[r.condition] || r.condition} · {r.sku} · ×{r.qty}</div><div className="cell-sub truncate">{locationPath(s, r.locationId)}</div></div>
              <div className="right"><b>{aud(r.ask)}</b><div className="cell-sub">cost {aud(r.cost)}</div>{!r.published && <span className="badge grey">Hidden</span>}</div>
            </div>
          ))}
        </div>
        {rows.length > limit && <div className="center" style={{ marginTop: 14 }}><button className="btn secondary" onClick={() => setLimit((n) => n + 100)}>Show more ({rows.length - limit})</button></div>}
      </>)}
      {edit && <UnitEditor unitId={edit} onClose={() => setEdit(null)} />}
      {bulk === 'price' && <BulkPrice ids={sel} onClose={() => setBulk(null)} />}
      {bulk === 'move' && <BulkMove ids={sel} onClose={() => { setBulk(null); setSel([]); }} />}
      {importing && <ImportCSV onClose={() => setImporting(false)} />}
      {printing && (
        <div className="print-area doc print-only">
          <h2 className="serif" style={{ color: '#00009E' }}>Daybreak Collectibles · Inventory report · {fmtDate(new Date().toISOString())}</h2>
          <p>{rows.length} records · {totals.qty} units · {aud(totals.ask)} at asking · {aud(totals.cost)} at cost</p>
          <table className="t"><thead><tr><th>SKU</th><th>Item</th><th>Grade/Cond</th><th>Location</th><th className="num">Qty</th><th className="num">Cost</th><th className="num">Asking</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.unitId}><td>{r.sku}</td><td>{r.name}<br /><small>{r.set} {r.number}</small></td><td>{r.grade ? `PSA ${r.grade}` : r.condition}</td><td>{locationPath(s, r.locationId)}</td><td className="num">{r.qty}</td><td className="num">{aud(r.cost)}</td><td className="num">{aud(r.ask)}</td></tr>)}</tbody></table>
        </div>
      )}
    </>
  );
}

export function descendants(s, id) {
  const out = [];
  const walk = (pid) => s.locations.filter((l) => l.parentId === pid).forEach((l) => { out.push(l.id); walk(l.id); });
  walk(id);
  return out;
}

function BulkPrice({ ids, onClose }) {
  const s = useDB();
  const toast = useToast();
  const [mode, setMode] = useState('percent');
  const [v, setV] = useState('');
  const units = s.units.filter((u) => ids.includes(u.id));
  const compute = (u) => {
    if (mode === 'set') return num(v);
    if (mode === 'percent') return roundPrice(u.ask * (1 + num(v) / 100), s.settings.pricing.rounding);
    if (mode === 'fixed') return roundPrice(u.ask + num(v), s.settings.pricing.rounding);
    if (mode === 'rule') return u.market?.aud != null ? suggestAsk(u.market.aud) : u.ask;
    return u.ask;
  };
  const skipped = mode === 'rule' ? units.filter((u) => u.market?.aud == null).length : 0;
  return (
    <Modal title={`Edit prices for ${ids.length} items`} onClose={onClose}>
      <div className="stack">
        <div className="pickers">{[['percent', '% change'], ['fixed', '$ change'], ['set', 'Set price'], ['rule', 'Apply pricing rule']].map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>)}</div>
        {mode !== 'rule' ? <Field label={mode === 'percent' ? 'Percent (e.g. -10 for 10% off)' : mode === 'fixed' ? 'Amount to add (negative to reduce)' : 'New asking price'}><input className="input" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} autoFocus /></Field>
          : <div className="notice small">Uses each item's stored market reference and your rule in Pricing settings. {skipped > 0 && `${skipped} item(s) have no market data and keep their price.`}</div>}
        <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}><table className="t"><tbody>{units.slice(0, 50).map((u) => <tr key={u.id}><td className="small">{productById(s, u.productId)?.name}</td><td className="num muted">{aud(u.ask)}</td><td className="num"><b>{aud(compute(u))}</b></td></tr>)}</tbody></table></div>
        <div className="row end"><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" disabled={mode !== 'rule' && v === ''} onClick={() => { updateUnits(ids, (u) => ({ ask: compute(u), labelPrintedAt: null }), 'bulk.price'); toast('Prices updated and queued for new labels'); onClose(); }}>Apply</button></div>
      </div>
    </Modal>
  );
}

function BulkMove({ ids, onClose }) {
  const toast = useToast();
  const [loc, setLoc] = useState(null);
  return (
    <Modal title={`Move ${ids.length} items`} onClose={onClose} width={420}>
      <div className="stack"><Field label="New location"><LocationSelect value={loc} onChange={setLoc} /></Field>
        <div className="row end"><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" onClick={() => { updateUnits(ids, { locationId: loc }, 'bulk.move'); toast('Moved'); onClose(); }}>Move</button></div></div>
    </Modal>
  );
}

// ---------- CSV / Collectr import with duplicate detection ----------
const FIELDS = [
  ['name', 'Product / card name', ['product name', 'name', 'card name', 'card', 'title', 'product']],
  ['set', 'Set', ['set', 'set name', 'expansion']],
  ['number', 'Card number', ['card number', 'number', 'no', 'collector number', '#']],
  ['language', 'Language', ['language', 'lang']],
  ['rarity', 'Rarity', ['rarity']],
  ['variant', 'Variant', ['variance', 'variant', 'printing', 'finish']],
  ['condition', 'Condition', ['card condition', 'condition']],
  ['grade', 'Grade', ['grade', 'psa grade', 'graded']],
  ['cert', 'PSA cert', ['cert', 'cert number', 'certification', 'psa cert']],
  ['qty', 'Quantity', ['quantity', 'qty', 'count']],
  ['cost', 'Cost paid (each)', ['average cost paid', 'cost', 'price paid', 'purchase price', 'cost paid']],
  ['market', 'Market price', ['market price', 'market', 'market value']],
  ['ask', 'Asking price', ['price override', 'asking', 'asking price', 'sell price', 'list price']],
  ['category', 'Category / type', ['category', 'type', 'product type']],
];
function guess(headers, aliases) { const h = headers.map((x) => x.toLowerCase()); for (const a of aliases) { const i = h.indexOf(a); if (i >= 0) return headers[i]; } for (const a of aliases) { const i = h.findIndex((x) => x.includes(a)); if (i >= 0) return headers[i]; } return ''; }
const COND_MAP = { nm: 'Near Mint', 'near mint': 'Near Mint', mint: 'Near Mint', lp: 'Lightly Played', 'lightly played': 'Lightly Played', mp: 'Moderately Played', 'moderately played': 'Moderately Played', hp: 'Heavily Played', 'heavily played': 'Heavily Played', dmg: 'Damaged', damaged: 'Damaged' };

function ImportCSV({ onClose }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [map, setMap] = useState({});
  const [dupMode, setDupMode] = useState('skip');
  const [defaults, setDefaults] = useState({ language: 'English', publish: false, location: null, marketCurrency: 'USD' });
  const onFile = async (f) => {
    const parsed = parseCSV(await f.text());
    if (!parsed.headers.length) return toast('That file has no rows', 'err');
    setData(parsed);
    setMap(Object.fromEntries(FIELDS.map(([k, , al]) => [k, guess(parsed.headers, al)])));
  };
  const s = getState();
  const rows = useMemo(() => {
    if (!data) return [];
    return data.rows.map((r) => {
      const g = (k) => (map[k] ? r[map[k]] : '');
      const grade = String(g('grade') || '').replace(/^PSA\s*/i, '').trim();
      const cat = String(g('category') || '').toLowerCase();
      const type = grade && !/raw|ungraded/i.test(grade) ? 'slab' : cat.includes('sealed') ? 'sealed' : 'single';
      const product = { type, name: g('name'), set: g('set'), number: g('number'), language: g('language') || defaults.language, rarity: g('rarity'), variant: g('variant'), pokemon: (g('name') || '').split(' ')[0] };
      const mRaw = num(g('market'));
      const fx = defaults.marketCurrency === 'USD' ? s.settings.fx.usdAud : 1;
      const market = mRaw ? { value: mRaw, currency: defaults.marketCurrency, aud: Math.round(mRaw * fx * 100) / 100, source: 'Imported CSV (not live)', updatedAt: new Date().toISOString(), stale: true, fxRate: fx } : null;
      const unit = { condition: type === 'single' ? COND_MAP[String(g('condition')).toLowerCase()] || 'Near Mint' : type === 'sealed' ? 'Factory Sealed' : '', grade: type === 'slab' ? grade : '', cert: g('cert'), qty: type === 'slab' ? 1 : Math.max(1, parseInt(g('qty'), 10) || 1), cost: num(g('cost')), ask: num(g('ask')) || (market ? suggestAsk(market.aud) || 0 : 0), market, published: defaults.publish, locationId: defaults.location };
      const certDup = unit.cert && findCert(s, unit.cert);
      const prodDup = findDuplicateProduct(s, product);
      return { product, unit, certDup, prodDup, valid: !!product.name };
    });
  }, [data, map, defaults]);
  const run = () => {
    let added = 0, skipped = 0;
    for (const r of rows) {
      if (!r.valid || r.certDup) { skipped++; continue; }
      if (r.prodDup && dupMode === 'skip') { skipped++; continue; }
      const qtyCount = r.product.type === 'slab' ? (parseInt(r.unit.qty, 10) || 1) : 1;
      try { addInventory({ product: r.product, units: Array.from({ length: qtyCount }, () => ({ ...r.unit })), reuseProductId: r.prodDup?.id }); added++; } catch { skipped++; }
    }
    toast(`Imported ${added} rows${skipped ? `, skipped ${skipped}` : ''}`);
    onClose();
  };
  return (
    <Modal title="Import inventory from CSV" onClose={onClose} width={900}>
      {!data ? (
        <div className="stack">
          <p className="muted small">Works with Collectr portfolio exports and most spreadsheets. Columns are matched automatically and you can adjust the mapping. Every row is previewed and checked for duplicates before anything is saved.</p>
          <label className="btn lg" style={{ alignSelf: 'flex-start' }}><Icon name="upload" />Choose CSV file<input type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} /></label>
          <div className="notice small">Graded rows (with a grade) become individual PSA slab records. Market prices from the file are stored as a stale reference, not live pricing.</div>
        </div>
      ) : (
        <div className="stack">
          <div className="grid-4">{FIELDS.map(([k, l]) => <Field key={k} label={l}><select className="select" value={map[k] || ''} onChange={(e) => setMap({ ...map, [k]: e.target.value })}><option value="">(not mapped)</option>{data.headers.map((h) => <option key={h}>{h}</option>)}</select></Field>)}</div>
          <div className="grid-4">
            <Field label="Default language"><select className="select" value={defaults.language} onChange={(e) => setDefaults({ ...defaults, language: e.target.value })}>{LANGUAGES.map((l) => <option key={l}>{l}</option>)}</select></Field>
            <Field label="Market price currency"><select className="select" value={defaults.marketCurrency} onChange={(e) => setDefaults({ ...defaults, marketCurrency: e.target.value })}><option>USD</option><option>AUD</option></select></Field>
            <Field label="Location"><LocationSelect value={defaults.location} onChange={(v) => setDefaults({ ...defaults, location: v })} /></Field>
            <Field label="If product already exists"><select className="select" value={dupMode} onChange={(e) => setDupMode(e.target.value)}><option value="skip">Skip (avoid double-counting)</option><option value="add">Add as another copy</option></select></Field>
          </div>
          <label className="check"><input type="checkbox" checked={defaults.publish} onChange={(e) => setDefaults({ ...defaults, publish: e.target.checked })} /> Publish imported items to the storefront</label>
          <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table className="t"><thead><tr><th>Name</th><th>Set</th><th>No.</th><th>Type</th><th>Cond/Grade</th><th className="num">Qty</th><th className="num">Cost</th><th className="num">Ask</th><th>Check</th></tr></thead>
              <tbody>{rows.slice(0, 300).map((r, i) => <tr key={i}><td>{r.product.name || <span className="err">missing</span>}</td><td className="small">{r.product.set}</td><td className="small">{r.product.number}</td><td className="small">{TYPE_LABEL[r.product.type]}</td><td className="small">{r.unit.grade ? `PSA ${r.unit.grade}` : r.unit.condition}</td><td className="num">{r.unit.qty}</td><td className="num">{aud(r.unit.cost)}</td><td className="num">{aud(r.unit.ask)}</td>
                <td>{!r.valid ? <span className="badge red">Invalid</span> : r.certDup ? <span className="badge red">Cert exists</span> : r.prodDup ? <span className="badge amber">Already listed</span> : <span className="badge green">New</span>}</td></tr>)}</tbody></table>
          </div>
          <div className="row end"><span className="small muted grow">{rows.length} rows · {rows.filter((r) => r.prodDup || r.certDup).length} possible duplicates</span><button className="btn secondary" onClick={() => setData(null)}>Back</button><button className="btn" onClick={run}>Import</button></div>
        </div>
      )}
    </Modal>
  );
}
