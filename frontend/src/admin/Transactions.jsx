import { useMemo, useState } from 'react';
import { useDB, txTotals } from '../data/db.js';
import { Modal, Empty } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { METHOD_LABEL } from './metrics.js';
import { aud, fmtDate, toCSV, download } from '../lib/util.js';

export function Receipt({ tx, onClose }) {
  const s = useDB();
  const biz = s.settings.business;
  const c = s.customers.find((x) => x.id === tx.customerId);
  const x = txTotals(tx);
  const text = [
    `${biz.name}`, `${fmtDate(tx.at, true)} · ${tx.kind.toUpperCase()} · Ref ${tx.id}`, c ? `Customer: ${c.name}` : '', '',
    ...tx.lines.map((l) => `${l.name} x${l.qty}  ${aud(l.price * l.qty)}${l.ask && l.ask !== l.price ? ` (listed ${aud(l.ask)})` : ''}`),
    ...(tx.incoming.length ? ['', 'Traded in:', ...tx.incoming.map((i) => `${i.name} x${i.qty}  ${aud(i.agreedValue * i.qty)}`)] : []),
    '', ...tx.payments.map((p) => `${METHOD_LABEL[p.method]} ${p.amount < 0 ? 'paid out' : ''} ${aud(Math.abs(p.amount))}`),
    tx.creditIssued ? `Store credit issued ${aud(tx.creditIssued)}` : '',
  ].filter((l) => l !== null).join('\n');
  return (
    <Modal title="Receipt" onClose={onClose} width={460}>
      <div className="print-area doc" style={{ fontSize: 14 }}>
        <div className="center"><div className="serif" style={{ fontSize: 24, color: 'var(--indigo)' }}>{biz.name}</div><div className="tiny muted">{fmtDate(tx.at, true)} · Ref {tx.id}</div>{c && <div className="small">{c.name}</div>}</div>
        <hr className="divider" style={{ margin: '12px 0' }} />
        {tx.lines.map((l, i) => <div key={i} className="sum-row"><span>{l.name} ×{l.qty}{l.ask && l.ask !== l.price && <div className="tiny muted">Listed {aud(l.ask)}</div>}</span><span>{aud(l.price * l.qty)}</span></div>)}
        {tx.incoming.length > 0 && <><div className="upper muted" style={{ marginTop: 10 }}>{tx.kind === 'purchase' ? 'Purchased from customer' : 'Traded in'}</div>{tx.incoming.map((i, k) => <div key={k} className="sum-row"><span>{i.name} ×{i.qty}</span><span>{aud(i.agreedValue * i.qty)}</span></div>)}</>}
        <hr className="divider" style={{ margin: '12px 0' }} />
        {x.merch > 0 && <div className="sum-row"><span>Merchandise</span><b>{aud(x.merch)}</b></div>}
        {x.tradeIn > 0 && <div className="sum-row"><span>Trade-in / purchase value</span><b>{aud(x.tradeIn)}</b></div>}
        {tx.payments.map((p, i) => <div key={i} className="sum-row"><span>{METHOD_LABEL[p.method]}{p.amount < 0 ? ' (paid to customer)' : ''}</span><span>{aud(Math.abs(p.amount))}</span></div>)}
        {tx.creditIssued > 0 && <div className="sum-row"><span>Store credit issued</span><span>{aud(tx.creditIssued)}</span></div>}
        {c && <div className="tiny muted center" style={{ marginTop: 10 }}>Thank you, {c.name.replace('Sample: ', '').split(' ')[0]}!</div>}
      </div>
      <div className="row end no-print" style={{ marginTop: 16 }}>
        <button className="btn secondary" onClick={() => navigator.clipboard?.writeText(text)}><Icon name="copy" size={16} />Copy</button>
        {c?.email && <a className="btn secondary" href={`mailto:${c.email}?subject=${encodeURIComponent('Your Daybreak receipt')}&body=${encodeURIComponent(text)}`}>Email</a>}
        <button className="btn" onClick={() => window.print()}><Icon name="printer" size={16} />Print</button>
      </div>
    </Modal>
  );
}

