import { useMemo, useState } from 'react';
import { useDB, creditBalance, upsertCustomer, adjustCredit, txTotals } from '../data/db.js';
import { Modal, Field, MoneyInput, useToast, Empty } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { aud, fmtDate, num, toCSV, download } from '../lib/util.js';

function CustomerDetail({ id, onClose }) {
  const s = useDB();
  const toast = useToast();
  const c = s.customers.find((x) => x.id === id);
  const [f, setF] = useState(c);
  const [adj, setAdj] = useState({ amount: '', reason: '', dir: 'add', authorise: false });
  if (!c) return null;
  const bal = creditBalance(s, id);
  const ledger = s.ledger.filter((l) => l.customerId === id);
  const txs = s.transactions.filter((t) => t.customerId === id);
  const orders = s.orders.filter((o) => o.customerId === id);
  const spent = txs.reduce((a, t) => a + txTotals(t).merch, 0);
  return (
    <Modal title={c.name} onClose={onClose} width={820}>
      <div className="kpis" style={{ marginBottom: 14 }}>
        <div className="kpi accent"><div className="k">Store credit</div><div className="v">{aud(bal)}</div></div>
        <div className="kpi"><div className="k">Issued</div><div className="v">{aud(ledger.filter((l) => l.amount > 0).reduce((a, l) => a + l.amount, 0))}</div></div>
        <div className="kpi"><div className="k">Redeemed</div><div className="v">{aud(-ledger.filter((l) => l.amount < 0).reduce((a, l) => a + l.amount, 0))}</div></div>
        <div className="kpi"><div className="k">Lifetime spend</div><div className="v">{aud(spent)}</div><div className="d">{txs.length} transactions · {orders.length} online orders</div></div>
      </div>
      <div className="grid-2 collapse" style={{ gap: 18, alignItems: 'start' }}>
        <div className="stack">
          <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Email"><input className="input" value={f.email || ''} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Phone"><input className="input" value={f.phone || ''} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Notes"><textarea className="textarea" value={f.notes || ''} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
          <button className="btn" onClick={() => { upsertCustomer(f); toast('Customer saved'); }}>Save details</button>
        </div>
        <div className="stack">
          <b className="small">Adjust store credit</b>
          <div className="row"><div className="seg"><button className={adj.dir === 'add' ? 'on' : ''} onClick={() => setAdj({ ...adj, dir: 'add' })}>Add</button><button className={adj.dir === 'sub' ? 'on' : ''} onClick={() => setAdj({ ...adj, dir: 'sub' })}>Deduct</button></div><MoneyInput value={adj.amount} onChange={(v) => setAdj({ ...adj, amount: v })} /></div>
          <input className="input" placeholder="Reason (required for the audit trail)" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} />
          {adj.dir === 'sub' && num(adj.amount) > bal && <label className="check small"><input type="checkbox" checked={adj.authorise} onChange={(e) => setAdj({ ...adj, authorise: e.target.checked })} />Authorise a negative balance</label>}
          <button className="btn secondary" disabled={!num(adj.amount) || !adj.reason} onClick={() => { try { adjustCredit(id, adj.dir === 'add' ? num(adj.amount) : -num(adj.amount), `Manual: ${adj.reason}`, { authorisedNegative: adj.authorise }); setAdj({ amount: '', reason: '', dir: 'add', authorise: false }); toast('Credit updated'); } catch (e) { toast(e.message, 'err'); } }}>Apply adjustment</button>
          <b className="small" style={{ marginTop: 8 }}>Credit ledger</b>
          <div className="table-wrap" style={{ maxHeight: 240, overflowY: 'auto' }}><table className="t"><tbody>{ledger.map((l) => <tr key={l.id}><td className="small">{fmtDate(l.at)}</td><td className="small">{l.reason}</td><td className="num" style={{ color: l.amount < 0 ? 'var(--red)' : 'var(--green)' }}>{l.amount > 0 ? '+' : ''}{aud(l.amount)}</td></tr>)}{!ledger.length && <tr><td className="muted small">No credit activity</td></tr>}</tbody></table></div>
        </div>
      </div>
      <b className="small" style={{ display: 'block', margin: '16px 0 6px' }}>Transaction history</b>
      <div className="table-wrap"><table className="t"><tbody>{txs.slice(0, 30).map((t) => { const x = txTotals(t); return <tr key={t.id}><td className="small">{fmtDate(t.at)}</td><td><span className="badge grey">{t.kind}</span></td><td className="small">{[...t.lines.map((l) => l.name), ...t.incoming.map((i) => `in: ${i.name}`)].join(', ')}</td><td className="num">{aud(x.merch || x.tradeIn)}</td></tr>; })}{!txs.length && <tr><td className="muted small">No transactions</td></tr>}</tbody></table></div>
    </Modal>
  );
}

