# Daybreak Collectibles: storefront, inventory & card-show POS

A React (JavaScript) front end for Daybreak Collectibles: a premium customer storefront plus a private admin platform (inventory, scanning, PSA lookup, pricing, buy sheet, trades, store credit, POS / Card Show Mode, orders, labels, reports). Both run on **one shared inventory store**, so a card sold at a show disappears from the website instantly, and an online order removes it from the POS.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173  (admin at /admin)
npm run build        # production build in dist/
npm run build:single # one self-contained index.html (hash routes), used for the preview link
```

The first visit to `/admin` asks you to create a passcode for that device.

## What's in this build

| Area | Status |
|---|---|
| Storefront: home (bento + rails), 4 catalogues with category-specific filters, search with suggestions, product pages per category, wishlist, bag drawer, checkout, order tracking, account, info pages | **Done** |
| Admin: dashboard & charts, inventory (bulk edit/move/publish/archive, CSV import incl. Collectr, CSV/PDF export, duplicate detection), add inventory, scan cards (camera + barcode/QR), PSA lookup, pricing engine & rules, FX, buy sheet, purchases, trade calculator, customers, store credit ledger, POS & Card Show Mode, orders & fulfilment, locations, 4×6 labels, Art Guards, reports, transactions, integration register, settings, backup/restore, audit log | **Done** |
| Single source of truth, per-copy tracking, checkout holds, idempotent sales, cross-tab sync | **Done (on-device)** |
| Card data & images: TCGdex (multilingual), Pokémon TCG API (English, TCGplayer/Cardmarket snapshots) | **Working, no key needed** |
| Exchange rates (open.er-api.com) | **Working** |
| PSA cert verification + slab images | **Needs PSA token** (deploy `api/psa.js`) |
| Scrydex search, graded prices, Vision photo recognition | **Needs Scrydex subscription** (deploy `api/scrydex.js`) |
| Stripe card payments | **Needs Stripe keys + server** (`api/checkout.js`; webhook still to add) |
| TCGplayer direct API | **Not available**: TCGplayer is not issuing new API keys. Its prices arrive via TCGdex / Pokémon TCG API / Scrydex |
| Collectr | **Manual**: no public API; CSV import is built |
| Shared multi-device database, real auth, emails | **Not yet**: needs the Supabase backend (see docs/ARCHITECTURE.md) |

Pokémon TCG API (pokemontcg.io) is scheduled to go offline on **1 March 2027**. The app already falls back to TCGdex, and Scrydex (its official successor) is wired in.

## Important: where data lives today

This build stores everything in the browser (localStorage) on the device you use, and keeps open tabs in sync. That makes it fully usable for trying every workflow, but **your phone and laptop don't share data yet**, and clearing browser data erases it. Use *Settings › Export full backup* regularly. Moving to the Supabase backend (next phase) gives one shared database with real logins.

All sample products, customers and sales are flagged and labelled "Sample". Remove them in *Settings › Remove sample data*.

## Brand

Upload the real crane-and-sun stamp in *Admin › Settings › Brand*. Until then a plain temporary "DB" seal is shown; the logo itself has not been redrawn.

## Deploying (Vercel)

1. Push this folder to GitHub and import it in Vercel (framework: Vite). `vercel.json` handles SPA routes.
2. Environment variables (only for the integrations you use): `PSA_TOKEN`, `SCRYDEX_API_KEY`, `SCRYDEX_TEAM_ID`, `STRIPE_SECRET_KEY`.
3. In *Admin › API Integrations*, set the proxy URLs: `https://your-domain/api/psa`, `https://your-domain/api/scrydex`, and checkout endpoint `/api/checkout` with your Stripe publishable key.

Camera scanning needs HTTPS (or localhost). Automatic barcode detection uses the browser's BarcodeDetector (Chrome on Android/desktop); elsewhere, use capture + search or type the cert.

## Project layout

```
src/data/db.js          single source of truth: inventory, sales, credit, orders, audit
src/data/seed.js        sample data (all flagged demo)
src/services/           cardData (TCGdex, Pokémon TCG API, Scrydex), psa, pricing, recognition
src/store/              customer storefront
src/admin/              admin platform, POS, labels, reports
api/                    serverless proxies (PSA, Scrydex, Stripe checkout)
docs/ARCHITECTURE.md    architecture, database schema, integration register, roadmap
```
