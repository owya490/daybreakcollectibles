import { useMemo, useRef, useState } from 'react';
import { useDB, listings, fxToAud, locationPath, availableQty, productById } from '../data/db.js';
import { searchCards, bestPrice } from '../services/cardData.js';
import { suggestAsk, toMarketRef } from '../services/pricing.js';
import { Field, MoneyInput, ProductImage, useToast } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { aud, money, cls, LANGUAGES, CONDITIONS, SEALED_CONDITIONS, VARIANTS, RARITIES, ERAS, SEALED_TYPES, PSA_GRADES, COND_SHORT, fileToDataUrl, num, timeAgo } from '../lib/util.js';

export function eraFromYear(y) {
  if (!y) return '';
  if (y <= 2003) return 'WotC (1999-2003)';
  if (y <= 2007) return 'EX (2003-2007)';
  if (y <= 2010) return 'DP / Platinum';
  if (y <= 2013) return 'HGSS / BW';
  if (y <= 2016) return 'XY';
  if (y <= 2019) return 'Sun & Moon';
  if (y <= 2022) return 'Sword & Shield';
  if (y <= 2025) return 'Scarlet & Violet';
  return 'Mega Evolution';
}

/** Turn a provider candidate into a catalogue product draft. */
export function candidateToProduct(c, type = 'single') {
  const name = c.name;
  return {
    type, name, pokemon: name.replace(/\s+(ex|EX|GX|V|VMAX|VSTAR|δ|Lv\.X|BREAK|Prime|LEGEND)\b.*$/, '').replace(/^(Mega|Radiant|Shining|Dark|Light)\s+/, (m) => m).trim(),
    set: c.set, setCode: c.setCode, number: c.number, language: c.language, rarity: c.rarity, variant: '',
    releaseYear: c.releaseYear, era: eraFromYear(c.releaseYear),
    images: c.image ? [{ url: c.image, source: c.imageSource, attribution: 'Card image © The Pokémon Company / Nintendo / Creatures / GAME FREAK', retrievedAt: new Date().toISOString() }] : [],
    externalIds: { [c.provider]: c.providerId },
  };
}

export function MarketBadge({ market }) {
  if (!market) return <span className="badge grey">No market data</span>;
  const stale = market.stale || Date.now() - new Date(market.updatedAt).getTime() > 7 * 86400000;
  return (
    <span className={cls('badge', stale ? 'amber' : 'green')} title={`${market.source} · ${money(market.value, market.currency)} · FX ${market.fxRate ?? '-'} (${market.fxSource || 'manual'}) · ${timeAgo(market.updatedAt)}`}>
      {market.aud != null ? aud(market.aud) : money(market.value, market.currency)}{stale ? ' · stale' : ''}
    </span>
  );
}

/** Search card databases. onPick(candidate, priceRow|null). */
export function CardLookup({ onPick, initial = {}, compact, autoFocus }) {
  const s = useDB();
  const [q, setQ] = useState({ name: initial.name || '', number: initial.number || '', language: initial.language || 'English' });
  const [state, setState] = useState({ loading: false, candidates: null, errors: [] });
  const [sel, setSel] = useState(null);
  const run = async (e) => {
    e?.preventDefault();
    if (!q.name && !q.number) return;
    setState({ loading: true, candidates: null, errors: [] });
    try { const r = await searchCards(q); setState({ loading: false, ...r }); }
    catch (err) { setState({ loading: false, candidates: [], errors: [err.message] }); }
  };
  return (
    <div className="stack">
      <form className="row wrap" onSubmit={run} style={{ alignItems: 'flex-end' }}>
        <Field label="Card name" style={{ flex: '2 1 180px' }}><input className="input" autoFocus={autoFocus} value={q.name} onChange={(e) => setQ({ ...q, name: e.target.value })} placeholder="e.g. Umbreon" /></Field>
        <Field label="Number" style={{ flex: '1 1 90px' }}><input className="input" value={q.number} onChange={(e) => setQ({ ...q, number: e.target.value })} placeholder="215/203" /></Field>
        <Field label="Language" style={{ flex: '1 1 140px' }}><select className="select" value={q.language} onChange={(e) => setQ({ ...q, language: e.target.value })}>{LANGUAGES.map((l) => <option key={l}>{l}</option>)}</select></Field>
        <button className="btn" disabled={state.loading}><Icon name="search" size={16} />{state.loading ? 'Searching…' : 'Find'}</button>
      </form>
      {state.errors.length > 0 && <div className="notice warn small">Some sources didn't respond: {state.errors.join('; ')}. You can still enter details manually.</div>}
      {state.candidates && state.candidates.length === 0 && <div className="notice small">No matches found. Check the spelling or number, try another language, or enter it manually.</div>}
      {state.candidates?.length > 1 && <p className="small muted">{state.candidates.length} possible matches. Confirm the exact card and variant; nothing is added until you save.</p>}
      <div className="stack tight" style={{ maxHeight: compact ? 340 : 480, overflowY: 'auto' }}>
        {state.candidates?.map((c) => {
          const pr = bestPrice(c);
          const audv = pr ? fxToAud(s, pr.market ?? pr.mid, pr.currency) : null;
          const key = c.provider + c.providerId;
          return (
            <button type="button" key={key} className={cls('cand', sel === key && 'on')} onClick={() => { setSel(key); onPick(c, pr); }}>
              <ProductImage product={{ name: c.name, images: c.image ? [{ url: c.image }] : [] }} compact />
              <div style={{ minWidth: 0 }}>
                <div className="cell-title">{c.name}</div>
                <div className="cell-sub">{c.set} · {c.number} · {c.language}</div>
                <div className="cell-sub">{c.rarity || 'Rarity unknown'} · via {c.provider === 'tcgdex' ? 'TCGdex' : 'Pokémon TCG API'}</div>
              </div>
              <div className="right">{pr ? <><b>{audv != null ? aud(audv) : '-'}</b><div className="tiny muted">{money(pr.market ?? pr.mid, pr.currency)}</div></> : <span className="tiny muted">No price</span>}</div>
            </button>
          );
        })}
      </div>
      <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => onPick(null, null)}>Enter details manually instead</button>
    </div>
  );
}

