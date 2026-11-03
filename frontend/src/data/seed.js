// DEMONSTRATION DATA. Every record here has demo: true and is labelled "Sample" in the UI.
// None of this is actual Daybreak stock. Clear it from Admin > Settings > Data.
// Card images point at the public Pokémon TCG API image CDN (images.pokemontcg.io) and the
// TCGdex asset CDN (assets.tcgdex.net). If an image does not exist the UI shows a labelled
// placeholder rather than a substitute picture.
import { daysAgo } from '../lib/util.js';

// Deterministic IDs so sample links and QR codes resolve identically on every device.
let seq = 0;
const uid = () => 'demo' + (++seq).toString(36).padStart(4, '0');

const ptcg = (set, num) => ({ url: `https://images.pokemontcg.io/${set}/${num}_hires.png`, source: 'Pokémon TCG API (images.pokemontcg.io)', attribution: 'Card image © The Pokémon Company / Nintendo / Creatures / GAME FREAK' });
const tcgdex = (lang, serie, set, num) => ({ url: `https://assets.tcgdex.net/${lang}/${serie}/${set}/${num}/high.webp`, source: 'TCGdex (assets.tcgdex.net)', attribution: 'Card image © The Pokémon Company / Nintendo / Creatures / GAME FREAK' });

export const SEED_LOCATIONS = [
  { id: 'loc-main', name: 'Main inventory', parentId: null },
  { id: 'loc-slab-display', name: 'PSA Slab Display', parentId: 'loc-main' },
  { id: 'loc-slab-storage', name: 'PSA Storage', parentId: 'loc-main' },
  { id: 'loc-raw', name: 'Raw Singles', parentId: 'loc-main' },
  { id: 'loc-binder-1', name: 'Binder 1', parentId: 'loc-raw' },
  { id: 'loc-binder-2', name: 'Binder 2', parentId: 'loc-raw' },
  { id: 'loc-box-1', name: 'Box 1', parentId: 'loc-raw' },
  { id: 'loc-sealed', name: 'Sealed Products', parentId: 'loc-main' },
  { id: 'loc-shelf-a', name: 'Storage Shelf A', parentId: 'loc-sealed' },
  { id: 'loc-shelf-b', name: 'Storage Shelf B', parentId: 'loc-sealed' },
  { id: 'loc-guards', name: 'Extended Art Guards', parentId: 'loc-main' },
  { id: 'loc-guard-box-1', name: 'Storage Box 1', parentId: 'loc-guards' },
  { id: 'loc-guard-box-2', name: 'Storage Box 2', parentId: 'loc-guards' },
  { id: 'loc-showcase-1', name: 'Showcase Row 1', parentId: 'loc-main' },
];

// product: catalogue record. units: physical copies (or lots for identical sealed/guards).
const P = [];
const U = [];
let skuN = 1000;
const sku = (t) => `DB-${{ slab: 'PSA', single: 'RAW', sealed: 'SLD', guard: 'EAG' }[t]}-${++skuN}`;

function add(product, units) {
  const id = 'p-' + uid();
  P.push({ id, demo: true, featured: false, images: [], description: '', compatibleGuardIds: [], ...product });
  units.forEach((u, i) => {
    const acquired = daysAgo(u.ageDays ?? 10 + i * 3).toISOString();
    U.push({
      id: 'u-' + uid(), productId: id, sku: sku(product.type), qty: 1, status: 'available', published: true,
      condition: product.type === 'sealed' ? 'Factory Sealed' : product.type === 'guard' ? 'New' : 'Near Mint',
      grade: '', cert: '', certVerified: false, locationId: null, notes: '', demo: true,
      createdAt: acquired, updatedAt: acquired, acquiredAt: acquired, labelPrintedAt: null, negotiable: false,
      market: u.marketUsd ? { value: u.marketUsd, currency: 'USD', source: 'Sample value (not live)', updatedAt: acquired, stale: true } : null,
      ...u,
    });
  });
  return id;
}

