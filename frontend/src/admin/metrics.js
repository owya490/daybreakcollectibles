// All business metrics are computed from transaction and inventory records.
// Revenue = realised sale value (after negotiation/discounts). Profit = revenue - cost of goods sold.
// Market value is never treated as revenue.
import { txTotals } from '../data/db.js';
import { r2, startOfDay, TYPE_LABEL } from '../lib/util.js';

export const SERIES = { s1: '#2D5F9A', s2: '#B8791C', grid: 'rgba(18,49,86,0.09)', axis: '#7b8597' }; // validated pair: brand navy (lifted for legibility) + gold

export const isSale = (t) => t.kind === 'sale' || t.kind === 'trade' || t.kind === 'refund';
export function inRange(t, from, to = new Date()) { const d = new Date(t.at); return d >= from && d <= to; }

export function saleSummary(txs) {
  let revenue = 0, cogs = 0, count = 0, discount = 0, tradeInApplied = 0;
  for (const t of txs) {
    if (!isSale(t)) continue;
    const x = txTotals(t);
    if (!x.merch && !t.lines.length) continue;
    revenue += x.merch; cogs += x.cogs; discount += Math.max(0, x.discount);
    tradeInApplied += Math.min(x.tradeIn, Math.max(0, x.merch));
    if (t.kind !== 'refund') count += 1;
  }
  revenue = r2(revenue); cogs = r2(cogs);
  return { revenue, cogs, profit: r2(revenue - cogs), margin: revenue ? (revenue - cogs) / revenue : 0, count, avg: count ? r2(revenue / count) : 0, discount: r2(discount), tradeInApplied: r2(tradeInApplied) };
}

export function dailySeries(txs, days = 30) {
  const out = [];
  const start = startOfDay(new Date(Date.now() - (days - 1) * 86400000));
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    out.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }), revenue: 0, profit: 0, count: 0 });
  }
  const idx = new Map(out.map((o, i) => [o.key, i]));
  for (const t of txs) {
    if (!isSale(t)) continue;
    const k = startOfDay(new Date(t.at)).toISOString().slice(0, 10);
    const i = idx.get(k);
    if (i === undefined) continue;
    const x = txTotals(t);
    out[i].revenue = r2(out[i].revenue + x.merch);
    out[i].profit = r2(out[i].profit + x.profit);
    if (t.kind !== 'refund') out[i].count += 1;
  }
  return out;
}

export function byCategory(txs) {
  const m = {};
  for (const t of txs) {
    if (!isSale(t)) continue;
    for (const l of t.lines) { const k = TYPE_LABEL[l.type] || 'Other'; m[k] = r2((m[k] || 0) + l.price * l.qty); }
  }
  return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export const METHOD_LABEL = { cash: 'Cash', card: 'Card', bank: 'Bank transfer', credit: 'Store credit', trade: 'Trade-in' };
export function byPaymentMethod(txs) {
  const m = { cash: 0, card: 0, bank: 0, credit: 0, trade: 0 };
  for (const t of txs) {
    if (!isSale(t)) continue;
    for (const p of t.payments) if (p.amount > 0 || t.kind === 'refund') m[p.method] = r2((m[p.method] || 0) + p.amount);
    const x = txTotals(t);
    if (x.tradeIn > 0) m.trade = r2(m.trade + Math.min(x.tradeIn, Math.max(0, x.merch)));
  }
  return Object.entries(m).map(([k, value]) => ({ key: k, name: METHOD_LABEL[k], value })).filter((x) => x.value !== 0);
}

export function bestSellers(txs, n = 8) {
  const m = new Map();
  for (const t of txs) {
    if (!isSale(t)) continue;
    for (const l of t.lines) {
      const k = l.productId || l.name;
      const e = m.get(k) || { name: l.name, qty: 0, revenue: 0, profit: 0 };
      e.qty += Math.sign(l.price) * l.qty; e.revenue = r2(e.revenue + l.price * l.qty); e.profit = r2(e.profit + (l.price - (l.cost || 0)) * l.qty);
      m.set(k, e);
    }
  }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue).slice(0, n);
}

/** Inventory value over time, reconstructed from acquisition and sale dates (estimate) merged with daily snapshots. */
export function inventoryValueSeries(s, days = 30) {
  const out = [];
  const end = startOfDay();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 86400000 + 86399999);
    let ask = 0, cost = 0;
    for (const u of s.units) {
      if (u.status === 'archived') continue;
      if (new Date(u.acquiredAt || u.createdAt) > d) continue;
      if (u.status === 'sold' && u.soldAt && new Date(u.soldAt) <= d) continue;
      const q = Math.max(u.qty, u.status === 'sold' ? 1 : 0);
      ask += q * (u.ask || 0); cost += q * (u.cost || 0);
    }
    const snap = s.snapshots.find((x) => x.day === d.toISOString().slice(0, 10));
    out.push({ label: d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }), ask: r2(snap?.ask ?? ask), cost: r2(snap?.cost ?? cost) });
  }
  return out;
}

export function agedInventory(s, minDays = 60) {
  return s.units.filter((u) => u.status === 'available' && u.qty > 0 && Date.now() - new Date(u.acquiredAt || u.createdAt).getTime() > minDays * 86400000);
}
