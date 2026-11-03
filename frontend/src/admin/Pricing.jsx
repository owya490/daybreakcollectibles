import { useMemo, useState } from 'react';
import { useDB, updateSettings, fxToAud, productById, recordMarketPrice, updateUnits } from '../data/db.js';
import { Field, useToast, Seg } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { CardLookup, MarketBadge } from './common.jsx';
import { PRICING_MODES, suggestAsk, toMarketRef, refreshFx, isStale } from '../services/pricing.js';
import { searchCards, bestPrice } from '../services/cardData.js';
import { aud, money, fmtDate, timeAgo, cls } from '../lib/util.js';

export default function Pricing() {
  const s = useDB();
  const toast = useToast();
  const [cand, setCand] = useState(null);
  const [tab, setTab] = useState('lookup');
  const rules = s.settings.pricing;
  const fx = s.settings.fx;
  const setRules = (patch) => updateSettings({ pricing: { ...rules, ...patch } }, 'pricing.rules');

  return (
    <>
      <div className="page-head"><div><h1>Pricing</h1><p>Market data is a reference. Your asking price is always yours to set.</p></div>
        <Seg value={tab} onChange={setTab} options={[{ value: 'lookup', label: 'Instant price' }, { value: 'refresh', label: 'Refresh inventory' }, { value: 'rules', label: 'Rules & FX' }]} /></div>

      {tab === 'lookup' && (
        <div className="dash-grid" style={{ marginTop: 0 }}>
          <div className="panel span-6"><h3>Look up a card</h3><CardLookup onPick={(c) => setCand(c)} autoFocus /></div>
          <div className="panel span-6">
            <h3>Price detail</h3>
            {!cand ? <p className="muted small">Choose a card to see every available price point, its source and when it was last updated.</p> : (
              <div className="stack">
                <div className="row"><img src={cand.image} alt="" style={{ width: 90, borderRadius: 6 }} onError={(e) => (e.currentTarget.style.display = 'none')} /><div><div className="cell-title" style={{ fontSize: 18 }}>{cand.name}</div><div className="cell-sub">{cand.set} · {cand.number} · {cand.language}</div><div className="cell-sub">Variants: {cand.variants.join(', ') || 'unknown'}</div></div></div>
                {cand.prices.length === 0 ? <div className="notice warn small">No pricing available from the connected sources for this print (common for Asian-language cards). Set your price manually or from recent sales you trust.</div> : (
                  <table className="t"><thead><tr><th>Source / variant</th><th className="num">Low</th><th className="num">Mid</th><th className="num">Market</th><th className="num">High</th><th className="num">AUD (market)</th><th className="num">Suggested ask</th></tr></thead>
                    <tbody>{cand.prices.map((p, i) => { const a = fxToAud(s, p.market ?? p.mid, p.currency); return (
                      <tr key={i}><td><div className="small" style={{ fontWeight: 600 }}>{p.label}</div><div className="tiny muted">{p.source} · updated {p.updatedAt ? fmtDate(p.updatedAt) : 'unknown'}</div>{(p.avg7 || p.avg30) && <div className="tiny muted">Trend: 7d avg {money(p.avg7, p.currency)} · 30d avg {money(p.avg30, p.currency)}</div>}</td>
                        <td className="num">{money(p.low, p.currency)}</td><td className="num">{money(p.mid, p.currency)}</td><td className="num"><b>{money(p.market, p.currency)}</b></td><td className="num">{money(p.high, p.currency)}</td><td className="num">{aud(a)}</td><td className="num">{aud(suggestAsk(a))}</td></tr>
                    ); })}</tbody></table>
                )}
                <p className="tiny muted">AUD converted at {fx.usdAud} USD/AUD and {fx.eurAud} EUR/AUD ({fx.source}, {timeAgo(fx.updatedAt)}). Condition-specific and comparable-sales data require a TCGplayer or eBay partner API (see API Integrations).</p>
              </div>
            )}
          </div>
        </div>
      )}
      {tab === 'refresh' && <RefreshInventory />}
      {tab === 'rules' && (
        <div className="dash-grid" style={{ marginTop: 0 }}>
          <div className="panel span-6 stack">
            <h3>Suggested asking price rule</h3>
            <div className="stack tight">{PRICING_MODES.map((m) => <label key={m.id} className={cls('radio-card', rules.mode === m.id && 'on')}><input type="radio" checked={rules.mode === m.id} onChange={() => setRules({ mode: m.id })} />{m.label}</label>)}</div>
            <div className="grid-3">
              <Field label="Fixed margin ($)"><input className="input" inputMode="decimal" value={rules.margin} onChange={(e) => setRules({ margin: e.target.value })} /></Field>
              <Field label="Multiplier (×)"><input className="input" inputMode="decimal" value={rules.multiplier} onChange={(e) => setRules({ multiplier: e.target.value })} /></Field>
              <Field label="Rounding"><select className="select" value={rules.rounding} onChange={(e) => setRules({ rounding: e.target.value })}><option value="none">None (cents)</option><option value="whole">Whole dollars</option><option value="five">Nearest $5</option><option value="ninety-nine">.99 endings</option></select></Field>
            </div>
            <div className="notice small">Example: market {aud(100)} → suggested {aud(suggestAsk(100))}. Suggestions never change a price automatically; you apply them per item or in bulk.</div>
          </div>
          <div className="panel span-6 stack">
            <h3>Currency conversion <button className="btn sm secondary" onClick={async () => { try { await refreshFx(); toast('Exchange rates updated'); } catch (e) { toast(e.message + '. Keeping current rates.', 'err'); } }}><Icon name="refresh" size={14} />Fetch latest</button></h3>
            <div className="grid-3">
              <Field label="USD → AUD"><input className="input" value={fx.usdAud} onChange={(e) => updateSettings({ fx: { ...fx, usdAud: Number(e.target.value) || fx.usdAud, updatedAt: new Date().toISOString(), source: 'Manual entry' } })} /></Field>
              <Field label="EUR → AUD"><input className="input" value={fx.eurAud} onChange={(e) => updateSettings({ fx: { ...fx, eurAud: Number(e.target.value) || fx.eurAud, updatedAt: new Date().toISOString(), source: 'Manual entry' } })} /></Field>
              <Field label="JPY → AUD"><input className="input" value={fx.jpyAud} onChange={(e) => updateSettings({ fx: { ...fx, jpyAud: Number(e.target.value) || fx.jpyAud, updatedAt: new Date().toISOString(), source: 'Manual entry' } })} /></Field>
            </div>
            <p className="small muted">Source: <b>{fx.source}</b> · {fmtDate(fx.updatedAt, true)}. Each stored market price records the rate and time used.</p>
          </div>
        </div>
      )}
    </>
  );
}