// ---------- PSA slabs ----------
add({ type: 'slab', name: 'Charizard Holo', pokemon: 'Charizard', set: 'Base Set', setCode: 'base1', number: '4/102', language: 'English', rarity: 'Holo Rare', variant: 'Holo', era: 'WotC (1999-2003)', releaseYear: 1999, images: [ptcg('base1', 4)], featured: true, description: 'The card that started it all. Unlimited print Base Set Charizard in a PSA holder.' },
  [{ grade: '8', cert: 'SAMPLE-80412233', ask: 2450, cost: 1900, marketUsd: 1500, locationId: 'loc-slab-display', ageDays: 40 }]);
add({ type: 'slab', name: 'Charizard ex Special Illustration Rare', pokemon: 'Charizard', set: 'Scarlet & Violet 151', setCode: 'sv3pt5', number: '199/165', language: 'English', rarity: 'Special Illustration Rare', variant: 'Special Art Rare', era: 'Scarlet & Violet', releaseYear: 2023, images: [ptcg('sv3pt5', 199)], featured: true },
  [{ grade: '10', cert: 'SAMPLE-91128455', ask: 780, cost: 560, marketUsd: 470, locationId: 'loc-slab-display', ageDays: 4 },
   { grade: '9', cert: 'SAMPLE-91128871', ask: 340, cost: 250, marketUsd: 205, locationId: 'loc-slab-storage', ageDays: 2 }]);
add({ type: 'slab', name: 'Umbreon VMAX Alternate Art', pokemon: 'Umbreon', set: 'Evolving Skies', setCode: 'swsh7', number: '215/203', language: 'English', rarity: 'Secret Rare', variant: 'Alternate Art', era: 'Sword & Shield', releaseYear: 2021, images: [ptcg('swsh7', 215)], featured: true },
  [{ grade: '10', cert: 'SAMPLE-73300218', ask: 3950, cost: 3100, marketUsd: 2400, locationId: 'loc-slab-display', ageDays: 15 }]);
add({ type: 'slab', name: 'Lugia Holo', pokemon: 'Lugia', set: 'Neo Genesis', setCode: 'neo1', number: '9/111', language: 'English', rarity: 'Holo Rare', variant: 'Holo', era: 'WotC (1999-2003)', releaseYear: 2000, images: [ptcg('neo1', 9)] },
  [{ grade: '9', cert: 'SAMPLE-55120987', ask: 1650, cost: 1200, marketUsd: 950, locationId: 'loc-slab-storage', ageDays: 70 }]);
add({ type: 'slab', name: 'Charizard ex SAR (Japanese)', pokemon: 'Charizard', set: 'Pokémon Card 151 (SV2a)', setCode: 'SV2a', number: '201/165', language: 'Japanese', rarity: 'Special Illustration Rare', variant: 'Special Art Rare', era: 'Scarlet & Violet', releaseYear: 2023, images: [tcgdex('ja', 'SV', 'SV2a', '201')], featured: true },
  [{ grade: '10', cert: 'SAMPLE-88231190', ask: 620, cost: 430, marketUsd: 360, locationId: 'loc-slab-display', ageDays: 1 }]);
add({ type: 'slab', name: 'Pikachu (Japanese)', pokemon: 'Pikachu', set: 'Pokémon Card 151 (SV2a)', setCode: 'SV2a', number: '173/165', language: 'Japanese', rarity: 'Illustration Rare', variant: 'Illustration Rare', era: 'Scarlet & Violet', releaseYear: 2023, images: [tcgdex('ja', 'SV', 'SV2a', '173')] },
  [{ grade: '10', cert: 'SAMPLE-88231577', ask: 165, cost: 95, marketUsd: 85, locationId: 'loc-slab-storage', ageDays: 6 }]);

// ---------- Raw singles ----------
add({ type: 'single', name: 'Giratina V Alternate Art', pokemon: 'Giratina', set: 'Lost Origin', setCode: 'swsh11', number: '186/196', language: 'English', rarity: 'Ultra Rare', variant: 'Alternate Art', era: 'Sword & Shield', releaseYear: 2022, images: [ptcg('swsh11', 186)], featured: true },
  [{ ask: 520, cost: 390, marketUsd: 330, locationId: 'loc-binder-1', ageDays: 8 },
   { ask: 430, cost: 300, marketUsd: 280, condition: 'Lightly Played', locationId: 'loc-binder-1', ageDays: 9 }]);
