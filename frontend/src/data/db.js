// =============================================================================
// Daybreak data layer: ONE source of truth for storefront, admin and POS.
//
// This build persists to the browser (localStorage) and syncs across open tabs
// via the `storage` event, so a sale in Card Show Mode instantly removes the item
// from the storefront in another tab. Every mutation goes through the functions
// below, which are written as atomic "transactions" (validate -> apply -> audit),
// so swapping this module for a Supabase/Postgres repository is a contained change.
// See docs/ARCHITECTURE.md for the production schema and concurrency design.
// =============================================================================
import { useSyncExternalStore, useMemo } from 'react';
import { uid, r2, sum, startOfDay } from '../lib/util.js';
import { SEED_LOCATIONS, SEED_PRODUCTS, SEED_UNITS, SEED_CUSTOMERS, SEED_SETTINGS, seedTransactions } from './seed.js';

const KEY = 'daybreak-db-v1';
const listeners = new Set();
let state = load();

function freshState() {
  const { tx, ledger } = seedTransactions();
  return {
    version: 1,
    products: SEED_PRODUCTS,
    units: SEED_UNITS,
    locations: SEED_LOCATIONS,
    customers: SEED_CUSTOMERS,
    ledger,
    transactions: tx,
    orders: [],
    audit: [],
    priceHistory: [],
    snapshots: [],
    outbox: [],
    settings: SEED_SETTINGS,
    seededAt: new Date().toISOString(),
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      s.settings = { ...SEED_SETTINGS, ...s.settings, integrations: { ...SEED_SETTINGS.integrations, ...(s.settings?.integrations || {}) } };
      // Brand refresh: replace the original placeholder copy if it was never edited
      if (s.settings.banners?.[0]?.title === 'The Asian TCG specialist') s.settings.banners = SEED_SETTINGS.banners;
      if (s.settings.business?.instagram === 'https://instagram.com/') s.settings.business = { ...s.settings.business, instagram: SEED_SETTINGS.business.instagram };
      return s;
    }
  } catch { /* storage unavailable or corrupt: fall back to fresh demo state */ }
  return freshState();
}

let saveError = null;
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); saveError = null; }
  catch (e) { saveError = e; console.warn('Daybreak: could not persist', e); }
}
export const getSaveError = () => saveError;

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY && e.newValue) {
      try { state = JSON.parse(e.newValue); listeners.forEach((l) => l()); } catch { /* ignore */ }
    }
  });
}

export const getState = () => state;
function commit(next, audit) {
  state = next;
  if (audit) {
    state = { ...state, audit: [{ id: 'a-' + uid(), at: new Date().toISOString(), actor: 'admin', ...audit }, ...state.audit].slice(0, 2000) };
  }
  persist();
  listeners.forEach((l) => l());
}
function subscribe(l) { listeners.add(l); return () => listeners.delete(l); }

