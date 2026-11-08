// =============================================================================
// Card data providers. Each provider returns a normalised Candidate:
// { provider, providerId, name, set, setCode, number, rarity, language, releaseYear,
//   image, variants[], prices: [{label, low, mid, market, high, currency, source, updatedAt}] }
// The aggregator queries every provider that supports the language and merges results,
// so the app keeps working if one API is down.
// =============================================================================
import { getState } from '../data/db.js';
import { LANG_CODE } from '../lib/util.js';

const withTimeout = (p, ms = 12000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('Timed out')), ms))]);

// ---------- Pokémon TCG API (pokemontcg.io) : English, includes TCGplayer USD + Cardmarket EUR ----------
export const pokemonTcgApi = {
  id: 'pokemontcg',
  name: 'Pokémon TCG API',
  languages: ['English'],
  async search({ name, number, set }) {
    const q = [];
    if (name) q.push(`name:"${name.replace(/"/g, '')}*"`);
    if (number) q.push(`number:${String(number).split('/')[0].replace(/^0+/, '') || '0'}`);
    if (set) q.push(`set.name:"${set.replace(/"/g, '')}*"`);
    if (!q.length) return [];
    const key = getState().settings.integrations.ptcgApiKey;
    const res = await withTimeout(fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q.join(' '))}&pageSize=24&orderBy=-set.releaseDate`, { headers: key ? { 'X-Api-Key': key } : {} }));
    if (!res.ok) throw new Error(`Pokémon TCG API ${res.status}`);
    const json = await res.json();
    return (json.data || []).map((c) => {
      const prices = [];
      const tp = c.tcgplayer?.prices || {};
      for (const [variant, v] of Object.entries(tp)) {
        prices.push({ label: `TCGplayer ${variant.replace(/([A-Z])/g, ' $1').toLowerCase()}`, variant, low: v.low, mid: v.mid, market: v.market, high: v.high, currency: 'USD', source: 'TCGplayer via Pokémon TCG API', updatedAt: c.tcgplayer.updatedAt, url: c.tcgplayer.url });
      }
      const cm = c.cardmarket?.prices;
      if (cm) prices.push({ label: 'Cardmarket trend', low: cm.lowPrice, mid: cm.averageSellPrice, market: cm.trendPrice, high: null, avg7: cm.avg7, avg30: cm.avg30, currency: 'EUR', source: 'Cardmarket via Pokémon TCG API', updatedAt: c.cardmarket.updatedAt, url: c.cardmarket.url });
      return {
        provider: 'pokemontcg', providerId: c.id, name: c.name, set: c.set?.name, setCode: c.set?.id,
        number: `${c.number}/${c.set?.printedTotal ?? ''}`.replace(/\/$/, ''), rarity: c.rarity || '', language: 'English',
        releaseYear: c.set?.releaseDate ? parseInt(c.set.releaseDate.slice(0, 4), 10) : null, series: c.set?.series,
        image: c.images?.large || c.images?.small, imageSource: 'Pokémon TCG API (images.pokemontcg.io)',
        variants: Object.keys(tp), prices,
      };
    });
  },
};

// ---------- TCGdex : multilingual (en, fr, de, it, es, pt, ja, ko, zh-tw, zh-cn, id, th) ----------
export const tcgdex = {
  id: 'tcgdex',
  name: 'TCGdex',
  languages: Object.keys(LANG_CODE),
  async search({ name, number, language = 'English' }) {
    const lang = LANG_CODE[language] || 'en';
    const params = new URLSearchParams();
    if (name) params.set('name', name);
    if (number) params.set('localId', String(number).split('/')[0]);
    params.set('pagination:itemsPerPage', '24');
    const res = await withTimeout(fetch(`https://api.tcgdex.net/v2/${lang}/cards?${params}`));
    if (!res.ok) throw new Error(`TCGdex ${res.status}`);
    const list = await res.json();
    // Fetch full details for the first matches (set, rarity, variants, pricing where available)
    const top = (Array.isArray(list) ? list : []).slice(0, 12);
    const full = await Promise.all(top.map((c) => withTimeout(fetch(`https://api.tcgdex.net/v2/${lang}/cards/${encodeURIComponent(c.id)}`)).then((r) => (r.ok ? r.json() : c)).catch(() => c)));
    return full.map((c) => {
      const prices = [];
      const tp = c.pricing?.tcgplayer;
      if (tp) for (const [variant, v] of Object.entries(tp)) if (v && typeof v === 'object' && ('marketPrice' in v || 'midPrice' in v)) prices.push({ label: `TCGplayer ${variant}`, variant, low: v.lowPrice, mid: v.midPrice, market: v.marketPrice, high: v.highPrice, currency: 'USD', source: 'TCGplayer via TCGdex', updatedAt: tp.updated });
      const cm = c.pricing?.cardmarket;
      if (cm) prices.push({ label: 'Cardmarket trend', low: cm.low, mid: cm.avg, market: cm.trend, avg7: cm.avg7, avg30: cm.avg30, currency: cm.unit || 'EUR', source: 'Cardmarket via TCGdex', updatedAt: cm.updated });
      return {
        provider: 'tcgdex', providerId: c.id, name: c.name, set: c.set?.name || '', setCode: c.set?.id || (c.id || '').split('-')[0],
        number: c.set?.cardCount?.official ? `${c.localId}/${c.set.cardCount.official}` : c.localId, rarity: c.rarity || '', language,
        image: c.image ? `${c.image}/high.webp` : null, imageSource: 'TCGdex (assets.tcgdex.net)',
        variants: c.variants ? Object.entries(c.variants).filter(([, v]) => v).map(([k]) => k) : [], prices,
      };
    });
  },
};