add({ type: 'single', name: 'Gengar VMAX Alternate Art', pokemon: 'Gengar', set: 'Fusion Strike', setCode: 'swsh8', number: '271/264', language: 'English', rarity: 'Secret Rare', variant: 'Alternate Art', era: 'Sword & Shield', releaseYear: 2021, images: [ptcg('swsh8', 271)] },
  [{ ask: 610, cost: 470, marketUsd: 390, locationId: 'loc-binder-1', ageDays: 20 }]);
add({ type: 'single', name: 'Charizard V Alternate Art', pokemon: 'Charizard', set: 'Brilliant Stars', setCode: 'swsh9', number: '154/172', language: 'English', rarity: 'Ultra Rare', variant: 'Alternate Art', era: 'Sword & Shield', releaseYear: 2022, images: [ptcg('swsh9', 154)] },
  [{ ask: 330, cost: 220, marketUsd: 205, locationId: 'loc-binder-2', ageDays: 3 }]);
add({ type: 'single', name: 'Mew ex Hyper Rare', pokemon: 'Mew', set: 'Scarlet & Violet 151', setCode: 'sv3pt5', number: '205/165', language: 'English', rarity: 'Hyper Rare', variant: 'Gold / Hyper Rare', era: 'Scarlet & Violet', releaseYear: 2023, images: [ptcg('sv3pt5', 205)] },
  [{ ask: 39, cost: 22, marketUsd: 24, qty: 3, locationId: 'loc-box-1', ageDays: 12 }]);
add({ type: 'single', name: 'Pikachu', pokemon: 'Pikachu', set: 'Base Set', setCode: 'base1', number: '58/102', language: 'English', rarity: 'Common', variant: 'Normal', era: 'WotC (1999-2003)', releaseYear: 1999, images: [ptcg('base1', 58)] },
  [{ ask: 12, cost: 4, marketUsd: 6, qty: 2, condition: 'Moderately Played', locationId: 'loc-box-1', ageDays: 95 }]);
add({ type: 'single', name: 'Blastoise Holo', pokemon: 'Blastoise', set: 'Base Set', setCode: 'base1', number: '2/102', language: 'English', rarity: 'Holo Rare', variant: 'Holo', era: 'WotC (1999-2003)', releaseYear: 1999, images: [ptcg('base1', 2)] },
  [{ ask: 260, cost: 170, marketUsd: 140, condition: 'Lightly Played', locationId: 'loc-binder-2', ageDays: 60 }]);
add({ type: 'single', name: 'Pikachu ex SAR (Japanese)', pokemon: 'Pikachu', set: 'Super Electric Breaker (SV8)', setCode: 'SV8', number: '132/106', language: 'Japanese', rarity: 'Special Illustration Rare', variant: 'Special Art Rare', era: 'Scarlet & Violet', releaseYear: 2024, images: [tcgdex('ja', 'SV', 'SV8', '132')], featured: true },
  [{ ask: 295, cost: 210, marketUsd: 180, locationId: 'loc-binder-2', ageDays: 2 }]);
add({ type: 'single', name: 'Mewtwo (Japanese)', pokemon: 'Mewtwo', set: 'Pokémon Card 151 (SV2a)', setCode: 'SV2a', number: '183/165', language: 'Japanese', rarity: 'Illustration Rare', variant: 'Illustration Rare', era: 'Scarlet & Violet', releaseYear: 2023, images: [tcgdex('ja', 'SV', 'SV2a', '183')] },
  [{ ask: 28, cost: 15, marketUsd: 16, qty: 2, locationId: 'loc-box-1', ageDays: 5 }]);
