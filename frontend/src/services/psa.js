// =============================================================================
// PSA certification service (modular so the provider can be swapped).
//
// PSA offers a Public API (https://www.psacard.com/publicapi) that requires a free
// account and a bearer token, with a daily call limit. Endpoints used:
//   GET /publicapi/cert/GetByCertNumber/{cert}
//   GET /publicapi/cert/GetImagesByCertNumber/{cert}
// Browsers usually cannot call it directly (CORS), so the recommended setup is the
// small proxy in /api/psa.js deployed on Vercel, with the token kept server-side.
// Nothing here ever fabricates a result: no token -> manual entry, clearly marked.
// =============================================================================
import { getState } from '../data/db.js';

export class PsaNotConfigured extends Error {}

function normalise(json, cert, images = []) {
  const c = json?.PSACert || json?.cert || json;
  if (!c || (!c.CertNumber && !c.certNumber)) throw new Error('PSA returned no certificate for that number.');
  const front = images.find((i) => i.IsFrontImage ?? i.isFront)?.ImageURL || images.find((i) => i.IsFrontImage ?? i.isFront)?.url;
  const back = images.find((i) => (i.IsFrontImage ?? i.isFront) === false)?.ImageURL || images.find((i) => (i.IsFrontImage ?? i.isFront) === false)?.url;
  return {
    verified: true,
    source: 'PSA Public API',
    retrievedAt: new Date().toISOString(),
    cert: String(c.CertNumber || c.certNumber || cert),
    year: c.Year || '',
    brand: c.Brand || '',
    subject: c.Subject || '',
    cardNumber: c.CardNumber || '',
    variety: c.Variety || '',
    grade: String(c.CardGrade || c.GradeDescription || '').replace(/^[A-Z\- ]+(?=\d)/, '').trim(),
    gradeDescription: c.GradeDescription || c.CardGrade || '',
    labelType: c.LabelType || '',
    population: c.TotalPopulation ?? null,
    populationHigher: c.PopulationHigher ?? null,
    frontImage: front || null,
    backImage: back || null,
    verifyUrl: `https://www.psacard.com/cert/${encodeURIComponent(cert)}`,
  };
}

export async function lookupCert(cert) {
  const clean = String(cert).replace(/\D/g, '');
  if (!clean) throw new Error('Enter a numeric PSA certification number.');
  const { psaToken, psaProxyUrl } = getState().settings.integrations;
  if (psaProxyUrl) {
    const res = await fetch(`${psaProxyUrl.replace(/\/$/, '')}?cert=${clean}`);
    if (!res.ok) throw new Error(`PSA proxy error ${res.status}`);
    const j = await res.json();
    return normalise(j.cert, clean, j.images || []);
  }
  if (psaToken) {
    const h = { Authorization: `bearer ${psaToken}` };
    const base = 'https://api.psacard.com/publicapi/cert';
    const [r1, r2] = await Promise.all([fetch(`${base}/GetByCertNumber/${clean}`, { headers: h }), fetch(`${base}/GetImagesByCertNumber/${clean}`, { headers: h }).catch(() => null)]);
    if (!r1.ok) throw new Error(`PSA API error ${r1.status}`);
    const imgs = r2 && r2.ok ? await r2.json() : [];
    return normalise(await r1.json(), clean, Array.isArray(imgs) ? imgs : []);
  }
  throw new PsaNotConfigured('PSA lookup is not configured. Add a PSA API token or proxy URL in Admin > API Integrations, or enter the slab details manually.');
}

/** Map a PSA subject like "CHARIZARD-HOLO" to a friendlier name guess (user confirms). */
export function guessName(subject = '') {
  return subject.split(/[-/]/)[0].toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase()).trim();
}