export function useDB(selector = (s) => s) {
  const s = useSyncExternalStore(subscribe, getState, getState);
  return selector(s);
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------
const now = () => new Date().toISOString();

export function activeReservations(unit, exceptHolder) {
  const t = Date.now();
  return (unit.reservations || []).filter((r) => new Date(r.until).getTime() > t && r.holder !== exceptHolder);
}
export function availableQty(unit, exceptHolder) {
  if (unit.status !== 'available') return 0;
  const reserved = activeReservations(unit, exceptHolder).reduce((a, r) => a + r.qty, 0);
  return Math.max(0, (unit.qty || 0) - reserved);
}
export const productById = (s, id) => s.products.find((p) => p.id === id);
export const unitById = (s, id) => s.units.find((u) => u.id === id);
export const locationPath = (s, id) => {
  const parts = [];
  let cur = s.locations.find((l) => l.id === id);
  let guard = 0;
  while (cur && guard++ < 10) { parts.unshift(cur.name); cur = s.locations.find((l) => l.id === cur.parentId); }
  return parts.join(' / ') || 'Unassigned';
};

/** A storefront listing = a published physical unit joined with its catalogue product. */
export function listings(s, { includeSold = false } = {}) {
  const out = [];
  for (const u of s.units) {
    if (!u.published || u.status === 'archived') continue;
    if (!includeSold && u.status === 'sold') continue;
    const p = productById(s, u.productId);
    if (!p) continue;
    out.push({ ...p, ...u, unitId: u.id, productId: p.id, available: availableQty(u), product: p });
  }
  return out;
}

export function creditBalance(s, customerId) {
  return r2(s.ledger.filter((l) => l.customerId === customerId).reduce((a, l) => a + l.amount, 0));
}

export function fxToAud(s, value, currency) {
  if (value === null || value === undefined) return null;
  const fx = s.settings.fx;
  if (currency === 'AUD') return r2(value);
  if (currency === 'USD') return r2(value * fx.usdAud);
  if (currency === 'EUR') return r2(value * fx.eurAud);
  if (currency === 'JPY') return r2(value * fx.jpyAud);
  return null;
}

export function txTotals(t) {
  const merch = sum(t.lines || [], (l) => l.price * l.qty);
  const cogs = sum(t.lines || [], (l) => (l.cost || 0) * l.qty);
  const tradeIn = sum(t.incoming || [], (i) => i.agreedValue * i.qty);
  const paid = sum(t.payments || [], (p) => p.amount);
  const creditIssued = r2(t.creditIssued || 0);
  const listed = sum(t.lines || [], (l) => (l.ask ?? l.price) * l.qty);
  return { merch, cogs, tradeIn, paid, creditIssued, listed, discount: r2(listed - merch), profit: r2(merch - cogs) };
}

export function useListings(opts) {
  const s = useDB();
  return useMemo(() => listings(s, opts), [s, opts?.includeSold]);
}

// ---------------------------------------------------------------------------
// Catalogue & inventory
// ---------------------------------------------------------------------------
export const productKey = (p) => [p.type, p.name, p.set, p.number, p.language, p.variant].map((x) => String(x || '').trim().toLowerCase()).join('|');

export function findDuplicateProduct(s, p) {
  const k = productKey(p);
  return s.products.find((x) => productKey(x) === k && !x.archived);
}
export function findCert(s, cert) {
  if (!cert) return null;
  const c = String(cert).trim();
  return s.units.find((u) => u.cert && String(u.cert).trim() === c && u.status !== 'archived');
}

let skuSeq = 0;
export function nextSku(s, type) {
  const prefix = { slab: 'PSA', single: 'RAW', sealed: 'SLD', guard: 'EAG' }[type] || 'GEN';
  const nums = s.units.map((u) => parseInt(String(u.sku).split('-').pop(), 10)).filter(Number.isFinite);
  const n = Math.max(1000, ...nums) + 1 + skuSeq++;
  return `DB-${prefix}-${n}`;
}

function makeUnit(s, product, u) {
  const t = now();
  const unit = {
    id: 'u-' + uid(), productId: product.id, sku: u.sku || nextSku(s, product.type), qty: 1, status: 'available', published: true,
    condition: '', grade: '', cert: '', certVerified: false, cost: 0, ask: 0, market: null, locationId: null, notes: '',
    createdAt: t, updatedAt: t, acquiredAt: t, labelPrintedAt: null, negotiable: false, reservations: [], ...u,
  };
  if (product.type === 'slab') unit.qty = 1; // slabs are always individually tracked
  return unit;
}

/**
 * Add a product (or reuse an identical catalogue product) plus physical units.
 * Throws if a PSA cert number is already in inventory (prevents double-counting).
 */
export function addInventory({ product, units, reuseProductId }) {
  const s = state;
  for (const u of units) {
    const dup = findCert(s, u.cert);
    if (dup) throw new Error(`PSA cert ${u.cert} is already in inventory (${dup.sku}).`);
  }
  let prod = reuseProductId ? productById(s, reuseProductId) : null;
  let products = s.products;
  if (!prod) {
    prod = { id: 'p-' + uid(), images: [], description: '', compatibleGuardIds: [], featured: false, createdAt: now(), ...product };
    products = [prod, ...products];
  }
  const newUnits = units.map((u) => makeUnit(s, prod, u));
  const priceHistory = [...newUnits.filter((u) => u.market).map((u) => ({ id: uid(), unitId: u.id, productId: prod.id, at: now(), ...u.market })), ...s.priceHistory];
  commit({ ...s, products, units: [...newUnits, ...s.units], priceHistory }, { action: 'inventory.add', entity: 'unit', entityId: newUnits.map((u) => u.sku).join(', '), detail: prod.name });
  return { product: prod, units: newUnits };
}

export function updateProduct(id, patch) {
  const s = state;
  commit({ ...s, products: s.products.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: now() } : p)) }, { action: 'product.update', entity: 'product', entityId: id, detail: Object.keys(patch).join(', ') });
}

