import { useState } from 'react';
import { useDB, updateSettings } from '../data/db.js';
import { Field, useToast } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { searchCards, pokemonTcgApi, tcgdex, scrydex } from '../services/cardData.js';
import { lookupCert } from '../services/psa.js';
import { refreshFx } from '../services/pricing.js';

// Integration register. Facts verified against provider documentation in November 2026.
export const REGISTER = [
  { id: 'tcgdex', name: 'TCGdex', status: 'live', data: 'Cards, sets, rarity, variants, artwork; TCGplayer & Cardmarket price snapshots where mapped', langs: 'EN, FR, ES, IT, PT, DE, JA, Traditional Chinese, ID, TH (others where available)', images: 'Yes (assets.tcgdex.net)', pricing: 'Partial (USD/EUR, not every card)', auth: 'None', limits: 'No key; fair use', commercial: 'Open source; check attribution terms', complexity: 'Low', fallback: 'Manual entry', docs: 'https://tcgdex.dev' },
  { id: 'pokemontcg', name: 'Pokémon TCG API (pokemontcg.io)', status: 'live', warn: 'Deprecated: scheduled to go offline 1 March 2027. Migrate to Scrydex.', data: 'English cards, sets, images; TCGplayer USD & Cardmarket EUR snapshots', langs: 'English only', images: 'Yes (images.pokemontcg.io)', pricing: 'Yes (snapshot, by variant)', auth: 'Optional X-Api-Key', limits: 'Higher daily limit with a free key', commercial: 'Free; being retired', complexity: 'Low', fallback: 'TCGdex, then manual', docs: 'https://docs.pokemontcg.io', key: 'ptcgApiKey' },
  { id: 'scrydex', name: 'Scrydex', status: 'needs-credentials', data: 'Cards, sealed, raw & graded prices, price history, PSA/CGC pop reports, image recognition (Vision)', langs: 'English & Japanese (per docs filters)', images: 'Yes', pricing: 'Yes, including graded', auth: 'X-Api-Key + X-Team-ID, server-side only', limits: 'Credit-based paid plans', commercial: 'Paid subscription', complexity: 'Medium (needs /api/scrydex proxy)', fallback: 'TCGdex / Pokémon TCG API', docs: 'https://scrydex.com/docs', key: 'scrydexProxyUrl', keyLabel: 'Scrydex proxy URL (e.g. https://your-site/api/scrydex)' },
  { id: 'psa', name: 'PSA Public API', status: 'needs-credentials', data: 'Cert verification: subject, year, brand, card number, grade, population; slab images endpoint', langs: 'n/a', images: 'Yes, where PSA has them (GetImagesByCertNumber)', pricing: 'No', auth: 'Bearer token from PSA account (keep server-side)', limits: '100 calls/day on free accounts; paid plans by email', commercial: 'PSA API End User Agreement', complexity: 'Low (needs /api/psa proxy for CORS & token safety)', fallback: 'Manual entry, marked unverified; link to psacard.com/cert', docs: 'https://www.psacard.com/publicapi', key: 'psaProxyUrl', keyLabel: 'PSA proxy URL (recommended)', key2: 'psaToken', key2Label: 'PSA token (testing only: visible in this browser)' },
  { id: 'tcgplayer', name: 'TCGplayer API', status: 'unavailable', data: 'Marketplace pricing, SKUs, condition prices', langs: 'English-focused', images: 'Yes', pricing: 'Yes', auth: 'Developer key (OAuth)', limits: '-', commercial: 'TCGplayer is not granting new API access', complexity: '-', fallback: 'TCGplayer prices via TCGdex / Pokémon TCG API / Scrydex; manual', docs: 'https://docs.tcgplayer.com' },
  { id: 'collectr', name: 'Collectr', status: 'manual', data: 'Your portfolio export', langs: '-', images: 'No', pricing: 'Export includes market values', auth: '-', limits: '-', commercial: 'No public API found', complexity: 'Low', fallback: 'CSV import with column mapping (Inventory › Import CSV)', docs: 'https://getcollectr.com' },
  { id: 'stripe', name: 'Stripe (payments)', status: 'needs-credentials', data: 'Card, Apple Pay, Google Pay checkout in AUD; refunds; webhooks', langs: '-', images: '-', pricing: '-', auth: 'Publishable key (browser) + secret key (server)', limits: '-', commercial: 'Per-transaction fees; available to Australian businesses', complexity: 'Medium (needs /api/checkout + webhook)', fallback: 'Bank transfer orders; POS card via your terminal', docs: 'https://docs.stripe.com', key: 'stripePublishableKey', keyLabel: 'Stripe publishable key (pk_...)', key2: 'checkoutApiUrl', key2Label: 'Checkout endpoint (e.g. /api/checkout)' },
  { id: 'recognition', name: 'Card image recognition', status: 'needs-credentials', data: 'Identify a raw card from a photo', langs: 'Provider-dependent', images: '-', pricing: '-', auth: 'Provider key (server-side)', limits: 'Provider-dependent', commercial: 'Paid (Scrydex Vision or another provider)', complexity: 'Low once Scrydex proxy is live', fallback: 'Photo + fast name/number search (always available)', docs: 'https://scrydex.com/docs/vision/overview' },
  { id: 'fx', name: 'Exchange rates (open.er-api.com)', status: 'live', data: 'Daily USD/EUR/JPY → AUD', langs: '-', images: '-', pricing: '-', auth: 'None', limits: 'Updated daily', commercial: 'Free with attribution', complexity: 'Low', fallback: 'Manual rate in Pricing › Rules & FX', docs: 'https://www.exchangerate-api.com/docs/free' },
  { id: 'auspost', name: 'Australia Post / Sendle shipping', status: 'manual', data: 'Live rates, labels, tracking', langs: '-', images: '-', pricing: '-', auth: 'Business account API keys', limits: '-', commercial: 'Business account required', complexity: 'Medium', fallback: 'Configurable flat rates (Settings) + manual tracking numbers', docs: 'https://developers.auspost.com.au' },
];
const STATUS = { live: ['green', 'Working'], 'needs-credentials': ['amber', 'Needs credentials'], unavailable: ['red', 'Not available'], manual: ['grey', 'Manual workflow'] };

