// Vercel serverless function: Scrydex proxy (card search, prices, Vision identify).
// Scrydex keys must never reach the browser. Env: SCRYDEX_API_KEY, SCRYDEX_TEAM_ID
// GET  /api/scrydex?path=pokemon/v1/cards&q=...&include=prices
// POST /api/scrydex?path=vision/v1/cards/identify   (multipart body passed through)
export const config = { api: { bodyParser: false } };
const ALLOWED = [/^pokemon\/v1\/cards(\/[\w-]+)?$/, /^pokemon\/v1\/expansions(\/[\w-]+)?(\/cards)?$/, /^pokemon\/v1\/sealed(\/[\w-]+)?$/, /^vision\/v1\/cards\/identify$/];

export default async function handler(req, res) {
  const path = String(req.query.path || '');
  if (!ALLOWED.some((r) => r.test(path))) return res.status(400).json({ error: 'path not allowed' });
  if (!process.env.SCRYDEX_API_KEY || !process.env.SCRYDEX_TEAM_ID) return res.status(501).json({ error: 'Scrydex credentials are not configured' });
  const qs = new URLSearchParams(req.query);
  qs.delete('path');
  const url = `https://api.scrydex.com/${path}${qs.toString() ? `?${qs}` : ''}`;
  const headers = { 'X-Api-Key': process.env.SCRYDEX_API_KEY, 'X-Team-ID': process.env.SCRYDEX_TEAM_ID };
  try {
    let body;
    if (req.method === 'POST') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      body = Buffer.concat(chunks);
      headers['Content-Type'] = req.headers['content-type'];
    }
    const r = await fetch(url, { method: req.method, headers, body });
    const text = await r.text();
    res.status(r.status).setHeader('Content-Type', r.headers.get('content-type') || 'application/json');
    if (req.method === 'GET' && r.ok) res.setHeader('Cache-Control', 's-maxage=3600');
    return res.send(text);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
