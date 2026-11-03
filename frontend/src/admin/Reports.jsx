import { useMemo, useState } from 'react';
import { useDB, inventoryTotals, productById, txTotals } from '../data/db.js';
import { Seg } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { KPI } from './Dashboard.jsx';
import { BarSeries, TwoLines } from './charts.jsx';
import { saleSummary, dailySeries, byCategory, byPaymentMethod, bestSellers, agedInventory, isSale, inRange } from './metrics.js';
import { aud, daysAgo, toCSV, download, fmtDate, TYPE_LABEL, r2 } from '../lib/util.js';

const RANGES = { 7: 'Last 7 days', 30: 'Last 30 days', 90: 'Last 90 days', 365: 'Last 12 months' };

export default function Reports() {
  const s = useDB();
  const [days, setDays] = useState('30');
  const [printing, setPrinting] = useState(false);
  const r = useMemo(() => {
    const txs = s.transactions.filter((t) => inRange(t, daysAgo(Number(days))));
    const sum = saleSummary(txs);
    const channel = ['pos', 'online'].map((c) => ({ name: c === 'pos' ? 'Card shows / POS' : 'Online', value: saleSummary(txs.filter((t) => t.channel === c)).revenue }));
    const inv = inventoryTotals(s);
    const soldUnits = txs.filter(isSale).reduce((a, t) => a + t.lines.reduce((b, l) => b + Math.sign(l.price) * l.qty, 0), 0);
    const avgStock = inv.qty || 1;
    const purchases = txs.filter((t) => t.kind === 'purchase' || t.kind === 'trade');
    const creditIssued = r2(s.ledger.filter((l) => l.amount > 0 && inRange(l, daysAgo(Number(days)))).reduce((a, l) => a + l.amount, 0));
    const creditRedeemed = r2(-s.ledger.filter((l) => l.amount < 0 && inRange(l, daysAgo(Number(days)))).reduce((a, l) => a + l.amount, 0));
    const aged = agedInventory(s, 60).map((u) => ({ ...productById(s, u.productId), ...u, age: Math.floor((Date.now() - new Date(u.acquiredAt).getTime()) / 86400000) })).sort((a, b) => b.age - a.age);
    const bucket = Number(days) > 90 ? 'month' : 'day';
    const series = bucket === 'day' ? dailySeries(s.transactions, Number(days)) : monthly(s.transactions);
    return { txs, sum, channel, inv, soldUnits, turnover: soldUnits / avgStock, purchases, creditIssued, creditRedeemed, aged, series, cats: byCategory(txs), pay: byPaymentMethod(txs), best: bestSellers(txs, 10), slow: aged.slice(0, 10) };
  }, [s, days]);
  const exportAll = () => download(`daybreak-report-${days}d.csv`, toCSV([
    { metric: 'Revenue (realised sales)', value: r.sum.revenue }, { metric: 'Cost of goods sold', value: r.sum.cogs }, { metric: 'Gross profit', value: r.sum.profit }, { metric: 'Gross margin %', value: Math.round(r.sum.margin * 1000) / 10 },
    { metric: 'Transactions', value: r.sum.count }, { metric: 'Average transaction', value: r.sum.avg }, { metric: 'Discounts / negotiation given', value: r.sum.discount },
    ...r.pay.map((p) => ({ metric: `Paid by ${p.name}`, value: p.value })), ...r.channel.map((c) => ({ metric: `Channel: ${c.name}`, value: c.value })), ...r.cats.map((c) => ({ metric: `Category: ${c.name}`, value: c.value })),
    { metric: 'Store credit issued', value: r.creditIssued }, { metric: 'Store credit redeemed', value: r.creditRedeemed }, { metric: 'Stock value at cost', value: r.inv.cost }, { metric: 'Stock value at asking', value: r.inv.ask },
  ]), 'text/csv');

  const content = (
    <>
      <div className="kpis">
        <KPI accent k="Revenue" v={aud(r.sum.revenue, { round: true })} d="Realised sale value" />
        <KPI k="Cost of goods sold" v={aud(r.sum.cogs, { round: true })} />
        <KPI k="Gross profit" v={aud(r.sum.profit, { round: true })} d={`${Math.round(r.sum.margin * 100)}% margin`} />
        <KPI k="Avg selling price" v={aud(r.sum.avg)} d={`${r.sum.count} transactions`} />
        <KPI k="Discounts given" v={aud(r.sum.discount, { round: true })} d="Listed minus sold price" />
        <KPI k="Stock at cost" v={aud(r.inv.cost, { round: true })} d={`At asking ${aud(r.inv.ask, { round: true })}`} />
        <KPI k="Stock turnover" v={r.turnover.toFixed(2) + '×'} d={`${r.soldUnits} units sold vs ${r.inv.qty} on hand`} />
        <KPI k="Store credit" v={aud(r.creditIssued)} d={`issued · ${aud(r.creditRedeemed)} redeemed`} />
      </div>
      <div className="dash-grid">
        <div className="panel span-8"><h3>Revenue and gross profit</h3><TwoLines data={r.series} a={{ key: 'revenue', name: 'Revenue' }} b={{ key: 'profit', name: 'Gross profit' }} height={260} /></div>
        <div className="panel span-4"><h3>Sales by channel</h3><BarSeries data={r.channel} x="name" name="Revenue" layout="vertical" /></div>
        <div className="panel span-6"><h3>Sales by category</h3><BarSeries data={r.cats} x="name" name="Revenue" layout="vertical" /></div>
        <div className="panel span-6"><h3>By payment method</h3><BarSeries data={r.pay} x="name" name="Amount" layout="vertical" />
          <p className="tiny muted">Trade-in shows the part of sales paid with customer cards. Cash, card and bank are money received.</p></div>
        <div className="panel span-6"><h3>Best-selling products</h3><table className="t"><thead><tr><th>Product</th><th className="num">Qty</th><th className="num">Revenue</th><th className="num">Profit</th></tr></thead><tbody>{r.best.map((b) => <tr key={b.name}><td className="small">{b.name}</td><td className="num">{b.qty}</td><td className="num">{aud(b.revenue)}</td><td className="num">{aud(b.profit)}</td></tr>)}</tbody></table></div>
        <div className="panel span-6"><h3>Aged & slow-moving stock (60+ days)</h3>{r.slow.length ? <table className="t"><thead><tr><th>Item</th><th className="num">Days</th><th className="num">Cost</th><th className="num">Asking</th></tr></thead><tbody>{r.slow.map((u) => <tr key={u.id}><td className="small">{u.name}{u.grade ? ` PSA ${u.grade}` : ''}<div className="cell-sub">{TYPE_LABEL[u.type]} · {u.sku}</div></td><td className="num">{u.age}</td><td className="num">{aud(u.cost * u.qty)}</td><td className="num">{aud(u.ask * u.qty)}</td></tr>)}</tbody></table> : <p className="muted small">Nothing older than 60 days.</p>}</div>
        <div className="panel span-12"><h3>Transaction breakdown</h3>
          <table className="t"><thead><tr><th>Type</th><th className="num">Count</th><th className="num">Merchandise out</th><th className="num">Cards in</th><th className="num">Cash</th><th className="num">Card</th><th className="num">Bank</th><th className="num">Credit redeemed</th><th className="num">Credit issued</th></tr></thead>
            <tbody>{['sale', 'trade', 'purchase', 'refund'].map((k) => { const ts = r.txs.filter((t) => t.kind === k); const by = (m) => aud(ts.reduce((a, t) => a + t.payments.filter((p) => p.method === m).reduce((b, p) => b + p.amount, 0), 0)); return <tr key={k}><td className="cell-title" style={{ textTransform: 'capitalize' }}>{k}s</td><td className="num">{ts.length}</td><td className="num">{aud(ts.reduce((a, t) => a + txTotals(t).merch, 0))}</td><td className="num">{aud(ts.reduce((a, t) => a + txTotals(t).tradeIn, 0))}</td><td className="num">{by('cash')}</td><td className="num">{by('card')}</td><td className="num">{by('bank')}</td><td className="num">{by('credit')}</td><td className="num">{aud(ts.reduce((a, t) => a + (t.creditIssued || 0), 0))}</td></tr>; })}</tbody></table>
          <p className="tiny muted" style={{ marginTop: 8 }}>Negative cash on purchases is money paid out. Revenue counts merchandise at its realised sale price, never its market value.</p>
        </div>
      </div>
    </>
  );
  return (
    <>
      <div className="page-head no-print"><div><h1>Reports</h1><p>Built from actual transactions and inventory movements.</p></div>
        <div className="row wrap"><Seg value={days} onChange={setDays} options={Object.entries(RANGES).map(([value, label]) => ({ value, label }))} />
          <button className="btn secondary" onClick={exportAll}><Icon name="download" size={16} />CSV</button>
          <button className="btn secondary" onClick={() => { setPrinting(true); setTimeout(() => { window.print(); setPrinting(false); }, 300); }}><Icon name="printer" size={16} />PDF</button></div></div>
      <div className={printing ? 'print-area doc' : ''}>{printing && <h2 className="serif" style={{ color: '#00009E', marginBottom: 12 }}>Daybreak Collectibles · {RANGES[days]} · generated {fmtDate(new Date().toISOString(), true)}</h2>}{content}</div>
    </>
  );
}

function monthly(txs) {
  const out = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); out.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }), revenue: 0, profit: 0 }); }
  const idx = new Map(out.map((o, i) => [o.key, i]));
  for (const t of txs) { if (!isSale(t)) continue; const d = new Date(t.at); const i = idx.get(`${d.getFullYear()}-${d.getMonth()}`); if (i === undefined) continue; const x = txTotals(t); out[i].revenue = r2(out[i].revenue + x.merch); out[i].profit = r2(out[i].profit + x.profit); }
  return out;
}