export function updateUnits(ids, patchOrFn, action = 'unit.update') {
  const s = state;
  const set = new Set(ids);
  const units = s.units.map((u) => {
    if (!set.has(u.id)) return u;
    const patch = typeof patchOrFn === 'function' ? patchOrFn(u) : patchOrFn;
    const next = { ...u, ...patch, updatedAt: now() };
    if (u.type === 'slab' || productById(s, u.productId)?.type === 'slab') next.qty = Math.min(1, next.qty);
    if (next.qty <= 0 && next.status === 'available') next.status = 'sold';
    if (next.qty > 0 && u.status === 'sold' && patch.qty !== undefined) next.status = 'available';
    return next;
  });
  const sample = typeof patchOrFn === 'function' ? 'computed' : Object.keys(patchOrFn).join(', ');
  commit({ ...s, units }, { action, entity: 'unit', entityId: ids.length === 1 ? (unitById(s, ids[0])?.sku || ids[0]) : `${ids.length} units`, detail: sample });
}

export function duplicateUnit(id) {
  const s = state;
  const u = unitById(s, id);
  const p = productById(s, u.productId);
  const copy = makeUnit(s, p, { ...u, id: undefined, sku: undefined, cert: '', certVerified: false, reservations: [], status: 'available', labelPrintedAt: null });
  delete copy.undefined;
  commit({ ...s, units: [copy, ...s.units] }, { action: 'unit.duplicate', entity: 'unit', entityId: copy.sku, detail: `from ${u.sku}` });
  return copy;
}

export function recordMarketPrice(unitIds, market) {
  const s = state;
  const set = new Set(unitIds);
  const units = s.units.map((u) => (set.has(u.id) ? { ...u, market, updatedAt: now() } : u));
  const hist = unitIds.map((id) => ({ id: uid(), unitId: id, productId: unitById(s, id)?.productId, at: now(), ...market }));
  commit({ ...s, units, priceHistory: [...hist, ...s.priceHistory].slice(0, 5000) }, { action: 'pricing.market', entity: 'unit', entityId: `${unitIds.length} units`, detail: `${market.source} ${market.currency} ${market.value}` });
}

// ---------------------------------------------------------------------------
// Reservations (prevents two customers buying the same unique item)
// ---------------------------------------------------------------------------
export function reserve(items, holder, minutes) {
  const s = state;
  const mins = minutes ?? s.settings.reservationMinutes ?? 15;
  const errors = [];
  for (const it of items) {
    const u = unitById(s, it.unitId);
    if (!u) { errors.push({ unitId: it.unitId, message: 'Item no longer exists' }); continue; }
    const avail = availableQty(u, holder);
    if (avail < it.qty) errors.push({ unitId: it.unitId, message: avail === 0 ? 'Just sold or held by another customer' : `Only ${avail} available` });
  }
  if (errors.length) return { ok: false, errors };
  const until = new Date(Date.now() + mins * 60000).toISOString();
  const map = new Map(items.map((i) => [i.unitId, i.qty]));
  const units = s.units.map((u) => {
    if (!map.has(u.id)) return u;
    const others = (u.reservations || []).filter((r) => r.holder !== holder && new Date(r.until) > new Date());
    return { ...u, reservations: [...others, { holder, qty: map.get(u.id), until }] };
  });
  commit({ ...s, units });
  return { ok: true, until };
}

export function release(holder) {
  const s = state;
  if (!s.units.some((u) => (u.reservations || []).some((r) => r.holder === holder))) return;
  commit({ ...s, units: s.units.map((u) => (u.reservations?.length ? { ...u, reservations: u.reservations.filter((r) => r.holder !== holder) } : u)) });
}