export default function Transactions() {
  const s = useDB();
  const [kind, setKind] = useState('');
  const [chan, setChan] = useState('');
  const [view, setView] = useState(null);
  const rows = useMemo(() => s.transactions.filter((t) => (!kind || t.kind === kind) && (!chan || t.channel === chan)), [s, kind, chan]);
  const exportCSV = () => download('daybreak-transactions.csv', toCSV(rows.map((t) => { const x = txTotals(t); return { date: t.at, id: t.id, kind: t.kind, channel: t.channel, customer: s.customers.find((c) => c.id === t.customerId)?.name || '', items_out: t.lines.map((l) => `${l.name} x${l.qty}`).join('; '), items_in: t.incoming.map((i) => `${i.name} x${i.qty}`).join('; '), listed: x.listed, sale_value: x.merch, discount: x.discount, cogs: x.cogs, profit: x.profit, trade_in: x.tradeIn, cash: t.payments.filter((p) => p.method === 'cash').reduce((a, p) => a + p.amount, 0), card: t.payments.filter((p) => p.method === 'card').reduce((a, p) => a + p.amount, 0), bank: t.payments.filter((p) => p.method === 'bank').reduce((a, p) => a + p.amount, 0), credit_redeemed: t.payments.filter((p) => p.method === 'credit').reduce((a, p) => a + p.amount, 0), credit_issued: t.creditIssued || 0, notes: t.notes || '', sample: t.demo ? 'yes' : '' }; })), 'text/csv');
  return (
    <>
      <div className="page-head"><div><h1>Transactions</h1><p>Complete history of sales, trades, purchases and refunds.</p></div><button className="btn secondary" onClick={exportCSV}><Icon name="download" size={16} />Export CSV</button></div>
      <div className="filters-bar">
        <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">All types</option><option value="sale">Sales</option><option value="trade">Trades</option><option value="purchase">Purchases</option><option value="refund">Refunds</option></select>
        <select className="select" value={chan} onChange={(e) => setChan(e.target.value)}><option value="">All channels</option><option value="pos">POS / card show</option><option value="online">Online</option><option value="buy">Buy sheet</option></select>
      </div>
      {rows.length === 0 ? <Empty title="No transactions yet" /> : (
        <div className="table-wrap"><table className="t"><thead><tr><th>Date</th><th>Type</th><th>Channel</th><th>Customer</th><th>Items</th><th className="num">Listed</th><th className="num">Sold for</th><th className="num">Profit</th><th>Payments</th></tr></thead>
          <tbody>{rows.slice(0, 300).map((t) => { const x = txTotals(t); return (
            <tr key={t.id} className="click" onClick={() => setView(t)}>
              <td className="small">{fmtDate(t.at, true)}</td><td><span className="badge grey">{t.kind}</span>{t.demo && <span className="badge amber" style={{ marginLeft: 4 }}>sample</span>}</td><td className="small">{t.channel}</td>
              <td className="small">{s.customers.find((c) => c.id === t.customerId)?.name || '-'}</td>
              <td className="small">{[...t.lines.map((l) => l.name), ...t.incoming.map((i) => `in: ${i.name}`)].join(', ')}</td>
              <td className="num">{x.listed ? aud(x.listed) : '-'}</td><td className="num"><b>{x.merch ? aud(x.merch) : '-'}</b></td><td className="num">{x.merch ? aud(x.profit) : '-'}</td>
              <td className="small">{[...t.payments.map((p) => `${METHOD_LABEL[p.method]} ${aud(p.amount)}`), x.tradeIn ? `trade ${aud(x.tradeIn)}` : '', t.creditIssued ? `credit issued ${aud(t.creditIssued)}` : ''].filter(Boolean).join(' · ')}</td>
            </tr>
          ); })}</tbody></table></div>
      )}
      {view && <Receipt tx={view} onClose={() => setView(null)} />}
    </>
  );
}
