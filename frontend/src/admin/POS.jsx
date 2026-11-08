import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDB, recordTransaction, creditBalance, productById, unitById, availableQty, queueOutbox, flushOutbox } from '../data/db.js';
import { useToast, MoneyInput, ProductImage, useOnline, useLocalState, Modal } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { LogoMark, Wordmark } from '../components/Logo.jsx';
import { InventoryPicker } from './common.jsx';
import { CustomerPicker, IncomingList, PaymentSplit } from './parts.jsx';
import { Receipt } from './Transactions.jsx';
import { useCamera, interpretCode } from './Scan.jsx';
import { aud, num, r2, uid, cls } from '../lib/util.js';

/**
 * Point of sale. `showMode` = full-screen Card Show Mode for phone/tablet.
 * The cart is saved on-device, so a dropped connection or closed tab never loses a sale in progress.
 */
export default function POS({ showMode }) {
  const s = useDB();
  const toast = useToast();
  const online = useOnline();
  const [sp, setSp] = useSearchParams();
  const [cart, setCart] = useLocalState('daybreak-pos-cart', []); // {unitId, qty, price}
  const [incoming, setIncoming] = useLocalState('daybreak-pos-tradein', []);
  const [customerId, setCustomerId] = useLocalState('daybreak-pos-customer', null);
  const [discount, setDiscount] = useState({ type: 'percent', value: '' });
  const [pay, setPay] = useState({});
  const [owedMode, setOwedMode] = useState('credit');
  const [step, setStep] = useState('items'); // items | pay
  const [receipt, setReceipt] = useState(null);
  const [scan, setScan] = useState(false);
  const [idem, setIdem] = useState(() => uid('pos-'));
  const holder = 'pos-device';

  const add = useCallback((unitId) => {
    const u = unitById(s, unitId);
    if (!u) return;
    const avail = availableQty(u, holder);
    setCart((c) => {
      const ex = c.find((x) => x.unitId === unitId);
      if (ex) { if (ex.qty >= avail) { toast('No more copies available', 'err'); return c; } return c.map((x) => (x.unitId === unitId ? { ...x, qty: x.qty + 1 } : x)); }
      if (avail <= 0) { toast('That item is sold or held online', 'err'); return c; }
      return [...c, { unitId, qty: 1, price: u.ask }];
    });
  }, [s]);
  useEffect(() => { const a = sp.get('add'); if (a) { add(a); setSp({}, { replace: true }); } }, []);
  useEffect(() => { if (online && s.outbox.length) { const n = flushOutbox(); if (n) toast(`Back online: ${n} offline sale(s) synced`); } }, [online]);

  const lines = cart.map((c) => { const u = unitById(s, c.unitId); const p = u && productById(s, u.productId); return { ...c, unit: u, product: p, avail: u ? availableQty(u, holder) : 0 }; }).filter((l) => l.unit);
  const subtotal = r2(lines.reduce((a, l) => a + num(l.price) * l.qty, 0));
  const listed = r2(lines.reduce((a, l) => a + l.unit.ask * l.qty, 0));
  const discAmt = r2(discount.value === '' ? 0 : discount.type === 'percent' ? subtotal * num(discount.value) / 100 : Math.min(subtotal, num(discount.value)));
  const merch = r2(subtotal - discAmt);
  const tradeIn = r2(incoming.reduce((a, i) => a + i.agreedValue * i.qty, 0));
  const net = r2(merch - tradeIn);
  const bal = customerId ? creditBalance(s, customerId) : 0;
  const paid = r2(Object.values(pay).reduce((a, v) => a + num(v), 0));
  const problems = lines.filter((l) => l.avail < l.qty);
  const canComplete = (lines.length || incoming.length) && !problems.length && (net > 0 ? Math.abs(paid - net) < 0.01 : net < 0 ? (owedMode === 'cash' || customerId) : true);

  const complete = () => {
    try {
      // Spread the cart discount across lines so each line records its real sale price.
      const factor = subtotal > 0 ? merch / subtotal : 1;
      let txLines = lines.map((l) => ({ unitId: l.unitId, qty: l.qty, price: r2(num(l.price) * factor) }));
      const drift = r2(merch - txLines.reduce((a, l) => a + l.price * l.qty, 0));
      const fixAt = txLines.findIndex((l) => l.qty === 1);
      if (drift && fixAt >= 0) txLines[fixAt] = { ...txLines[fixAt], price: r2(txLines[fixAt].price + drift) };
      let payments = [], creditIssued = 0;
      if (net > 0) payments = Object.entries(pay).map(([method, amount]) => ({ method, amount: num(amount) }));
      if (net < 0) { if (owedMode === 'credit') creditIssued = -net; else payments = [{ method: 'cash', amount: net }]; }
      const tx = recordTransaction({ kind: 'sale', channel: 'pos', lines: txLines, incoming, payments, creditIssued, customerId, holder, idempotencyKey: idem, notes: showMode ? 'Card Show Mode' : 'POS' });
      if (!online) queueOutbox({ type: 'transaction', txId: tx.id });
      setReceipt(tx);
      setCart([]); setIncoming([]); setCustomerId(null); setPay({}); setDiscount({ type: 'percent', value: '' }); setStep('items'); setIdem(uid('pos-'));
      toast(online ? 'Sale complete. Stock updated on the website.' : 'Sale saved on this device. Will sync when back online.');
    } catch (e) { toast(e.message, 'err'); }
  };

  const body = (
    <div className="pos">
      <div className="pos-pane">
        <div className="row" style={{ marginBottom: 10 }}>
          <div className="grow" />
          <button className={cls('btn', scan ? '' : 'secondary')} onClick={() => setScan((x) => !x)}><Icon name="scan" size={16} />{scan ? 'Close scanner' : 'Scan label'}</button>
        </div>
        {scan && <PosScanner onUnit={(id) => { add(id); }} />}
        <InventoryPicker big autoFocus={!scan} holder={holder} onPick={(u) => add(u.unitId)} />
      </div>
      <div className="pos-pane pos-cart stack">
        {!online && <div className="notice warn small"><span className="online-dot off" /> Offline. Lookups and cash/transfer/credit sales work and are saved on this device. Card payments are disabled until you're back online.</div>}
        <CustomerPicker value={customerId} onChange={setCustomerId} />
        {step === 'items' ? (<>
          <div>
            {lines.length === 0 && incoming.length === 0 && <p className="muted small center" style={{ padding: 20 }}>Search or scan to add items.</p>}
            {lines.map((l) => (
              <div key={l.unitId} className="pos-line">
                <div className="row" style={{ minWidth: 0 }}><div style={{ width: 38, flex: 'none' }}><ProductImage product={l.product} compact /></div><div style={{ minWidth: 0 }}><div className="cell-title truncate">{l.product.name}{l.unit.grade ? ` PSA ${l.unit.grade}` : ''}</div><div className="cell-sub">Ask {aud(l.unit.ask)}{l.qty > 1 ? ` · ×${l.qty}` : ''}{l.avail < l.qty && <span className="err"> · only {l.avail} left</span>}</div></div></div>
                <div className="row" style={{ gap: 4 }}><div style={{ width: 96 }}><MoneyInput value={l.price} onChange={(v) => setCart(cart.map((c) => (c.unitId === l.unitId ? { ...c, price: v } : c)))} aria-label="Agreed price" /></div>
                  <button className="btn ghost sm square" onClick={() => setCart(cart.flatMap((c) => (c.unitId === l.unitId ? (c.qty > 1 ? [{ ...c, qty: c.qty - 1 }] : []) : [c])))} aria-label="Remove one"><Icon name="minus" size={15} /></button></div>
              </div>
            ))}
          </div>
          <details><summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>Trade-in {incoming.length ? `(${aud(tradeIn)})` : ''}</summary><div style={{ marginTop: 8 }}><IncomingList items={incoming} setItems={setIncoming} mode="trade" /></div></details>
          <div className="row">
            <div className="seg"><button className={discount.type === 'percent' ? 'on' : ''} onClick={() => setDiscount({ ...discount, type: 'percent' })}>%</button><button className={discount.type === 'fixed' ? 'on' : ''} onClick={() => setDiscount({ ...discount, type: 'fixed' })}>$</button></div>
            <input className="input" inputMode="decimal" placeholder="Discount" value={discount.value} onChange={(e) => setDiscount({ ...discount, value: e.target.value })} style={{ width: 110 }} />
            <div className="row wrap" style={{ gap: 4 }}>{[5, 10, 15].map((p) => <button key={p} className="chip" onClick={() => setDiscount({ type: 'percent', value: String(p) })}>{p}%</button>)}</div>
          </div>
          <div>
            <div className="sum-row"><span>Listed</span><span>{aud(listed)}</span></div>
            {listed !== subtotal && <div className="sum-row muted"><span>Negotiated</span><span>{aud(subtotal - listed)}</span></div>}
            {discAmt > 0 && <div className="sum-row muted"><span>Discount</span><span>−{aud(discAmt)}</span></div>}
            {tradeIn > 0 && <div className="sum-row"><span>Trade-in</span><span>−{aud(tradeIn)}</span></div>}
            <div className="row between" style={{ marginTop: 8 }}><span className="muted">{net >= 0 ? 'Customer pays' : 'Owed to customer'}</span><span className="pos-total">{aud(Math.abs(net))}</span></div>
          </div>
          <button className="btn lg block" disabled={!lines.length && !incoming.length || problems.length > 0} onClick={() => setStep('pay')}>{net > 0 ? 'Take payment' : 'Settle'}</button>
          {(lines.length > 0 || incoming.length > 0) && <button className="btn ghost sm" onClick={() => { setCart([]); setIncoming([]); setPay({}); }}>Clear sale</button>}
        </>) : (<>
          <div className="row between"><button className="btn ghost sm" onClick={() => setStep('items')}><Icon name="left" size={15} />Items</button><span className="pos-total">{aud(Math.abs(net))}</span></div>
          {net > 0 && <PaymentSplit due={net} amounts={pay} setAmounts={setPay} creditAvailable={bal} offline={!online} />}
          {net < 0 && <div className="stack"><p className="small">Daybreak owes the customer {aud(-net)}.</p><div className="pay-grid"><button className={'pay-btn' + (owedMode === 'credit' ? ' on' : '')} onClick={() => setOwedMode('credit')}>Store credit<small>{customerId ? 'to account' : 'select customer'}</small></button><button className={'pay-btn' + (owedMode === 'cash' ? ' on' : '')} onClick={() => setOwedMode('cash')}>Pay cash<small>from float</small></button></div></div>}
          {net === 0 && <p className="small">Even trade. Nothing to collect.</p>}
          <button className="btn lg block" style={{ height: 60, fontSize: 18 }} disabled={!canComplete} onClick={complete}><Icon name="check" />Complete sale</button>
        </>)}
      </div>
    </div>
  );

  if (!showMode) return (<>
    <div className="page-head"><div><h1>Point of sale</h1><p>Every sale deducts stock instantly across the storefront and inventory.</p></div><Link to="/admin/show" className="btn danger"><Icon name="bolt" size={16} />Open Card Show Mode</Link></div>
    {body}{receipt && <Receipt tx={receipt} onClose={() => setReceipt(null)} />}
  </>);
  return (
    <div className="showmode">
      <div className="showmode-top">
        <LogoMark size={34} /><Wordmark inverse height={22} style={{ marginRight: 4 }} />
        <span className="badge cream">Card Show Mode</span>
        <span className="small" style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}><span className={cls('online-dot', !online && 'off')} />{online ? 'Online' : `Offline · ${s.outbox.length} queued`}</span>
        <Link to="/admin" className="btn cream sm">Exit</Link>
      </div>
      <div className="content">{body}</div>
      {receipt && <Receipt tx={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function PosScanner({ onUnit }) {
  const toast = useToast();
  const [last, setLast] = useState('');
  const onCode = useCallback((raw) => {
    if (raw === last) return;
    setLast(raw);
    const r = interpretCode(raw);
    if (r.kind === 'unit') { onUnit(r.unit.id); toast('Added from scan'); }
    else toast(`No stock matches "${raw}"`, 'err');
    setTimeout(() => setLast(''), 2500);
  }, [last, onUnit]);
  const cam = useCamera({ onCode });
  useEffect(() => { cam.start(); return cam.stop; }, []);
  return (
    <div className="camera" style={{ aspectRatio: '16/9', marginBottom: 12, maxHeight: 260 }}>
      <video ref={cam.videoRef} playsInline muted />
      <div className="frame wide" />
      {cam.status === 'error' && <p style={{ position: 'absolute', padding: 16 }}>{cam.error}</p>}
    </div>
  );
}