// ---------------------------------------------------------------------------
// Customers & store credit
// ---------------------------------------------------------------------------
export function upsertCustomer(c) {
  const s = state;
  if (c.id && s.customers.some((x) => x.id === c.id)) {
    commit({ ...s, customers: s.customers.map((x) => (x.id === c.id ? { ...x, ...c } : x)) }, { action: 'customer.update', entity: 'customer', entityId: c.id, detail: c.name });
    return c.id;
  }
  const existing = c.email && s.customers.find((x) => x.email && x.email.toLowerCase() === c.email.toLowerCase());
  if (existing) return existing.id;
  const id = 'c-' + uid();
  commit({ ...s, customers: [{ id, createdAt: now(), phone: '', notes: '', ...c }, ...s.customers] }, { action: 'customer.create', entity: 'customer', entityId: id, detail: c.name });
  return id;
}

export function adjustCredit(customerId, amount, reason, { authorisedNegative = false } = {}) {
  const s = state;
  const bal = creditBalance(s, customerId);
  if (bal + amount < -0.001 && !authorisedNegative && !s.settings.allowNegativeCredit) throw new Error(`Insufficient store credit. Balance is $${bal.toFixed(2)}.`);
  const entry = { id: 'l-' + uid(), customerId, amount: r2(amount), reason, txId: null, at: now() };
  commit({ ...s, ledger: [entry, ...s.ledger] }, { action: 'credit.adjust', entity: 'customer', entityId: customerId, detail: `${amount > 0 ? '+' : ''}${amount} ${reason}` });
}

// ---------------------------------------------------------------------------
// Sales, trades & purchases. Atomic: validates everything before writing anything.
// ---------------------------------------------------------------------------
/**
 * @param {object} p
 *  lines:    [{unitId, qty, price}]   Daybreak stock going out (price = negotiated per-copy price)
 *  incoming: [{product, unit, agreedValue, qty, market}] Customer cards coming in (trade-ins)
 *  payments: [{method, amount}]       +received / -paid out. method: cash|card|bank|credit
 *  creditIssued: number               Store credit issued to customer in this transaction
 */