add({ type: 'single', name: 'Charizard ex SAR (Korean)', pokemon: 'Charizard', set: 'Pokémon Card 151 (Korean)', setCode: 'SV2a-KR', number: '201/165', language: 'Korean', rarity: 'Special Illustration Rare', variant: 'Special Art Rare', era: 'Scarlet & Violet', releaseYear: 2023, images: [], description: 'Korean print. Photograph pending.' },
  [{ ask: 210, cost: 140, locationId: 'loc-binder-2', ageDays: 7 }]);
add({ type: 'single', name: 'Umbreon ex SAR (Korean)', pokemon: 'Umbreon', set: 'Terastal Festival ex (Korean)', setCode: 'SV8a-KR', number: '217/187', language: 'Korean', rarity: 'Special Illustration Rare', variant: 'Special Art Rare', era: 'Scarlet & Violet', releaseYear: 2025, images: [] },
  [{ ask: 540, cost: 400, locationId: 'loc-binder-2', ageDays: 3 }]);
add({ type: 'single', name: 'Pikachu Promo (Simplified Chinese)', pokemon: 'Pikachu', set: 'Gem Pack Vol. 1 (S-Chinese)', setCode: 'CSV-GEM1', number: 'Promo', language: 'Chinese (Simplified)', rarity: 'Promo', variant: 'Promo', era: 'Scarlet & Violet', releaseYear: 2024, images: [] },
  [{ ask: 18, cost: 8, qty: 4, locationId: 'loc-box-1', ageDays: 14 }]);
add({ type: 'single', name: 'Rayquaza VMAX Alt Art (Traditional Chinese)', pokemon: 'Rayquaza', set: 'Blue Sky Stream (T-Chinese)', setCode: 'S7R-TC', number: '084/067', language: 'Chinese (Traditional)', rarity: 'Secret Rare', variant: 'Alternate Art', era: 'Sword & Shield', releaseYear: 2021, images: [] },
  [{ ask: 360, cost: 250, locationId: 'loc-binder-1', ageDays: 30 }]);

// ---------- Sealed ----------
add({ type: 'sealed', name: 'Scarlet & Violet 151 Elite Trainer Box', pokemon: '', set: 'Scarlet & Violet 151', setCode: 'sv3pt5', number: '', language: 'English', productType: 'Elite Trainer Box', releaseYear: 2023, images: [] },
  [{ ask: 129, cost: 85, qty: 4, locationId: 'loc-shelf-a', ageDays: 25 }]);
add({ type: 'sealed', name: 'Pokémon Card 151 Booster Box (Japanese)', pokemon: '', set: 'Pokémon Card 151 (SV2a)', setCode: 'SV2a', number: '', language: 'Japanese', productType: 'Booster Box', releaseYear: 2023, images: [], featured: true },
  [{ ask: 349, cost: 260, qty: 2, locationId: 'loc-shelf-a', ageDays: 18 }]);
add({ type: 'sealed', name: 'Terastal Festival ex Booster Box (Japanese)', pokemon: '', set: 'Terastal Festival ex (SV8a)', setCode: 'SV8a', number: '', language: 'Japanese', productType: 'Booster Box', releaseYear: 2024, images: [] },
  [{ ask: 189, cost: 140, qty: 3, locationId: 'loc-shelf-b', ageDays: 6 }]);
add({ type: 'sealed', name: 'Prismatic Evolutions Booster Bundle', pokemon: '', set: 'Prismatic Evolutions', setCode: 'sv8pt5', number: '', language: 'English', productType: 'Booster Bundle', releaseYear: 2025, images: [] },
  [{ ask: 95, cost: 62, qty: 1, condition: 'Sealed - Minor Box Wear', locationId: 'loc-shelf-b', ageDays: 40 }]);
add({ type: 'sealed', name: 'Surging Sparks Booster Box', pokemon: '', set: 'Surging Sparks', setCode: 'sv8', number: '', language: 'English', productType: 'Booster Box', releaseYear: 2024, images: [] },
  [{ ask: 279, cost: 205, qty: 2, locationId: 'loc-shelf-a', ageDays: 50 }]);