/** Search Daybreak inventory (available units). */
export function InventoryPicker({ onPick, exclude = [], autoFocus, big, includeUnpublished = true, holder }) {
  const s = useDB();
  const [q, setQ] = useState('');
  const units = useMemo(() => s.units.filter((u) => u.status === 'available' && availableQty(u, holder) > 0 && (includeUnpublished || u.published)).map((u) => ({ ...productById(s, u.productId), ...u, unitId: u.id, available: availableQty(u, holder) })), [s, holder]);
  const res = useMemo(() => {
    const t = q.trim().toLowerCase();
    const xs = t ? units.filter((l) => [l.name, l.sku, l.cert, l.set, l.number, l.pokemon, l.language].filter(Boolean).join(' ').toLowerCase().includes(t)) : units;
    return xs.filter((l) => !exclude.includes(l.unitId)).slice(0, 60);
  }, [q, units, exclude]);
  const inputRef = useRef(null);
  return (
    <div>
      <div className={cls(big && 'pos-search')} style={{ position: 'relative' }}>
        <input ref={inputRef} className={cls('input', big && 'lg')} autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, SKU, cert, set or number"
          onKeyDown={(e) => { if (e.key === 'Enter' && res.length === 1) { onPick(res[0]); setQ(''); } if (e.key === 'Enter') { const exact = units.find((u) => u.sku.toLowerCase() === q.trim().toLowerCase() || String(u.cert) === q.trim()); if (exact) { onPick(exact); setQ(''); } } }} />
      </div>
      <div className="pos-results">
        {res.map((l) => (
          <button key={l.unitId} type="button" className="pos-item" onClick={() => { onPick(l); setQ(''); inputRef.current?.focus(); }}>
            <ProductImage product={l} compact />
            <div className="small" style={{ fontWeight: 600, lineHeight: 1.2 }}>{l.name}</div>
            <div className="tiny muted">{l.grade ? `PSA ${l.grade}` : COND_SHORT[l.condition] || l.condition} · {l.sku}</div>
            <div className="row between"><b>{aud(l.ask)}</b>{l.available > 1 && <span className="tiny muted">×{l.available}</span>}</div>
          </button>
        ))}
        {!res.length && <p className="muted small">No available stock matches.</p>}
      </div>
    </div>
  );
}