export function recordTransaction(p) {
  const s = state;
  const { kind = 'sale', channel = 'pos', lines = [], incoming = [], payments = [], creditIssued = 0, customerId = null, notes = '', holder = null, idempotencyKey = uid('idem-'), orderId = null } = p;
  if (s.transactions.some((t) => t.idempotencyKey === idempotencyKey)) {
    return s.transactions.find((t) => t.idempotencyKey === idempotencyKey); // duplicate submit (e.g. offline resync)
  }
  // Validate stock
  const outLines = lines.map((l) => {
    const u = unitById(s, l.unitId);
    if (!u) throw new Error('An item in this transaction no longer exists.');
    const prod = productById(s, u.productId);
    const avail = availableQty(u, holder);
    if (avail < l.qty) throw new Error(`${prod?.name || u.sku}: only ${avail} available (may have just sold).`);
    return { unitId: u.id, productId: prod.id, sku: u.sku, name: prod.name + (u.grade ? ` PSA ${u.grade}` : ''), type: prod.type, qty: l.qty, ask: u.ask, price: r2(l.price), cost: u.cost || 0 };
  });
  // Validate credit
  const creditUsed = sum(payments.filter((x) => x.method === 'credit'), (x) => x.amount);
  if (creditUsed > 0) {
    if (!customerId) throw new Error('Select a customer to use store credit.');
    const bal = creditBalance(s, customerId);
    if (creditUsed > bal + 0.001 && !s.settings.allowNegativeCredit) throw new Error(`Customer only has $${bal.toFixed(2)} store credit.`);
  }
  if (creditIssued > 0 && !customerId) throw new Error('Select or create a customer to issue store credit.');
  // Balance check: merch - tradeIn - payments + creditIssued must be 0
  const merch = sum(outLines, (l) => l.price * l.qty);
  const tradeIn = sum(incoming, (i) => i.agreedValue * i.qty);
  const paid = sum(payments, (x) => x.amount);
  const remaining = r2(merch - tradeIn - paid + creditIssued);
  if (Math.abs(remaining) > 0.009) throw new Error(remaining > 0 ? `$${remaining.toFixed(2)} still owed by customer.` : `$${(-remaining).toFixed(2)} still owed to customer. Record a payout or issue credit.`);

  // Apply
  const t = now();
  const txId = 't-' + uid();
  const qtyOut = new Map(outLines.map((l) => [l.unitId, l.qty]));
  let units = s.units.map((u) => {
    if (!qtyOut.has(u.id)) return u;
    const q = u.qty - qtyOut.get(u.id);
    return { ...u, qty: q, status: q <= 0 ? 'sold' : u.status, soldAt: q <= 0 ? t : u.soldAt, updatedAt: t, reservations: (u.reservations || []).filter((r) => r.holder !== holder) };
  });
  let products = s.products;
  const incomingRecs = [];
  for (const inc of incoming) {
    let prod = inc.productId ? productById({ products }, inc.productId) : findDuplicateProduct({ products }, inc.product);
    if (!prod) { prod = { id: 'p-' + uid(), images: [], description: '', compatibleGuardIds: [], featured: false, createdAt: t, ...inc.product }; products = [prod, ...products]; }
    if (inc.unit?.cert && findCert({ units }, inc.unit.cert)) throw new Error(`PSA cert ${inc.unit.cert} is already in inventory.`);
    const nu = makeUnit({ ...s, units }, prod, { cost: inc.agreedValue, ask: inc.unit?.ask || 0, published: false, qty: inc.qty, ...inc.unit, acquiredAt: t, market: inc.market || null });
    units = [nu, ...units];
    incomingRecs.push({ productId: prod.id, unitId: nu.id, sku: nu.sku, name: prod.name + (nu.grade ? ` PSA ${nu.grade}` : ''), qty: inc.qty, agreedValue: r2(inc.agreedValue), market: inc.market?.aud ?? null });
  }
  const ledger = [...s.ledger];
  if (creditUsed > 0) ledger.unshift({ id: 'l-' + uid(), customerId, amount: -creditUsed, reason: `Redeemed (${kind} ${channel})`, txId, at: t });
  if (creditIssued > 0) ledger.unshift({ id: 'l-' + uid(), customerId, amount: r2(creditIssued), reason: `Issued (${kind})`, txId, at: t });
  const realKind = kind === 'sale' && incoming.length && outLines.length ? 'trade' : kind;
  const tx = { id: txId, kind: realKind, channel, at: t, customerId, lines: outLines, incoming: incomingRecs, payments: payments.filter((x) => Math.abs(x.amount) > 0.001).map((x) => ({ method: x.method, amount: r2(x.amount) })), creditIssued: r2(creditIssued), notes, idempotencyKey, orderId };
  commit({ ...s, units, products, ledger, transactions: [tx, ...s.transactions] }, { action: `tx.${realKind}`, entity: 'transaction', entityId: txId, detail: `${channel} merch ${merch} trade-in ${tradeIn}` });
  return tx;
}

// ---------------------------------------------------------------------------
// Online orders
// ---------------------------------------------------------------------------
export const ORDER_STATUSES = ['awaiting_payment', 'paid', 'processing', 'shipped', 'completed', 'cancelled', 'refunded'];
export const ORDER_LABEL = { awaiting_payment: 'Awaiting payment', paid: 'Paid', processing: 'Processing', shipped: 'Shipped', completed: 'Completed', cancelled: 'Cancelled', refunded: 'Refunded' };