export function Customers() {
  const s = useDB();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
  const [n, setN] = useState({ name: '', email: '', phone: '' });
  const rows = useMemo(() => s.customers.filter((c) => !q || [c.name, c.email, c.phone].join(' ').toLowerCase().includes(q.toLowerCase())).map((c) => ({ ...c, bal: creditBalance(s, c.id), tx: s.transactions.filter((t) => t.customerId === c.id).length })), [s, q]);
  return (
    <>
      <div className="page-head"><div><h1>Customers</h1><p>{s.customers.length} customers</p></div>
        <div className="row"><button className="btn secondary" onClick={() => download('daybreak-customers.csv', toCSV(rows.map((c) => ({ name: c.name, email: c.email, phone: c.phone, credit: c.bal, transactions: c.tx, created: c.createdAt?.slice(0, 10) }))), 'text/csv')}><Icon name="download" size={16} />CSV</button><button className="btn" onClick={() => setAdding(true)}><Icon name="plus" size={16} />New customer</button></div></div>
      <div className="filters-bar"><input className="input search" placeholder="Search name, email, phone" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {rows.length === 0 ? <Empty title="No customers yet">Customers are created from checkout, trades, buy sheets or here.</Empty> : (
        <div className="table-wrap"><table className="t"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th className="num">Transactions</th><th className="num">Store credit</th><th>Since</th></tr></thead>
          <tbody>{rows.map((c) => <tr key={c.id} className="click" onClick={() => setOpen(c.id)}><td className="cell-title">{c.name}</td><td className="small">{c.email}</td><td className="small">{c.phone}</td><td className="num">{c.tx}</td><td className="num"><b>{aud(c.bal)}</b></td><td className="small">{fmtDate(c.createdAt)}</td></tr>)}</tbody></table></div>
      )}
      {open && <CustomerDetail id={open} onClose={() => setOpen(null)} />}
      {adding && <Modal title="New customer" onClose={() => setAdding(false)} width={420}><div className="stack">
        <Field label="Name"><input className="input" autoFocus value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} /></Field>
        <Field label="Email"><input className="input" value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} /></Field>
        <Field label="Phone"><input className="input" value={n.phone} onChange={(e) => setN({ ...n, phone: e.target.value })} /></Field>
        <button className="btn" disabled={!n.name} onClick={() => { const id = upsertCustomer(n); setAdding(false); setN({ name: '', email: '', phone: '' }); setOpen(id); }}>Create</button></div></Modal>}
    </>
  );
}

export function StoreCredit() {
  const s = useDB();
  const [open, setOpen] = useState(null);
  const bals = s.customers.map((c) => ({ ...c, bal: creditBalance(s, c.id) })).filter((c) => c.bal !== 0).sort((a, b) => b.bal - a.bal);
  const issued = s.ledger.filter((l) => l.amount > 0).reduce((a, l) => a + l.amount, 0);
  const redeemed = -s.ledger.filter((l) => l.amount < 0).reduce((a, l) => a + l.amount, 0);
  return (
    <>
      <div className="page-head"><div><h1>Store credit</h1><p>Every change is recorded in the ledger. Balances can't go negative unless explicitly authorised.</p></div>
        <button className="btn secondary" onClick={() => download('daybreak-credit-ledger.csv', toCSV(s.ledger.map((l) => ({ date: l.at, customer: s.customers.find((c) => c.id === l.customerId)?.name, amount: l.amount, reason: l.reason, transaction: l.txId || '' }))), 'text/csv')}><Icon name="download" size={16} />Ledger CSV</button></div>
      <div className="kpis" style={{ marginBottom: 14 }}>
        <div className="kpi accent"><div className="k">Outstanding</div><div className="v">{aud(issued - redeemed)}</div><div className="d">Liability</div></div>
        <div className="kpi"><div className="k">Issued (all time)</div><div className="v">{aud(issued)}</div></div>
        <div className="kpi"><div className="k">Redeemed (all time)</div><div className="v">{aud(redeemed)}</div></div>
        <div className="kpi"><div className="k">Customers with credit</div><div className="v">{bals.filter((b) => b.bal > 0).length}</div></div>
      </div>
      <div className="dash-grid" style={{ marginTop: 0 }}>
        <div className="panel span-4"><h3>Balances</h3>{bals.length ? bals.map((c) => <div key={c.id} className="sum-row click" style={{ cursor: 'pointer' }} onClick={() => setOpen(c.id)}><span>{c.name}</span><b style={{ color: c.bal < 0 ? 'var(--red)' : undefined }}>{aud(c.bal)}</b></div>) : <p className="muted small">No outstanding balances.</p>}</div>
        <div className="panel span-8"><h3>Ledger</h3>
          <div className="table-wrap" style={{ maxHeight: 520, overflowY: 'auto' }}><table className="t"><thead><tr><th>Date</th><th>Customer</th><th>Reason</th><th className="num">Amount</th></tr></thead>
            <tbody>{s.ledger.map((l) => <tr key={l.id}><td className="small">{fmtDate(l.at, true)}</td><td className="small">{s.customers.find((c) => c.id === l.customerId)?.name}</td><td className="small">{l.reason}</td><td className="num" style={{ color: l.amount < 0 ? 'var(--red)' : 'var(--green)' }}>{l.amount > 0 ? '+' : ''}{aud(l.amount)}</td></tr>)}</tbody></table></div>
        </div>
      </div>
      {open && <CustomerDetail id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
