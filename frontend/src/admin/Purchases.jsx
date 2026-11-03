import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDB, recordTransaction, txTotals } from '../data/db.js';
import { Field, useToast, Empty, MoneyInput } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { CustomerPicker, IncomingList } from './parts.jsx';
import { aud, num, r2, fmtDate, toCSV, download } from '../lib/util.js';
import { Receipt } from './Transactions.jsx';

export function BuySheet() {
  const toast = useToast();
  const [customerId, setCustomerId] = useState(null);
  const [sellerName, setSellerName] = useState('');
  const [items, setItems] = useState([]);
  const [cash, setCash] = useState('');
  const [bank, setBank] = useState('');
  const [credit, setCredit] = useState('');
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState(null);
  const total = r2(items.reduce((a, i) => a + i.agreedValue * i.qty, 0));
  const out = r2(num(cash) + num(bank) + num(credit));
  const diff = r2(total - out);
  const submit = () => {
    try {
      const tx = recordTransaction({ kind: 'purchase', channel: 'buy', incoming: items, payments: [{ method: 'cash', amount: -num(cash) }, { method: 'bank', amount: -num(bank) }], creditIssued: num(credit), customerId, notes: [sellerName && `Seller: ${sellerName}`, notes].filter(Boolean).join(' · ') });
      setDone(tx); setItems([]); setCash(''); setBank(''); setCredit(''); setNotes(''); setSellerName('');
      toast(`Purchase recorded. ${tx.incoming.length} item(s) added to inventory (unpublished).`);
    } catch (e) { toast(e.message, 'err'); }
  };
  return (
    <>
      <div className="page-head"><div><h1>Buy sheet</h1><p>Buying cards for cash, transfer or store credit. Purchased stock goes straight into inventory.</p></div><Link to="/admin/purchases" className="btn secondary">Purchase history</Link></div>
      {done && <div className="notice ok" style={{ marginBottom: 14 }}>Recorded {aud(txTotals(done).tradeIn)} purchase. <Link to="/admin/inventory?q=" style={{ textDecoration: 'underline' }}>Review new stock</Link> to set asking prices and publish.</div>}
      <div className="dash-grid" style={{ marginTop: 0 }}>
        <div className="panel span-8 stack">
          <h3>Items acquired</h3>
          <IncomingList items={items} setItems={setItems} mode="buy" />
          <Field label="Notes"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. bought at Sydney Card Show" /></Field>
        </div>
        <div className="panel span-4 stack">
          <h3>Seller & payout</h3>
          <CustomerPicker value={customerId} onChange={setCustomerId} label="Seller (required for store credit)" />
          {!customerId && <Field label="Seller name (optional)"><input className="input" value={sellerName} onChange={(e) => setSellerName(e.target.value)} /></Field>}
          <div className="sum-row total"><span>Total agreed</span><span>{aud(total)}</span></div>
          <Field label="Cash paid"><MoneyInput value={cash} onChange={setCash} /></Field>
          <Field label="Bank transfer paid"><MoneyInput value={bank} onChange={setBank} /></Field>
          <Field label="Store credit issued" hint={!customerId ? 'Select a seller to issue credit' : ''}><MoneyInput value={credit} onChange={setCredit} disabled={!customerId} /></Field>
          <div className="row wrap">
            <button className="chip" disabled={!total} onClick={() => { setCash(String(total)); setBank(''); setCredit(''); }}>All cash</button>
            <button className="chip" disabled={!total || !customerId} onClick={() => { setCredit(String(total)); setCash(''); setBank(''); }}>All credit</button>
          </div>
          {Math.abs(diff) > 0.009 && items.length > 0 && <div className="err">{diff > 0 ? `${aud(diff)} not yet allocated` : `${aud(-diff)} over the agreed total`}</div>}
          <button className="btn lg" disabled={!items.length || Math.abs(diff) > 0.009} onClick={submit}>Record purchase</button>
        </div>
      </div>
    </>
  );
}

export function Purchases() {
  const s = useDB();
  const [view, setView] = useState(null);
  const rows = useMemo(() => s.transactions.filter((t) => t.kind === 'purchase' || (t.incoming?.length && t.kind === 'trade')), [s]);
  const tot = rows.reduce((a, t) => { const x = txTotals(t); return { value: a.value + x.tradeIn, credit: a.credit + (t.creditIssued || 0), cash: a.cash + t.payments.filter((p) => p.amount < 0).reduce((b, p) => b - p.amount, 0) }; }, { value: 0, credit: 0, cash: 0 });
  return (
    <>
      <div className="page-head"><div><h1>Purchases</h1><p>{rows.length} acquisitions · {aud(tot.value)} total · {aud(tot.cash)} paid out · {aud(tot.credit)} credit issued</p></div>
        <div className="row"><button className="btn secondary" onClick={() => download('daybreak-purchases.csv', toCSV(rows.flatMap((t) => t.incoming.map((i) => ({ date: t.at.slice(0, 10), tx: t.id, kind: t.kind, item: i.name, sku: i.sku, qty: i.qty, agreed: i.agreedValue, market: i.market ?? '' })))), 'text/csv')}><Icon name="download" size={16} />CSV</button><Link to="/admin/buy-sheet" className="btn"><Icon name="plus" size={16} />New buy sheet</Link></div></div>
      {rows.length === 0 ? <Empty title="No purchases yet" action={<Link className="btn" to="/admin/buy-sheet">Open the buy sheet</Link>}>Purchases and trade-ins you record appear here.</Empty> : (
        <div className="table-wrap"><table className="t"><thead><tr><th>Date</th><th>Type</th><th>Seller</th><th>Items</th><th className="num">Value</th><th>Paid with</th></tr></thead>
          <tbody>{rows.map((t) => { const x = txTotals(t); const c = s.customers.find((c) => c.id === t.customerId); return (
            <tr key={t.id} className="click" onClick={() => setView(t)}><td>{fmtDate(t.at)}</td><td><span className="badge grey">{t.kind}</span></td><td>{c?.name || t.notes?.match(/Seller: ([^·]+)/)?.[1] || 'Walk-in'}</td><td className="small">{t.incoming.map((i) => i.name).join(', ')}</td><td className="num">{aud(x.tradeIn)}</td>
              <td className="small">{t.kind === 'trade' ? 'Trade' : [...t.payments.filter((p) => p.amount < 0).map((p) => `${p.method} ${aud(-p.amount)}`), t.creditIssued ? `credit ${aud(t.creditIssued)}` : ''].filter(Boolean).join(' · ')}</td></tr>
          ); })}</tbody></table></div>
      )}
      {view && <Receipt tx={view} onClose={() => setView(null)} />}
    </>
  );
}
