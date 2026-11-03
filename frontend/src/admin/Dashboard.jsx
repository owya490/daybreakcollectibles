import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDB, inventoryTotals, creditBalance, productById, txTotals } from '../data/db.js';
import { ProductImage } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { BarSeries, TwoLines } from './charts.jsx';
import { saleSummary, dailySeries, byCategory, byPaymentMethod, bestSellers, inventoryValueSeries, inRange } from './metrics.js';
import { aud, startOfDay, daysAgo, fmtDate, timeAgo, TYPE_LABEL } from '../lib/util.js';

export function KPI({ k, v, d, accent }) {
  return <div className={'kpi' + (accent ? ' accent' : '')}><div className="k">{k}</div><div className="v">{v}</div>{d && <div className="d">{d}</div>}</div>;
}

export default function Dashboard() {
  const s = useDB();
  const m = useMemo(() => {
    const tx = s.transactions;
    const today = saleSummary(tx.filter((t) => inRange(t, startOfDay())));
    const week = saleSummary(tx.filter((t) => inRange(t, daysAgo(7))));
    const month = saleSummary(tx.filter((t) => inRange(t, daysAgo(30))));
    const inv = inventoryTotals(s);
    const credit = s.customers.reduce((a, c) => a + Math.max(0, creditBalance(s, c.id)), 0);
    const awaiting = s.orders.filter((o) => ['paid', 'processing', 'awaiting_payment'].includes(o.status));
    const low = s.units.filter((u) => u.status === 'available' && u.qty > 0 && u.qty <= 2 && ['sealed', 'guard'].includes(productById(s, u.productId)?.type));
    const recent = [...s.units].filter((u) => u.status !== 'archived').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
    const last30 = tx.filter((t) => inRange(t, daysAgo(30)));
    return { today, week, month, inv, credit, awaiting, low, recent, daily: dailySeries(tx, 30), cats: byCategory(last30), pay: byPaymentMethod(last30), best: bestSellers(last30, 6), invSeries: inventoryValueSeries(s, 30) };
  }, [s]);

  return (
    <>
      <div className="page-head">
        <div><h1>Dashboard</h1><p>{new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
        <div className="row wrap">
          <Link to="/admin/inventory/new" className="btn secondary"><Icon name="plus" size={16} />Add stock</Link>
          <Link to="/admin/show" className="btn danger"><Icon name="bolt" size={16} />Card Show Mode</Link>
        </div>
      </div>
      <div className="kpis">
        <KPI accent k="Inventory at asking" v={aud(m.inv.ask, { round: true })} d={`Cost ${aud(m.inv.cost, { round: true })} · ${m.inv.cost ? Math.round(((m.inv.ask - m.inv.cost) / m.inv.ask) * 100) : 0}% potential margin`} />
        <KPI k="Units in stock" v={m.inv.qty} d={`${m.inv.skus} unique SKUs`} />
        <KPI k="Sales today" v={aud(m.today.revenue)} d={`${m.today.count} transactions`} />
        <KPI k="Sales this week" v={aud(m.week.revenue, { round: true })} d={`Profit ${aud(m.week.profit, { round: true })}`} />
        <KPI k="Sales this month" v={aud(m.month.revenue, { round: true })} d={`${m.month.count} transactions`} />
        <KPI k="Gross profit (30d)" v={aud(m.month.profit, { round: true })} d={`${Math.round(m.month.margin * 100)}% margin`} />
        <KPI k="Avg transaction (30d)" v={aud(m.month.avg)} />
        <KPI k="Outstanding store credit" v={aud(m.credit)} d="Liability owed to customers" />
        <KPI k="Orders to fulfil" v={m.awaiting.length} d={<Link to="/admin/orders" style={{ textDecoration: 'underline' }}>Open orders</Link>} />
      </div>

      <div className="dash-grid">
        <div className="panel span-8"><h3>Sales and gross profit, last 30 days</h3><TwoLines data={m.daily} a={{ key: 'revenue', name: 'Revenue' }} b={{ key: 'profit', name: 'Gross profit' }} /></div>
        <div className="panel span-4"><h3>Revenue by category (30d)</h3><BarSeries data={m.cats} x="name" name="Revenue" layout="vertical" /></div>
        <div className="panel span-4"><h3>Sales by payment method (30d)</h3><BarSeries data={m.pay} x="name" name="Amount" layout="vertical" /></div>
        <div className="panel span-8"><h3>Inventory value over time <span className="tiny muted" style={{ fontWeight: 400 }}>estimated from acquisition and sale dates</span></h3><TwoLines data={m.invSeries} a={{ key: 'ask', name: 'At asking price' }} b={{ key: 'cost', name: 'At cost' }} /></div>

        <div className="panel span-6">
          <h3>Best sellers (30d) <Link to="/admin/reports" className="small" style={{ color: 'var(--indigo)' }}>Reports</Link></h3>
          {m.best.length ? <table className="t"><thead><tr><th>Product</th><th className="num">Qty</th><th className="num">Revenue</th><th className="num">Profit</th></tr></thead>
            <tbody>{m.best.map((b) => <tr key={b.name}><td>{b.name}</td><td className="num">{b.qty}</td><td className="num">{aud(b.revenue)}</td><td className="num">{aud(b.profit)}</td></tr>)}</tbody></table> : <p className="muted">No sales yet.</p>}
        </div>
        <div className="panel span-6">
          <h3>Recent transactions <Link to="/admin/transactions" className="small" style={{ color: 'var(--indigo)' }}>All</Link></h3>
          <table className="t"><tbody>{s.transactions.slice(0, 7).map((t) => { const x = txTotals(t); return (
            <tr key={t.id}><td><span className="badge grey">{t.kind}</span> <span className="small">{t.channel}</span></td><td className="small">{t.lines[0]?.name || t.incoming[0]?.name || '-'}{t.lines.length + t.incoming.length > 1 ? ` +${t.lines.length + t.incoming.length - 1}` : ''}</td><td className="small muted">{timeAgo(t.at)}</td><td className="num">{aud(t.kind === 'purchase' ? -x.tradeIn : x.merch)}</td></tr>
          ); })}</tbody></table>
        </div>
        <div className="panel span-6">
          <h3>Recently added <Link to="/admin/inventory" className="small" style={{ color: 'var(--indigo)' }}>Inventory</Link></h3>
          <div className="stack tight">{m.recent.map((u) => { const p = productById(s, u.productId); return (
            <div key={u.id} className="row"><div className="thumb-sm"><ProductImage product={p} compact /></div><div className="grow"><div className="cell-title small">{p?.name}{u.grade ? ` · PSA ${u.grade}` : ''}</div><div className="cell-sub">{TYPE_LABEL[p?.type]} · {u.sku} · {fmtDate(u.createdAt)}</div></div><b>{aud(u.ask)}</b>{!u.published && <span className="badge grey">Hidden</span>}</div>
          ); })}</div>
        </div>
        <div className="panel span-6">
          <h3>Low-stock alerts</h3>
          {m.low.length ? <div className="stack tight">{m.low.map((u) => { const p = productById(s, u.productId); return <div key={u.id} className="row between"><span className="small">{p?.name}</span><span className="badge amber">{u.qty} left</span></div>; })}</div> : <p className="muted small">Sealed and guard stock levels look healthy.</p>}
          {m.awaiting.length > 0 && <><hr className="divider" style={{ margin: '14px 0' }} /><div className="row between"><b className="small">Online orders awaiting fulfilment</b><Link className="btn sm" to="/admin/orders">{m.awaiting.length} open</Link></div></>}
        </div>
      </div>
    </>
  );
}
