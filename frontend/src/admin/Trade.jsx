import { useState } from 'react';
import { useDB, recordTransaction, creditBalance, productById } from '../data/db.js';
import { useToast, MoneyInput, Seg } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { CustomerPicker, IncomingList, PaymentSplit } from './parts.jsx';
import { InventoryPicker } from './common.jsx';
import { Receipt } from './Transactions.jsx';
import { aud, num, r2 } from '../lib/util.js';

export default function Trade() {
  const s = useDB();
  const toast = useToast();
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]); // {unitId, qty, price, name, ask}
  const [customerId, setCustomerId] = useState(null);
  const [pay, setPay] = useState({});
  const [settle, setSettle] = useState('credit'); // when Daybreak owes: credit | cash
  const [receipt, setReceipt] = useState(null);
  const tradeIn = r2(incoming.reduce((a, i) => a + i.agreedValue * i.qty, 0));
  const merch = r2(outgoing.reduce((a, l) => a + num(l.price) * l.qty, 0));
  const net = r2(merch - tradeIn); // >0 customer pays; <0 Daybreak owes
  const bal = customerId ? creditBalance(s, customerId) : 0;
  const listed = r2(outgoing.reduce((a, l) => a + l.ask * l.qty, 0));

  const complete = () => {
    try {
      let payments = [], creditIssued = 0;
      if (net > 0) payments = Object.entries(pay).map(([method, amount]) => ({ method, amount: num(amount) }));
      if (net < 0) { if (settle === 'credit') creditIssued = -net; else payments = [{ method: 'cash', amount: net }]; }
      const tx = recordTransaction({ kind: 'sale', channel: 'pos', lines: outgoing.map((l) => ({ unitId: l.unitId, qty: l.qty, price: num(l.price) })), incoming, payments, creditIssued, customerId, notes: 'Trade calculator' });
      setReceipt(tx); setIncoming([]); setOutgoing([]); setPay({}); toast('Trade recorded. Stock updated everywhere.');
    } catch (e) { toast(e.message, 'err'); }
  };
  const balanced = net <= 0 ? (settle === 'cash' || customerId) : Math.abs(r2(Object.values(pay).reduce((a, v) => a + num(v), 0)) - net) < 0.01;

  return (
    <>
      <div className="page-head"><div><h1>Trade calculator</h1><p>Their cards in, your stock out. Cash and trade components are recorded separately.</p></div><div style={{ minWidth: 260 }}><CustomerPicker value={customerId} onChange={setCustomerId} /></div></div>
      <div className="trade">
        <div className="panel stack"><h3>Customer's cards (trade-in) <span className="badge">{aud(tradeIn)}</span></h3><IncomingList items={incoming} setItems={setIncoming} mode="trade" /></div>
        <div className="panel stack">
          <h3>Daybreak merchandise <span className="badge">{aud(merch)}</span></h3>
          {outgoing.map((l, i) => (
            <div key={l.unitId} className="pos-line">
              <div style={{ minWidth: 0 }}><div className="cell-title">{l.name}</div><div className="cell-sub">Asking {aud(l.ask)} · {l.sku}{l.qty > 1 ? ` · ×${l.qty}` : ''}</div></div>
              <div className="row"><MoneyInput value={l.price} onChange={(v) => setOutgoing(outgoing.map((x, j) => (j === i ? { ...x, price: v } : x)))} /><button className="btn ghost sm square" onClick={() => setOutgoing(outgoing.filter((_, j) => j !== i))} aria-label="Remove"><Icon name="trash" size={15} /></button></div>
            </div>
          ))}
          <details open={!outgoing.length}><summary className="btn secondary" style={{ listStyle: 'none' }}><Icon name="plus" size={16} />Add from inventory</summary>
            <div style={{ marginTop: 10 }}><InventoryPicker exclude={outgoing.map((o) => o.unitId)} onPick={(u) => setOutgoing([...outgoing, { unitId: u.unitId, qty: 1, price: u.ask, ask: u.ask, sku: u.sku, name: (productById(s, u.productId)?.name || u.name) + (u.grade ? ` PSA ${u.grade}` : '') }])} /></div>
          </details>
        </div>
      </div>
      <div className="trade-summary">
        <div className="grid-3">
          <div><div className="small" style={{ color: 'var(--cream)' }}>Customer trade-in value</div><div className="big">{aud(tradeIn)}</div></div>
          <div><div className="small" style={{ color: 'var(--cream)' }}>Daybreak merchandise value</div><div className="big">{aud(merch)}</div>{listed !== merch && outgoing.length > 0 && <div className="tiny" style={{ color: 'var(--cream)' }}>Listed {aud(listed)} · negotiated {aud(merch - listed)}</div>}</div>
          <div><div className="small" style={{ color: 'var(--cream)' }}>{net > 0 ? 'Additional cash received' : net < 0 ? 'Owed to customer' : 'Even trade'}</div><div className="big" style={{ color: net < 0 ? '#ffb4b4' : '#fff' }}>{aud(Math.abs(net))}</div></div>
        </div>
      </div>
      {(incoming.length > 0 || outgoing.length > 0) && (
        <div className="panel" style={{ marginTop: 14 }}>
          {net > 0 && <><h3>Customer pays {aud(net)}</h3><PaymentSplit due={net} amounts={pay} setAmounts={setPay} creditAvailable={bal} /></>}
          {net < 0 && <><h3>Settle {aud(-net)} owed to the customer</h3><Seg value={settle} onChange={setSettle} lg options={[{ value: 'credit', label: 'Issue store credit' }, { value: 'cash', label: 'Pay cash' }]} />{settle === 'credit' && !customerId && <p className="err" style={{ marginTop: 8 }}>Select a customer to issue credit.</p>}</>}
          {net === 0 && <h3>Straight swap: no money changes hands.</h3>}
          <button className="btn lg block" style={{ marginTop: 14 }} disabled={!balanced || (!incoming.length && !outgoing.length)} onClick={complete}>Complete trade</button>
        </div>
      )}
      {receipt && <Receipt tx={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}
