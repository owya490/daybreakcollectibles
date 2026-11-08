// =============================================================================
// Card image recognition adapter.
// Recognising a raw Pokémon card from a photo needs a trained visual-search service
// (for example Ximilar's TCG card recognition, or a self-hosted embedding index built
// from TCGdex images). Those require an account/API key, so this adapter calls a
// configurable endpoint. With no provider configured the scanner still captures the
// photo and falls back to fast name/number search; it never guesses silently.
//
// Expected endpoint contract (POST multipart "image"):
//   -> { candidates: [{ name, set, number, language, confidence }] }
// =============================================================================
import { getState } from '../data/db.js';

export const recognitionAvailable = () => {
  const i = getState().settings.integrations;
  if (i.recognitionProvider === 'scrydex') return !!i.scrydexProxyUrl;
  return i.recognitionProvider === 'custom' && !!i.recognitionUrl;
};

export async function recognise(blob) {
  const i = getState().settings.integrations;
  if (!recognitionAvailable()) return { supported: false, candidates: [] };
  const fd = new FormData();
  fd.append('image', blob, 'card.jpg');
  if (i.recognitionProvider === 'scrydex') {
    // Scrydex Vision: POST /vision/v1/cards/identify (multipart "image", "games") via the server proxy
    fd.append('games', 'pokemon');
    const r = await fetch(`${i.scrydexProxyUrl.replace(/\/$/, '')}?path=${encodeURIComponent('vision/v1/cards/identify')}`, { method: 'POST', body: fd });
    if (!r.ok) throw new Error(`Scrydex Vision error ${r.status}`);
    const j = await r.json();
    return { supported: true, candidates: (j.matches || []).map((m) => ({ name: m.card?.name, number: m.card?.number, set: m.card?.expansion?.name, language: m.card?.language || 'English', confidence: Math.min(1, (m.score || 0) / 1.3), providerId: m.card?.id })) };
  }
  const res = await fetch(i.recognitionUrl, { method: 'POST', body: fd, headers: i.recognitionKey ? { Authorization: `Bearer ${i.recognitionKey}` } : {} });
  if (!res.ok) throw new Error(`Recognition service error ${res.status}`);
  const j = await res.json();
  return { supported: true, candidates: (j.candidates || []).sort((a, b) => (b.confidence || 0) - (a.confidence || 0)) };
}

/** Barcode / QR detection using the browser's BarcodeDetector where available (Chrome, Android). */
export function barcodeSupported() { return typeof window !== 'undefined' && 'BarcodeDetector' in window; }
let detector = null;
export async function detectCodes(source) {
  if (!barcodeSupported()) return [];
  if (!detector) {
    let formats = ['qr_code', 'code_128', 'code_39', 'ean_13', 'upc_a'];
    try { const sup = await window.BarcodeDetector.getSupportedFormats(); formats = formats.filter((f) => sup.includes(f)); } catch { /* use defaults */ }
    detector = new window.BarcodeDetector({ formats });
  }
  try { return await detector.detect(source); } catch { return []; }
}
