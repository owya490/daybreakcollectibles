import { useState } from 'react';
import { useDB, creditBalance, upsertCustomer, fxToAud } from '../data/db.js';
import { Modal, Field, MoneyInput, ProductImage, useToast, Seg } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { CardLookup, ProductFields, Pickers, candidateToProduct, marketFrom, LocationSelect } from './common.jsx';
import { blankProduct } from './AddInventory.jsx';
import { aud, num, r2, CONDITIONS, COND_SHORT, PSA_GRADES, SEALED_CONDITIONS, TYPE_LABEL, PAY_METHODS } from '../lib/util.js';

/** Select or create a customer; shows store credit balance. */
export function CustomerPicker({ value, onChange, label = 'Customer (optional)' }) {
  const s = useDB();
  const [adding, setAdding] = useState(false);
  const [n, setN] = useState({ name: '', email: '', phone: '' });
  const bal = value ? creditBalance(s, value) : 0;
  return (
    <div className="field">
      <span>{label}</span>
      <div className="row">
        <select className="select" value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">Walk-in / anonymous</option>
          {s.customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.email ? ` (${c.email})` : ''}</option>)}
        </select>
        <button type="button" className="btn secondary square" onClick={() => setAdding(true)} aria-label="New customer"><Icon name="plus" size={16} /></button>
      </div>
      {value && <small className="hint">Store credit balance: <b>{aud(bal)}</b></small>}
      {adding && (
        <Modal title="New customer" onClose={() => setAdding(false)} width={420}>
          <div className="stack">
            <Field label="Name"><input className="input" autoFocus value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} /></Field>
            <Field label="Email"><input className="input" type="email" value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} /></Field>
            <Field label="Phone"><input className="input" value={n.phone} onChange={(e) => setN({ ...n, phone: e.target.value })} /></Field>
            <button className="btn" disabled={!n.name} onClick={() => { onChange(upsertCustomer(n)); setAdding(false); }}>Create customer</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Modal to add a customer's card (trade-in or purchase). */