// ---------- Extended Art Guards ----------
const guardDesc = 'Daybreak Extended Art Guard. Clips around a standard PSA holder to extend the card artwork past the label area.';
const g1 = add({ type: 'guard', name: 'Daybreak Guard: Midnight Umbreon', design: 'Midnight', artwork: 'Umbreon night sky', colour: 'Indigo', style: 'Full bleed', language: '', set: 'Daybreak Originals', images: [], description: guardDesc, compatibility: 'Standard PSA holder (current label)' },
  [{ ask: 35, cost: 9, qty: 18, locationId: 'loc-guard-box-1', ageDays: 9 }]);
const g2 = add({ type: 'guard', name: 'Daybreak Guard: Ember Charizard', design: 'Ember', artwork: 'Charizard flame field', colour: 'Red', style: 'Full bleed', language: '', set: 'Daybreak Originals', images: [], description: guardDesc, compatibility: 'Standard PSA holder (current label)' },
  [{ ask: 35, cost: 9, qty: 11, locationId: 'loc-guard-box-1', ageDays: 9 }]);
add({ type: 'guard', name: 'Daybreak Guard: Rising Sun Seal', design: 'Rising Sun', artwork: 'Daybreak sun stamp', colour: 'Off-white', style: 'Minimal frame', language: '', set: 'Daybreak Originals', images: [], description: guardDesc, compatibility: 'Standard PSA holder (current label)' },
  [{ ask: 29, cost: 7, qty: 3, locationId: 'loc-guard-box-2', ageDays: 21 }]);

// Recommend guards on matching slabs
P.forEach((p) => {
  if (p.type === 'slab' && p.pokemon === 'Umbreon') p.compatibleGuardIds = [g1];
  if (p.type === 'slab' && p.pokemon === 'Charizard') p.compatibleGuardIds = [g2];
});

// A sold slab to populate "Recently sold"
const soldId = add({ type: 'slab', name: 'Rayquaza VMAX Alternate Art', pokemon: 'Rayquaza', set: 'Evolving Skies', setCode: 'swsh7', number: '218/203', language: 'English', rarity: 'Secret Rare', variant: 'Alternate Art', era: 'Sword & Shield', releaseYear: 2021, images: [ptcg('swsh7', 218)] },
  [{ grade: '9', cert: 'SAMPLE-66123450', ask: 690, cost: 520, marketUsd: 420, status: 'sold', ageDays: 33, locationId: 'loc-slab-display' }]);

export const SEED_PRODUCTS = P;
export const SEED_UNITS = U;

export const SEED_CUSTOMERS = [
  { id: 'c-1', name: 'Sample: Alex Nguyen', email: 'alex@example.com', phone: '', notes: 'Collects JP SARs', createdAt: daysAgo(60).toISOString(), demo: true },
  { id: 'c-2', name: 'Sample: Priya Shah', email: 'priya@example.com', phone: '', notes: '', createdAt: daysAgo(30).toISOString(), demo: true },
  { id: 'c-3', name: 'Sample: Marcus Lee', email: 'marcus@example.com', phone: '', notes: 'Trades vintage', createdAt: daysAgo(12).toISOString(), demo: true },
];