function RefreshInventory() {
  const s = useDB();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState([]);
  const rows = useMemo(() => s.units.filter((u) => u.status === 'available' && u.qty > 0).map((u) => ({ ...productById(s, u.productId), ...u })).filter((r) => r.type === 'single' || r.type === 'slab').sort((a, b) => (isStale(b.market) ? 1 : 0) - (isStale(a.market) ? 1 : 0)), [s]);
  const stale = rows.filter((r) => isStale(r.market));
  const refresh = async (targets) => {
    setBusy(true);
    const issues = [];
    let ok = 0;
    for (const r of targets) {
      try {
        const { candidates } = await searchCards({ name: r.pokemon || r.name, number: r.number, language: r.language });
        const n = String(r.number).split('/')[0].replace(/^0+/, '');
        const exact = candidates.filter((c) => String(c.number).split('/')[0].replace(/^0+/, '') === n && (!r.setCode || c.setCode === r.setCode || c.set === r.set));
        if (exact.length !== 1) { issues.push({ r, reason: exact.length ? 'Multiple possible prints' : 'No exact match' }); continue; }
        const pr = bestPrice(exact[0], r.variant || '');
        if (!pr) { issues.push({ r, reason: 'No price for this print' }); continue; }
        recordMarketPrice([r.id], { ...toMarketRef(pr), ...(r.type === 'slab' ? { label: 'Raw card reference (not graded)' } : {}) });
        ok++;
      } catch (e) { issues.push({ r, reason: e.message }); }
    }
    setReview(issues);
    setBusy(false);
    toast(`Updated ${ok} market prices${issues.length ? `, ${issues.length} need review` : ''}`);
  };
  return (
    <div className="panel">
      <h3>Market references in stock <div className="row"><button className="btn sm" disabled={busy || !stale.length} onClick={() => refresh(stale.slice(0, 40))}>{busy ? 'Refreshing…' : `Refresh ${Math.min(40, stale.length)} stale`}</button></div></h3>
      <p className="small muted" style={{ marginBottom: 10 }}>Only exact matches (same set and number) are updated. Anything ambiguous is listed for review rather than guessed. Asking prices are not changed.</p>
      {review.length > 0 && <div className="notice warn small" style={{ marginBottom: 10 }}>{review.map((x) => <div key={x.r.id}>{x.r.name} ({x.r.sku}): {x.reason}</div>)}</div>}
      <div className="table-wrap"><table className="t"><thead><tr><th>Item</th><th>Language</th><th>Market</th><th>Source</th><th className="num">Asking</th><th className="num">Suggested</th><th></th></tr></thead>
        <tbody>{rows.map((r) => { const sug = r.market?.aud != null ? suggestAsk(r.market.aud) : null; return (
          <tr key={r.id}><td><div className="cell-title">{r.name}{r.grade ? ` · PSA ${r.grade}` : ''}</div><div className="cell-sub">{r.sku} · {r.set} {r.number}</div></td><td className="small">{r.language}</td><td><MarketBadge market={r.market} /></td><td className="tiny muted">{r.market?.source || '-'}{r.market?.label ? ` · ${r.market.label}` : ''}</td><td className="num"><b>{aud(r.ask)}</b></td><td className="num">{sug != null ? aud(sug) : '-'}</td>
            <td>{sug != null && sug !== r.ask && <button className="btn sm secondary" onClick={() => { updateUnits([r.id], { ask: sug, labelPrintedAt: null }, 'pricing.apply'); toast('Asking price updated'); }}>Apply</button>}</td></tr>
        ); })}</tbody></table></div>
    </div>
  );
}
