// Pricing engine: market price is a REFERENCE; the asking price is always Daybreak's call.
import { getState, fxToAud, updateSettings } from '../data/db.js';
import { r2 } from '../lib/util.js';

export const PRICING_MODES = [
  { id: 'market', label: 'Asking = market price' },
  { id: 'margin', label: 'Asking = market + fixed margin ($)' },
  { id: 'multiplier', label: 'Asking = market × multiplier' },
  { id: 'manual', label: 'Manual only (no suggestion)' },
];

export function roundPrice(v, rule = 'whole') {
  if (v === null || v === undefined) return null;
  if (rule === 'none') return r2(v);
  if (rule === 'whole') return Math.round(v);
  if (rule === 'five') return Math.max(5, Math.round(v / 5) * 5);
  if (rule === 'ninety-nine') return Math.max(0.99, Math.floor(v) + 0.99);
  return r2(v);
}

export function suggestAsk(marketAud, rules = getState().settings.pricing) {
  if (marketAud === null || marketAud === undefined || rules.mode === 'manual') return null;
  let v = marketAud;
  if (rules.mode === 'margin') v = marketAud + Number(rules.margin || 0);
  if (rules.mode === 'multiplier') v = marketAud * Number(rules.multiplier || 1);
  return roundPrice(v, rules.rounding);
}

/** Convert a provider price row into a stored market reference with transparent FX. */
export function toMarketRef(row) {
  if (!row) return null;
  const s = getState();
  const value = row.market ?? row.mid ?? row.low;
  if (value === null || value === undefined) return null;
  return {
    value, currency: row.currency, aud: fxToAud(s, value, row.currency), low: row.low ?? null, mid: row.mid ?? null, high: row.high ?? null,
    source: row.source, sourceUpdatedAt: row.updatedAt || null, updatedAt: new Date().toISOString(),
    fxRate: row.currency === 'AUD' ? 1 : s.settings.fx[{ USD: 'usdAud', EUR: 'eurAud', JPY: 'jpyAud' }[row.currency]] ?? null,
    fxAt: s.settings.fx.updatedAt, fxSource: s.settings.fx.source, stale: false, label: row.label,
  };
}

export function isStale(market, days = 7) {
  if (!market) return true;
  if (market.stale) return true;
  return Date.now() - new Date(market.updatedAt).getTime() > days * 86400000;
}

/** Fetch FX from a free public endpoint. Falls back to the manual rate on failure. */
export async function refreshFx() {
  const res = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!res.ok) throw new Error('FX service unavailable');
  const j = await res.json();
  const aud = j.rates?.AUD, eur = j.rates?.EUR, jpy = j.rates?.JPY;
  if (!aud) throw new Error('FX service returned no AUD rate');
  updateSettings({ fx: { usdAud: r2(aud * 10000) / 10000, eurAud: Math.round((aud / eur) * 10000) / 10000, jpyAud: Math.round((aud / jpy) * 1000000) / 1000000, updatedAt: new Date().toISOString(), source: 'open.er-api.com (ExchangeRate-API)' } }, 'fx.refresh');
}