export function IncomingEditor({ onSave, onClose, mode = 'trade' }) {
  const s = useDB();
  const pct = mode === 'trade' ? s.settings.tradePct ?? 80 : s.settings.cashPct ?? 70;
  const [type, setType] = useState('single');
  const [step, setStep] = useState('lookup');
  const [product, setProduct] = useState(blankProduct('single'));
  const [market, setMarket] = useState(null);
  const [manualMarket, setManualMarket] = useState('');
  const [unit, setUnit] = useState({ condition: 'Near Mint', grade: '', cert: '', locationId: null, ask: '' });
  const [qty, setQty] = useState(1);
  const [agreed, setAgreed] = useState('');
  const mAud = market?.aud ?? (manualMarket !== '' ? num(manualMarket) : null);
  const save = () => {
    if (!product.name) return;
    const m = market || (manualMarket !== '' ? { value: num(manualMarket), currency: 'AUD', aud: num(manualMarket), source: 'Manual entry', updatedAt: new Date().toISOString(), stale: false } : null);
    onSave({ product: { ...product, type }, unit: { ...unit, condition: type === 'single' ? unit.condition : type === 'sealed' ? unit.condition || 'Factory Sealed' : '', ask: num(unit.ask) }, qty: type === 'slab' ? 1 : Math.max(1, num(qty)), agreedValue: r2(num(agreed)), market: m });
  };
  return (
    <Modal title={mode === 'trade' ? 'Add trade-in card' : 'Add item to buy sheet'} onClose={onClose} width={760}>
      <div className="stack">
        <Seg value={type} onChange={(t) => { setType(t); setProduct(blankProduct(t)); setStep(t === 'sealed' ? 'form' : 'lookup'); }} options={[{ value: 'single', label: 'Raw single' }, { value: 'slab', label: 'PSA slab' }, { value: 'sealed', label: 'Sealed' }]} />
        {step === 'lookup' ? (
          <CardLookup compact autoFocus onPick={(c, pr) => { if (c) { setProduct({ ...blankProduct(type), ...candidateToProduct(c, type) }); setMarket(marketFrom(pr)); } setStep('form'); }} />
        ) : (
          <div className="grid-2 collapse" style={{ gap: 18, alignItems: 'start' }}>
            <div className="stack">
              <div className="row"><div style={{ width: 70 }}><ProductImage product={product} compact /></div><div className="grow"><input className="input" placeholder="Name" value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} /><div className="cell-sub" style={{ marginTop: 4 }}>{product.set} {product.number} {product.language}</div></div></div>
              {!product.set && <ProductFields p={product} set={setProduct} />}
              <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setStep('lookup')}>Search again</button>
            </div>
            <div className="stack">
              {type === 'single' && <Field label="Condition"><Pickers value={unit.condition} onChange={(v) => setUnit({ ...unit, condition: v })} options={CONDITIONS.map((c) => ({ value: c, label: COND_SHORT[c] }))} /></Field>}
              {type === 'sealed' && <Field label="Condition"><select className="select" value={unit.condition} onChange={(e) => setUnit({ ...unit, condition: e.target.value })}>{SEALED_CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select></Field>}
              {type === 'slab' && <><Field label="PSA grade"><Pickers value={unit.grade} onChange={(v) => setUnit({ ...unit, grade: v })} options={PSA_GRADES.slice(0, 8)} /></Field><Field label="Cert number"><input className="input" inputMode="numeric" value={unit.cert} onChange={(e) => setUnit({ ...unit, cert: e.target.value })} /></Field></>}
              <div className="grid-2">
                <Field label="Market (AUD)">{market ? <div className="input" style={{ display: 'flex', alignItems: 'center' }} title={market.source}>{aud(market.aud)} <span className="tiny muted" style={{ marginLeft: 6 }}>{market.source.split(' ')[0]}</span></div> : <MoneyInput value={manualMarket} onChange={setManualMarket} placeholder="manual" />}</Field>
                {type !== 'slab' && <Field label="Qty"><input className="input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>}
              </div>
              <Field label="Agreed value (each)"><MoneyInput value={agreed} onChange={setAgreed} /></Field>
              {mAud != null && <div className="row wrap">{[60, 70, 75, 80, 85, 90].map((p) => <button key={p} type="button" className={'chip' + (p === pct ? ' on' : '')} onClick={() => setAgreed(String(Math.round(mAud * p) / 100))}>{p}% · {aud(mAud * p / 100, { round: true })}</button>)}</div>}
              <Field label="Your future asking price (optional)"><MoneyInput value={unit.ask} onChange={(v) => setUnit({ ...unit, ask: v })} /></Field>
              <Field label="Store in"><LocationSelect value={unit.locationId} onChange={(v) => setUnit({ ...unit, locationId: v })} /></Field>
              <button className="btn lg" disabled={!product.name || agreed === ''} onClick={save}>Add · {aud(num(agreed) * (type === 'slab' ? 1 : num(qty) || 1))}</button>
              <p className="tiny muted">Added items go into inventory unpublished, at the agreed value as cost.</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function IncomingList({ items, setItems, mode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="stack tight">
      {items.map((it, i) => (
        <div key={i} className="pos-line">
          <div style={{ minWidth: 0 }}><div className="cell-title">{it.product.name}{it.unit.grade ? ` · PSA ${it.unit.grade}` : ''}</div><div className="cell-sub">{TYPE_LABEL[it.product.type]} · {it.unit.condition || ''} · ×{it.qty}{it.market?.aud != null ? ` · market ${aud(it.market.aud)}` : ''}</div></div>
          <div className="row"><MoneyInput value={it.agreedValue} onChange={(v) => setItems(items.map((x, j) => (j === i ? { ...x, agreedValue: num(v) } : x)))} /><button className="btn ghost sm square" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Remove"><Icon name="trash" size={15} /></button></div>
        </div>
      ))}
      <button className="btn secondary" onClick={() => setOpen(true)}><Icon name="plus" size={16} />{mode === 'trade' ? 'Add their card' : 'Add item'}</button>
      {open && <IncomingEditor mode={mode} onClose={() => setOpen(false)} onSave={(x) => { setItems([...items, x]); setOpen(false); }} />}
    </div>
  );
}

/** Split payment editor. amounts: {cash, card, bank, credit}. */
export function PaymentSplit({ due, amounts, setAmounts, creditAvailable = 0, offline, direction = 'in' }) {
  const paid = r2(Object.values(amounts).reduce((a, v) => a + num(v), 0));
  const remaining = r2(due - paid);
  const methods = PAY_METHODS.filter((m) => direction === 'in' || m.id !== 'card');
  return (
    <div className="stack tight">
      <div className="pay-grid">
        {methods.map((m) => {
          const disabled = (m.id === 'card' && offline) || (m.id === 'credit' && direction === 'in' && creditAvailable <= 0);
          return (
            <button key={m.id} type="button" disabled={disabled} className={'pay-btn' + (num(amounts[m.id]) ? ' on' : '')}
              onClick={() => { const cur = num(amounts[m.id]); let add = remaining > 0 ? remaining : 0; if (m.id === 'credit' && direction === 'in') add = Math.min(add, creditAvailable - cur); setAmounts({ ...amounts, [m.id]: r2(cur + add) }); }}>
              {m.label}{num(amounts[m.id]) ? <small>{aud(amounts[m.id])}</small> : <small>{disabled ? (m.id === 'card' ? 'Offline' : 'No credit') : 'Tap to fill'}</small>}
            </button>
          );
        })}
      </div>
      <div className="grid-2">{methods.filter((m) => num(amounts[m.id])).map((m) => <Field key={m.id} label={m.label}><MoneyInput value={amounts[m.id]} onChange={(v) => setAmounts({ ...amounts, [m.id]: v })} /></Field>)}</div>
      <div className="row between small"><span className="muted">{direction === 'in' ? 'Received' : 'Paid out'} {aud(paid)}</span>{Math.abs(remaining) > 0.009 ? <b style={{ color: 'var(--red)' }}>{remaining > 0 ? `${aud(remaining)} remaining` : `${aud(-remaining)} over`}</b> : <b style={{ color: 'var(--green)' }}>Balanced</b>}</div>
      {Object.values(amounts).some((v) => num(v)) && <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setAmounts({})}>Reset payments</button>}
    </div>
  );
}
export { fxToAud };