// ---------- Scrydex (official successor to pokemontcg.io; paid; raw + graded prices; multilingual) ----------
// Keys must stay server-side (Scrydex docs), so the browser calls the proxy in /api/scrydex.js.
// Price field names are mapped defensively; verify against live responses when first connected.
const pickNum = (o, keys) => { for (const k of keys) if (o && o[k] !== undefined && o[k] !== null && !Number.isNaN(Number(o[k]))) return Number(o[k]); return null; };
export const scrydex = {
  id: 'scrydex',
  name: 'Scrydex',
  languages: ['English', 'Japanese'],
  enabled: () => !!getState().settings.integrations.scrydexProxyUrl,
  async search({ name, number, language = 'English' }) {
    const base = getState().settings.integrations.scrydexProxyUrl.replace(/\/$/, '');
    const q = [name && `name:"${name.replace(/"/g, '')}*"`, number && `number:${String(number).split('/')[0]}`, language === 'Japanese' && 'language:japanese'].filter(Boolean).join(' ');
    const res = await withTimeout(fetch(`${base}?path=${encodeURIComponent('pokemon/v1/cards')}&q=${encodeURIComponent(q)}&page_size=24&include=prices`));
    if (!res.ok) throw new Error(`Scrydex ${res.status}`);
    const json = await res.json();
    return (json.data || []).map((c) => {
      const prices = [];
      for (const v of c.variants || []) for (const p of v.prices || []) {
        const graded = p.type === 'graded' || p.grade || p.company;
        prices.push({ label: `Scrydex ${v.name}${graded ? ` ${p.company || ''} ${p.grade || ''}`.trimEnd() : p.condition ? ` ${p.condition}` : ''}`, variant: v.name, graded: !!graded, grade: p.grade || null, company: p.company || null,
          low: pickNum(p, ['low', 'low_price']), mid: pickNum(p, ['mid', 'mid_price', 'avg']), market: pickNum(p, ['market', 'market_price', 'price']), high: pickNum(p, ['high', 'high_price']),
          currency: (p.currency || 'USD').toUpperCase(), source: 'Scrydex', updatedAt: p.updated_at || p.updatedAt || null });
      }
      const img = (c.images || []).find((i) => i.type === 'front') || (c.images || [])[0];
      return {
        provider: 'scrydex', providerId: c.id, name: c.name, set: c.expansion?.name, setCode: c.expansion?.id,
        number: c.expansion?.printed_total ? `${c.number}/${c.expansion.printed_total}` : c.number, rarity: c.rarity || '', language: c.language || language,
        releaseYear: c.expansion?.release_date ? parseInt(String(c.expansion.release_date).slice(0, 4), 10) : null,
        image: img?.large || img?.medium || img?.small || null, imageSource: 'Scrydex', variants: (c.variants || []).map((v) => v.name), prices,
      };
    });
  },
};

export const PROVIDERS = [scrydex, pokemonTcgApi, tcgdex];

/** Query all providers that support the language. Returns { candidates, errors }. */
export async function searchCards(query) {
  const lang = query.language || 'English';
  const providers = PROVIDERS.filter((p) => p.languages.includes(lang) && (!p.enabled || p.enabled()));
  const results = await Promise.allSettled(providers.map((p) => p.search(query)));
  const candidates = [];
  const errors = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') candidates.push(...r.value);
    else errors.push(`${providers[i].name}: ${r.reason?.message || 'unavailable'}`);
  });
  // Rank: exact number match first, then exact name match
  const n = String(query.number || '').split('/')[0].replace(/^0+/, '');
  const nm = String(query.name || '').toLowerCase();
  const score = (c) => (n && String(c.number).split('/')[0].replace(/^0+/, '') === n ? 2 : 0) + (nm && c.name.toLowerCase() === nm ? 1 : 0) + (c.prices.length ? 0.5 : 0);
  candidates.sort((a, b) => score(b) - score(a));
  return { candidates, errors };
}

/** Pick the most relevant price row for a variant label. */
export function bestPrice(candidate, variantHint = '') {
  if (!candidate?.prices?.length) return null;
  const v = variantHint.toLowerCase();
  const raw = candidate.prices.filter((p) => !p.graded);
  if (!raw.length) return null;
  const map = { 'reverse holo': 'reverseHolofoil', holo: 'holofoil', normal: 'normal', '1st edition': '1stEditionHolofoil' };
  const want = map[v];
  return raw.find((p) => want && p.variant === want) || raw.find((p) => p.variant && p.variant.toLowerCase() === v) || raw.find((p) => p.currency === 'USD' && p.market) || raw[0];
}