export default function Integrations() {
  const s = useDB();
  const toast = useToast();
  const i = s.settings.integrations;
  const [test, setTest] = useState({});
  const set = (k, v) => updateSettings({ integrations: { ...i, [k]: v } }, 'integrations.update');
  const run = async (id) => {
    setTest((t) => ({ ...t, [id]: 'Testing…' }));
    try {
      let msg;
      if (id === 'tcgdex') { const r = await tcgdex.search({ name: 'Pikachu', language: 'Japanese' }); msg = `OK: ${r.length} Japanese results`; }
      else if (id === 'pokemontcg') { const r = await pokemonTcgApi.search({ name: 'Charizard', number: '4' }); msg = `OK: ${r.length} results, ${r[0]?.prices.length || 0} price rows`; }
      else if (id === 'scrydex') { if (!scrydex.enabled()) throw new Error('Add the proxy URL first'); const r = await scrydex.search({ name: 'Umbreon' }); msg = `OK: ${r.length} results`; }
      else if (id === 'psa') { const r = await lookupCert(test.cert || '00000000'); msg = `OK: ${r.subject} ${r.gradeDescription}`; }
      else if (id === 'fx') { await refreshFx(); msg = 'OK: rates updated'; }
      else msg = 'No live test for this integration';
      setTest((t) => ({ ...t, [id]: msg }));
    } catch (e) { setTest((t) => ({ ...t, [id]: 'Failed: ' + e.message })); }
  };
  return (
    <>
      <div className="page-head"><div><h1>API integrations</h1><p>What's connected, what each source can and can't do, and the fallback if it's down.</p></div></div>
      <div className="notice" style={{ marginBottom: 14 }}>Secret keys never belong in the browser. Integrations marked "server-side" use the small serverless functions in <code>/api</code>, with keys stored as Vercel environment variables (see README). If any source fails, lookups continue with the others and manual entry is always available.</div>
      <div className="int-grid">
        {REGISTER.map((r) => {
          const st = r.id === 'scrydex' && i.scrydexProxyUrl ? 'live' : r.id === 'psa' && (i.psaProxyUrl || i.psaToken) ? 'live' : r.id === 'stripe' && i.stripePublishableKey && i.checkoutApiUrl ? 'live' : r.id === 'recognition' && i.recognitionProvider !== 'none' ? 'live' : r.status;
          return (
            <div key={r.id} className="int-card">
              <div className="row between"><b>{r.name}</b><span className={'badge ' + STATUS[st][0]}>{STATUS[st][1]}</span></div>
              {r.warn && <div className="notice warn small">{r.warn}</div>}
              <dl className="kv">
                <dt>Data</dt><dd>{r.data}</dd><dt>Languages</dt><dd>{r.langs}</dd><dt>Images</dt><dd>{r.images}</dd><dt>Pricing</dt><dd>{r.pricing}</dd>
                <dt>Auth</dt><dd>{r.auth}</dd><dt>Rate limits</dt><dd>{r.limits}</dd><dt>Commercial use</dt><dd>{r.commercial}</dd><dt>Complexity</dt><dd>{r.complexity}</dd><dt>Fallback</dt><dd>{r.fallback}</dd>
              </dl>
              {r.key && <Field label={r.keyLabel || 'API key'}><input className="input" value={i[r.key] || ''} onChange={(e) => set(r.key, e.target.value.trim())} placeholder="Not set" /></Field>}
              {r.key2 && <Field label={r.key2Label}><input className="input" type={r.key2 === 'psaToken' ? 'password' : 'text'} value={i[r.key2] || ''} onChange={(e) => set(r.key2, e.target.value.trim())} placeholder="Not set" /></Field>}
              {r.id === 'recognition' && <Field label="Provider"><select className="select" value={i.recognitionProvider} onChange={(e) => set('recognitionProvider', e.target.value)}><option value="none">None (photo + search)</option><option value="scrydex">Scrydex Vision (uses Scrydex proxy)</option><option value="custom">Custom endpoint</option></select></Field>}
              {r.id === 'recognition' && i.recognitionProvider === 'custom' && <Field label="Endpoint URL"><input className="input" value={i.recognitionUrl} onChange={(e) => set('recognitionUrl', e.target.value.trim())} /></Field>}
              {r.id === 'psa' && <Field label="Test cert number"><input className="input" value={test.cert || ''} onChange={(e) => setTest({ ...test, cert: e.target.value })} /></Field>}
              <div className="row wrap">
                {['tcgdex', 'pokemontcg', 'scrydex', 'psa', 'fx'].includes(r.id) && <button className="btn sm secondary" onClick={() => run(r.id)}><Icon name="bolt" size={14} />Test</button>}
                <a className="btn sm ghost" href={r.docs} target="_blank" rel="noreferrer">Docs</a>
                {test[r.id] && <span className="small">{test[r.id]}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