export function createOrder({ items, customer, shippingMethod, shipping, discountCode, discount, creditApplied, total, payment, holder }) {
  const s = state;
  const customerId = upsertCustomer({ name: customer.name, email: customer.email, phone: customer.phone || '' });
  const s2 = state;
  const number = 'DB' + String(1001 + s2.orders.length);
  const id = 'o-' + uid();
  const t = now();
  const order = { id, number, customerId, customer, items, shippingMethod, shipping, discountCode, discount, creditApplied, total, status: payment.status === 'paid' ? 'paid' : 'awaiting_payment', payment, tracking: null, history: [{ at: t, status: payment.status === 'paid' ? 'paid' : 'awaiting_payment', note: payment.status === 'paid' ? `Payment captured (${payment.provider})` : 'Awaiting bank transfer' }], createdAt: t, txId: null };
  if (order.status === 'paid') {
    const merch = sum(items, (i) => i.price * i.qty);
    // discount and credit are spread proportionally so line prices reflect real sale value
    const factor = merch > 0 ? (merch - (discount || 0)) / merch : 1;
    const lines = items.map((i) => ({ unitId: i.unitId, qty: i.qty, price: r2(i.price * factor) }));
    const linesTotal = sum(lines, (l) => l.price * l.qty);
    const payments = [{ method: 'card', amount: r2(linesTotal - (creditApplied || 0)) }];
    if (creditApplied) payments.push({ method: 'credit', amount: creditApplied });
    const tx = recordTransaction({ kind: 'sale', channel: 'online', lines, payments, customerId, holder, orderId: id, notes: `Online order ${number}` });
    order.txId = tx.id;
  } else {
    // Bank transfer: keep the stock held for 3 days until payment is confirmed in admin
    const r = reserve(items.map((i) => ({ unitId: i.unitId, qty: i.qty })), id, 60 * 24 * 3);
    if (!r.ok) throw new Error(r.errors[0].message);
    release(holder);
  }
  const s3 = state;
  commit({ ...s3, orders: [order, ...s3.orders] }, { action: 'order.create', entity: 'order', entityId: number, detail: `${order.status} ${total}` });
  return order;
}

