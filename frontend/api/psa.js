// Vercel serverless function: PSA cert lookup proxy.
// Keeps the PSA token server-side and solves browser CORS.
// Env: PSA_TOKEN (bearer token generated from your PSA account at psacard.com/publicapi)
// GET /api/psa?cert=12345678  ->  { cert: <GetByCertNumber JSON>, images: <GetImagesByCertNumber JSON> }
// Free PSA accounts are limited to 100 calls/day; each lookup here uses up to 2.
export default async function handler(req, res) {
  const cert = String(req.query.cert || '').replace(/\D/g, '');
  if (!cert) return res.status(400).json({ error: 'cert is required' });
  if (!process.env.PSA_TOKEN) return res.status(501).json({ error: 'PSA_TOKEN is not configured' });
  const headers = { Authorization: `bearer ${process.env.PSA_TOKEN}` };
  const base = 'https://api.psacard.com/publicapi/cert';
  try {
    const [c, i] = await Promise.all([
      fetch(`${base}/GetByCertNumber/${cert}`, { headers }),
      fetch(`${base}/GetImagesByCertNumber/${cert}`, { headers }).catch(() => null),
    ]);
    if (!c.ok) return res.status(c.status).json({ error: `PSA responded ${c.status}` });
    const certJson = await c.json();
    if (certJson && certJson.IsValidRequest === false) return res.status(404).json({ error: certJson.ServerMessage || 'Cert not found' });
    const images = i && i.ok ? await i.json() : [];
    res.setHeader('Cache-Control', 's-maxage=86400'); // cert data rarely changes; saves the daily quota
    return res.status(200).json({ cert: certJson, images: Array.isArray(images) ? images : [] });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