// Demo historical sales so charts have shape. These are flagged demo and cleared with the rest.
export function seedTransactions() {
  const tx = [];
  const ledger = [];
  const soldUnit = U.find((u) => u.productId === soldId);
  const mk = (d, lines, payments, extra = {}) => tx.push({
    id: 't-' + uid(), kind: 'sale', channel: 'pos', at: daysAgo(d).toISOString(), customerId: null, lines, incoming: [], payments,
    discount: 0, notes: 'Sample transaction', demo: true, ...extra,
  });
  const line = (name, price, cost, type, ask = price) => ({ unitId: null, productId: null, name, type, qty: 1, ask, price, cost });
  mk(33, [{ ...line('Rayquaza VMAX Alternate Art PSA 9', 650, 520, 'slab', 690), unitId: soldUnit.id, productId: soldId }], [{ method: 'cash', amount: 400 }, { method: 'card', amount: 250 }], { channel: 'pos' });
  const items = [
    ['Sample: Lillie\'s Clefairy ex SIR', 95, 60, 'single'], ['Sample: Paldean Fates ETB', 120, 82, 'sealed'],
    ['Sample: Daybreak Guard (Ember)', 35, 9, 'guard'], ['Sample: Iono SAR (JP)', 145, 100, 'single'],
    ['Sample: Moonbreon PSA 9', 1450, 1180, 'slab'], ['Sample: Crown Zenith ETB', 85, 60, 'sealed'],
    ['Sample: Daybreak Guard (Midnight)', 35, 9, 'guard'], ['Sample: Gardevoir ex SIR', 70, 45, 'single'],
  ];
  const methods = ['cash', 'card', 'bank', 'cash', 'card'];
  for (let d = 28; d >= 0; d -= 1) {
    const n = (d * 7) % 3;
    for (let k = 0; k < n; k++) {
      const it = items[(d + k) % items.length];
      const m = methods[(d + k) % methods.length];
      mk(d, [line(...it)], [{ method: m, amount: it[1] }], { channel: (d + k) % 4 === 0 ? 'online' : 'pos' });
    }
  }
  // One sample trade with store credit
  ledger.push({ id: 'l-' + uid(), customerId: 'c-1', amount: 120, reason: 'Trade-in credit (sample)', txId: null, at: daysAgo(10).toISOString(), demo: true });
  ledger.push({ id: 'l-' + uid(), customerId: 'c-1', amount: -40, reason: 'Redeemed at POS (sample)', txId: null, at: daysAgo(4).toISOString(), demo: true });
  ledger.push({ id: 'l-' + uid(), customerId: 'c-3', amount: 75, reason: 'Buy sheet credit (sample)', txId: null, at: daysAgo(2).toISOString(), demo: true });
  return { tx, ledger };
}

export const SEED_SETTINGS = {
  business: { name: 'Daybreak Collectibles', email: 'hello@daybreakcollectibles.com.au', instagram: 'https://instagram.com/', abn: '', storefrontUrl: '' },
  logoDataUrl: null,
  banners: [
    { id: 'b1', active: true, eyebrow: 'New this week', title: 'The Asian TCG specialist', subtitle: 'Japanese, Korean and Chinese Pokémon cards, PSA slabs and sealed product, hand-picked in Sydney.', cta: 'Shop new arrivals', link: '/new-arrivals' },
    { id: 'b2', active: true, eyebrow: 'Daybreak Originals', title: 'Extended Art Guards', subtitle: 'Let the artwork run past the label. Designed in-house for standard PSA holders.', cta: 'Explore the guards', link: '/extended-art-guards' },
  ],
  pricing: { mode: 'multiplier', margin: 10, multiplier: 1.1, rounding: 'whole', roundTo: 1 },
  fx: { usdAud: 1.52, eurAud: 1.65, jpyAud: 0.0102, updatedAt: new Date().toISOString(), source: 'Manual entry' },
  shipping: [
    { id: 's1', name: 'Australia Post Standard (tracked)', price: 12, freeOver: 300, domestic: true, active: true },
    { id: 's2', name: 'Australia Post Express (tracked)', price: 18, freeOver: null, domestic: true, active: true },
    { id: 's3', name: 'Signature on delivery (slabs over $500)', price: 25, freeOver: null, domestic: true, active: true },
    { id: 's4', name: 'Local pickup (Sydney card shows)', price: 0, freeOver: null, domestic: true, active: true },
  ],
  international: false,
  discounts: [
    { code: 'DAYBREAK10', type: 'percent', value: 10, active: true, minSpend: 100 },
    { code: 'SHOW20', type: 'fixed', value: 20, active: true, minSpend: 150 },
  ],
  integrations: {
    ptcgApiKey: '', psaToken: '', psaProxyUrl: '', scrydexProxyUrl: '', stripePublishableKey: '', checkoutApiUrl: '', recognitionProvider: 'none', recognitionUrl: '', recognitionKey: '',
  },
  labelTemplate: 'tags-2x4',
  adminPassHash: null,
  newsletter: [],
  reservationMinutes: 15,
  allowNegativeCredit: false,
};
