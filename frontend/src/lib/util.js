// Shared formatting and helper utilities.

const audFmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 });
const audFmt0 = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });

export const aud = (n, opts = {}) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '-';
  return (opts.round ? audFmt0 : audFmt).format(Number(n));
};
export const money = (n, cur = 'AUD') => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '-';
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: cur }).format(Number(n));
};
export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
export const sum = (arr, fn = (x) => x) => r2(arr.reduce((a, x) => a + (Number(fn(x)) || 0), 0));

export const uid = (prefix = '') =>
  prefix + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7);

export const fmtDate = (iso, withTime = false) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return withTime
    ? d.toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
};
export const timeAgo = (iso) => {
  if (!iso) return 'never';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};
export const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

export const cls = (...a) => a.filter(Boolean).join(' ');
export const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-');

export const TYPE_LABEL = { slab: 'PSA Slab', single: 'Raw Single', sealed: 'Sealed', guard: 'Extended Art Guard' };
export const TYPE_PATH = { slab: 'psa-slabs', single: 'singles', sealed: 'sealed', guard: 'extended-art-guards' };
export const PATH_TYPE = Object.fromEntries(Object.entries(TYPE_PATH).map(([k, v]) => [v, k]));

export const LANGUAGES = [
  'English', 'Japanese', 'Chinese (Simplified)', 'Chinese (Traditional)', 'Korean',
  'French', 'German', 'Italian', 'Spanish', 'Portuguese', 'Indonesian', 'Thai',
];
export const LANG_CODE = {
  English: 'en', Japanese: 'ja', 'Chinese (Simplified)': 'zh-cn', 'Chinese (Traditional)': 'zh-tw', Korean: 'ko',
  French: 'fr', German: 'de', Italian: 'it', Spanish: 'es', Portuguese: 'pt-br', Indonesian: 'id', Thai: 'th',
};
export const LANG_SHORT = {
  English: 'EN', Japanese: 'JP', 'Chinese (Simplified)': 'S-CN', 'Chinese (Traditional)': 'T-CN', Korean: 'KR',
  French: 'FR', German: 'DE', Italian: 'IT', Spanish: 'ES', Portuguese: 'PT', Indonesian: 'ID', Thai: 'TH',
};
export const CONDITIONS = ['Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged'];
export const COND_SHORT = { 'Near Mint': 'NM', 'Lightly Played': 'LP', 'Moderately Played': 'MP', 'Heavily Played': 'HP', Damaged: 'DMG' };
export const SEALED_CONDITIONS = ['Factory Sealed', 'Sealed - Minor Box Wear', 'Sealed - Damaged Box', 'Opened'];
export const VARIANTS = ['Normal', 'Holo', 'Reverse Holo', 'Alternate Art', 'Full Art', 'Special Art Rare', 'Illustration Rare', 'Gold / Hyper Rare', 'Master Ball Reverse', 'Promo', '1st Edition', 'Shadowless'];
export const RARITIES = ['Common', 'Uncommon', 'Rare', 'Holo Rare', 'Double Rare', 'Ultra Rare', 'Illustration Rare', 'Special Illustration Rare', 'Hyper Rare', 'Secret Rare', 'Promo'];
export const ERAS = ['WotC (1999-2003)', 'EX (2003-2007)', 'DP / Platinum', 'HGSS / BW', 'XY', 'Sun & Moon', 'Sword & Shield', 'Scarlet & Violet', 'Mega Evolution'];
export const SEALED_TYPES = ['Booster Box', 'Elite Trainer Box', 'Booster Bundle', 'Booster Pack', 'Collection Box', 'Special Box', 'Tin', 'Case'];
export const PSA_GRADES = ['10', '9', '8.5', '8', '7', '6', '5', '4', '3', '2', '1', 'Authentic'];
export const PAY_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card' },
  { id: 'bank', label: 'Bank transfer' },
  { id: 'credit', label: 'Store credit' },
];

export function download(filename, content, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// ---- CSV ----
export function toCSV(rows, columns) {
  const cols = columns || Object.keys(rows[0] || {}).map((k) => ({ key: k, label: k }));
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = cols.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => cols.map((c) => esc(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(',')).join('\n');
  return head + '\n' + body;
}

export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const clean = rows.filter((r) => r.some((x) => x.trim() !== ''));
  if (!clean.length) return { headers: [], rows: [] };
  const headers = clean[0].map((h) => h.trim());
  return { headers, rows: clean.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()]))) };
}

// Resize an uploaded image to a data URL so it fits in local storage.
export function fileToDataUrl(file, max = 900, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export async function sha256(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback for non-secure contexts (e.g. plain http on a LAN IP during card shows)
    let h = 0; for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0; return 'weak-' + h;
  }
}