export function updateOrder(id, patch, note) {
  const s = state;
  const o = s.orders.find((x) => x.id === id);
  if (!o) return;
  let txId = o.txId;
  if (patch.status === 'paid' && o.status === 'awaiting_payment') {
    const merch = sum(o.items, (i) => i.price * i.qty);
    const factor = merch > 0 ? (merch - (o.discount || 0)) / merch : 1;
    const lines = o.items.map((i) => ({ unitId: i.unitId, qty: i.qty, price: r2(i.price * factor) }));
    const linesTotal = sum(lines, (l) => l.price * l.qty);
    const payments = [{ method: 'bank', amount: r2(linesTotal - (o.creditApplied || 0)) }];
    if (o.creditApplied) payments.push({ method: 'credit', amount: o.creditApplied });
    txId = recordTransaction({ kind: 'sale', channel: 'online', lines, payments, customerId: o.customerId, holder: o.id, orderId: o.id, notes: `Online order ${o.number}` }).id;
  }
  if (patch.status === 'cancelled' && o.status === 'awaiting_payment') release(o.id);
  if (patch.status === 'refunded' && txId && patch.restock) {
    const s1 = state;
    const map = new Map(o.items.map((i) => [i.unitId, i.qty]));
    commit({ ...s1, units: s1.units.map((u) => (map.has(u.id) ? { ...u, qty: u.qty + map.get(u.id), status: 'available', updatedAt: now() } : u)) }, { action: 'order.restock', entity: 'order', entityId: o.number });
  }
  if (patch.status === 'refunded' && txId) {
    const s1 = state;
    const orig = s1.transactions.find((t) => t.id === txId);
    if (orig) {
      const refund = { id: 't-' + uid(), kind: 'refund', channel: 'online', at: now(), customerId: o.customerId, lines: orig.lines.map((l) => ({ ...l, price: -l.price, cost: patch.restock ? -l.cost : 0 })), incoming: [], payments: orig.payments.map((p) => ({ ...p, amount: -p.amount })), creditIssued: 0, notes: `Refund of ${o.number}`, idempotencyKey: 'refund-' + o.id, orderId: o.id };
      const ledger = orig.payments.some((p) => p.method === 'credit') ? [{ id: 'l-' + uid(), customerId: o.customerId, amount: o.creditApplied, reason: `Refund ${o.number}`, at: now() }, ...s1.ledger] : s1.ledger;
      commit({ ...s1, transactions: [refund, ...s1.transactions], ledger });
    }
  }
  const s2 = state;
  const { restock, ...clean } = patch;
  commit({ ...s2, orders: s2.orders.map((x) => (x.id === id ? { ...x, ...clean, txId, history: [...x.history, { at: now(), status: clean.status || x.status, note: note || '' }] } : x)) }, { action: 'order.update', entity: 'order', entityId: o.number, detail: `${clean.status || ''} ${note || ''}` });
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------
export function addLocation(name, parentId) {
  const s = state;
  const id = 'loc-' + uid();
  commit({ ...s, locations: [...s.locations, { id, name, parentId: parentId || null }] }, { action: 'location.create', entity: 'location', entityId: id, detail: name });
  return id;
}
export function renameLocation(id, name) {
  const s = state;
  commit({ ...s, locations: s.locations.map((l) => (l.id === id ? { ...l, name } : l)) }, { action: 'location.rename', entity: 'location', entityId: id, detail: name });
}
export function deleteLocation(id) {
  const s = state;
  if (s.units.some((u) => u.locationId === id && u.status !== 'sold')) throw new Error('Move the stock out of this location first.');
  if (s.locations.some((l) => l.parentId === id)) throw new Error('Remove or move child locations first.');
  commit({ ...s, locations: s.locations.filter((l) => l.id !== id) }, { action: 'location.delete', entity: 'location', entityId: id });
}

// ---------------------------------------------------------------------------
// Settings, snapshots, backup
// ---------------------------------------------------------------------------
export function updateSettings(patch, label = 'settings.update') {
  const s = state;
  commit({ ...s, settings: { ...s.settings, ...patch } }, { action: label, entity: 'settings', entityId: Object.keys(patch).join(', ') });
}
export function addNewsletter(email) {
  const s = state;
  if (s.settings.newsletter.includes(email)) return;
  commit({ ...s, settings: { ...s.settings, newsletter: [...s.settings.newsletter, email] } });
}

export function inventoryTotals(s) {
  let ask = 0, cost = 0, qty = 0, skus = 0;
  for (const u of s.units) {
    if (u.status !== 'available' && u.status !== 'reserved') continue;
    if (u.qty <= 0) continue;
    skus += 1; qty += u.qty; ask += u.qty * (u.ask || 0); cost += u.qty * (u.cost || 0);
  }
  return { ask: r2(ask), cost: r2(cost), qty, skus };
}

export function takeDailySnapshot() {
  const s = state;
  const day = startOfDay().toISOString().slice(0, 10);
  if (s.snapshots.some((x) => x.day === day)) return;
  const t = inventoryTotals(s);
  commit({ ...s, snapshots: [...s.snapshots, { day, ...t }].slice(-730) });
}

export function exportBackup() { return JSON.stringify(state, null, 2); }
export function importBackup(json) {
  const parsed = JSON.parse(json);
  if (!parsed.products || !parsed.units || !parsed.settings) throw new Error('Not a Daybreak backup file.');
  commit(parsed, { action: 'backup.restore', entity: 'db', entityId: 'all' });
}
export function clearDemoData() {
  const s = state;
  const demoProducts = new Set(s.products.filter((p) => p.demo).map((p) => p.id));
  commit({
    ...s,
    products: s.products.filter((p) => !p.demo),
    units: s.units.filter((u) => !u.demo && !demoProducts.has(u.productId)),
    customers: s.customers.filter((c) => !c.demo),
    ledger: s.ledger.filter((l) => !l.demo),
    transactions: s.transactions.filter((t) => !t.demo),
    snapshots: [],
    priceHistory: s.priceHistory.filter((h) => !demoProducts.has(h.productId)),
  }, { action: 'demo.clear', entity: 'db', entityId: 'demo' });
}
export function resetToDemo() { commit(freshState(), { action: 'demo.reset', entity: 'db', entityId: 'all' }); }
export const hasDemoData = (s) => s.products.some((p) => p.demo) || s.transactions.some((t) => t.demo);

// Offline outbox for POS (see Card Show Mode). In this local build writes are already
// durable on-device; the outbox records what must be pushed when a server backend is attached.
export function queueOutbox(entry) {
  const s = state;
  commit({ ...s, outbox: [...s.outbox, { id: uid(), at: now(), ...entry }] });
}
export function flushOutbox() {
  const s = state;
  if (!s.outbox.length) return 0;
  const n = s.outbox.length;
  commit({ ...s, outbox: [] }, { action: 'outbox.sync', entity: 'outbox', entityId: `${n} entries` });
  return n;
}