export function LocationSelect({ value, onChange, allowEmpty = true }) {
  const s = useDB();
  const opts = s.locations.map((l) => ({ id: l.id, label: locationPath(s, l.id) })).sort((a, b) => a.label.localeCompare(b.label));
  return (
    <select className="select" value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
      {allowEmpty && <option value="">Unassigned</option>}
      {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}

export function Pickers({ value, onChange, options }) {
  return <div className="pickers">{options.map((o) => { const v = typeof o === 'string' ? o : o.value; const l = typeof o === 'string' ? o : o.label; return <button key={v} type="button" className={cls(value === v && 'on')} onClick={() => onChange(v)}>{l}</button>; })}</div>;
}

/** Product fields that vary by category. */
export function ProductFields({ p, set }) {
  const f = (k) => (e) => set({ ...p, [k]: e.target.value });
  return (
    <div className="grid-2 collapse">
      <Field label="Product name" style={{ gridColumn: '1 / -1' }}><input className="input" value={p.name || ''} onChange={f('name')} /></Field>
      {p.type !== 'guard' && p.type !== 'sealed' && <Field label="Pokémon"><input className="input" value={p.pokemon || ''} onChange={f('pokemon')} /></Field>}
      {p.type !== 'guard' && <Field label="Set"><input className="input" value={p.set || ''} onChange={f('set')} /></Field>}
      {(p.type === 'single' || p.type === 'slab') && <Field label="Card number"><input className="input" value={p.number || ''} onChange={f('number')} placeholder="e.g. 199/165" /></Field>}
      {p.type !== 'guard' && <Field label="Language"><select className="select" value={p.language || 'English'} onChange={f('language')}>{LANGUAGES.map((l) => <option key={l}>{l}</option>)}</select></Field>}
      {(p.type === 'single' || p.type === 'slab') && <>
        <Field label="Rarity"><input className="input" list="rarities" value={p.rarity || ''} onChange={f('rarity')} /><datalist id="rarities">{RARITIES.map((r) => <option key={r} value={r} />)}</datalist></Field>
        <Field label="Variant"><select className="select" value={p.variant || ''} onChange={f('variant')}><option value="">Select</option>{VARIANTS.map((v) => <option key={v}>{v}</option>)}</select></Field>
        <Field label="Release era"><select className="select" value={p.era || ''} onChange={f('era')}><option value="">Select</option>{ERAS.map((v) => <option key={v}>{v}</option>)}</select></Field>
      </>}
      {p.type === 'sealed' && <>
        <Field label="Product type"><select className="select" value={p.productType || ''} onChange={f('productType')}><option value="">Select</option>{SEALED_TYPES.map((v) => <option key={v}>{v}</option>)}</select></Field>
        <Field label="Release year"><input className="input" inputMode="numeric" value={p.releaseYear || ''} onChange={(e) => set({ ...p, releaseYear: parseInt(e.target.value, 10) || '' })} /></Field>
        <Field label="Barcode (EAN/UPC)"><input className="input" value={p.barcode || ''} onChange={f('barcode')} /></Field>
      </>}
      {p.type === 'guard' && <>
        <Field label="Design"><input className="input" value={p.design || ''} onChange={f('design')} /></Field>
        <Field label="Artwork"><input className="input" value={p.artwork || ''} onChange={f('artwork')} /></Field>
        <Field label="Colour"><input className="input" value={p.colour || ''} onChange={f('colour')} /></Field>
        <Field label="Style"><input className="input" value={p.style || ''} onChange={f('style')} /></Field>
        <Field label="PSA compatibility" style={{ gridColumn: '1 / -1' }}><input className="input" value={p.compatibility || ''} onChange={f('compatibility')} placeholder="Standard PSA holder (current label)" /></Field>
      </>}
      <Field label="Description (shown on the storefront)" style={{ gridColumn: '1 / -1' }}><textarea className="textarea" value={p.description || ''} onChange={f('description')} /></Field>
    </div>
  );
}

/** Physical unit fields: condition/grade, cost, asking price with suggestion, qty, location. */
export function UnitFields({ type, u, set, market }) {
  const marketAud = market?.aud ?? u.market?.aud ?? null;
  const suggested = suggestAsk(marketAud);
  const f = (k) => (e) => set({ ...u, [k]: e.target.value });
  const margin = num(u.ask) - num(u.cost);
  return (
    <div className="stack">
      {type === 'slab' && <>
        <Field label="PSA grade"><Pickers value={String(u.grade || '')} onChange={(v) => set({ ...u, grade: v })} options={PSA_GRADES} /></Field>
        <Field label="PSA certification number" hint={u.certVerified ? 'Verified against PSA records' : 'Entered manually (not verified)'}><input className="input" value={u.cert || ''} onChange={(e) => set({ ...u, cert: e.target.value, certVerified: false })} inputMode="numeric" /></Field>
      </>}
      {type === 'single' && <Field label="Condition"><Pickers value={u.condition} onChange={(v) => set({ ...u, condition: v })} options={CONDITIONS.map((c) => ({ value: c, label: COND_SHORT[c] }))} /></Field>}
      {type === 'sealed' && <Field label="Condition"><select className="select" value={u.condition} onChange={f('condition')}>{SEALED_CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select></Field>}
      <div className="grid-3">
        <Field label="Acquisition cost (each)"><MoneyInput value={u.cost} onChange={(v) => set({ ...u, cost: v })} /></Field>
        <Field label="Asking price (each)"><MoneyInput value={u.ask} onChange={(v) => set({ ...u, ask: v })} /></Field>
        {type !== 'slab' ? <Field label="Quantity"><input className="input" inputMode="numeric" value={u.qty} onChange={(e) => set({ ...u, qty: parseInt(e.target.value.replace(/\D/g, ''), 10) || '' })} /></Field> : <Field label="Quantity"><input className="input" value="1 (unique slab)" disabled /></Field>}
      </div>
      <div className="row wrap small">
        <span className="muted">Market:</span> <MarketBadge market={market || u.market} />
        {suggested != null && <button type="button" className="chip" onClick={() => set({ ...u, ask: suggested })}>Use suggested {aud(suggested)}</button>}
        {u.ask !== '' && u.cost !== '' && <span className={cls('badge', margin >= 0 ? 'green' : 'red')}>Margin {aud(margin)}{num(u.ask) > 0 ? ` (${Math.round((margin / num(u.ask)) * 100)}%)` : ''}</span>}
      </div>
      <div className="grid-2 collapse">
        <Field label="Location"><LocationSelect value={u.locationId} onChange={(v) => set({ ...u, locationId: v })} /></Field>
        <Field label="Date acquired"><input className="input" type="date" value={(u.acquiredAt || new Date().toISOString()).slice(0, 10)} onChange={(e) => set({ ...u, acquiredAt: new Date(e.target.value).toISOString() })} /></Field>
      </div>
      <div className="row wrap">
        <label className="check"><input type="checkbox" checked={!!u.published} onChange={(e) => set({ ...u, published: e.target.checked })} /> Publish to storefront</label>
        <label className="check"><input type="checkbox" checked={!!u.negotiable} onChange={(e) => set({ ...u, negotiable: e.target.checked })} /> Negotiable</label>
      </div>
      <Field label="Internal notes"><input className="input" value={u.notes || ''} onChange={f('notes')} placeholder="e.g. light whitening on back corner" /></Field>
    </div>
  );
}

/** Manage product images: API images, uploads (stored compressed), and URLs. */
export function ImageManager({ images = [], onChange, label = 'Images' }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [url, setUrl] = useState('');
  const add = async (files) => {
    const out = [];
    for (const f of files) {
      try { out.push({ url: await fileToDataUrl(f), source: 'Uploaded by Daybreak', uploadedAt: new Date().toISOString() }); }
      catch { toast(`Could not read ${f.name}`, 'err'); }
    }
    onChange([...images, ...out]);
  };
  return (
    <div className="stack tight">
      <span className="label">{label}</span>
      <div className="row wrap">
        {images.map((im, i) => (
          <div key={i} style={{ width: 84, position: 'relative' }}>
            <ProductImage product={{ name: '', images: [im] }} compact />
            <div className="row" style={{ gap: 2, marginTop: 4 }}>
              {i > 0 && <button type="button" className="btn sm ghost square" title="Make primary" onClick={() => onChange([im, ...images.filter((_, j) => j !== i)])}><Icon name="left" size={14} /></button>}
              <button type="button" className="btn sm ghost square" title="Remove" onClick={() => onChange(images.filter((_, j) => j !== i))}><Icon name="trash" size={14} /></button>
            </div>
            {i === 0 && <span className="badge solid" style={{ position: 'absolute', top: 4, left: 4, height: 18 }}>Main</span>}
          </div>
        ))}
        <button type="button" className="btn secondary" style={{ height: 116, width: 84, borderRadius: 12, flexDirection: 'column' }} onClick={() => fileRef.current?.click()}><Icon name="upload" />Upload</button>
        <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" hidden onChange={(e) => { add([...e.target.files]); e.target.value = ''; }} />
      </div>
      <div className="row"><input className="input" placeholder="Or paste an image URL" value={url} onChange={(e) => setUrl(e.target.value)} /><button type="button" className="btn secondary" disabled={!url} onClick={() => { onChange([...images, { url, source: 'Image URL added by Daybreak' }]); setUrl(''); }}>Add</button></div>
      <p className="tiny muted">Uploads are compressed to about 900px. Only use photos of the actual item or official card images.</p>
    </div>
  );
}

/** Wrap a candidate's provider price row into a market reference with FX. */
export function marketFrom(priceRow) { return priceRow ? toMarketRef(priceRow) : null; }
