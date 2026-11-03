# Daybreak platform: architecture & technical plan

## 1. Reference research (Phase 1)

**Poki Center storefront (showcasetcg.app/pokicenter), audited live:**
- Minimal top bar (menu, store name with live card count, bag); a **floating search pill** fixed at the bottom of every page with a context-aware placeholder ("Search these cards", "Search sets").
- Home is a **bento grid of tiles**: Featured (hand-picked), New arrivals, Shop by set (set count), Language (EN/JP/CN), Shop by budget (price chips with counts), Accessories, Recently sold (count), View all (count). Tiles show fanned card art.
- Browse grid: **full-bleed card art tiles** with name, number, price and a condition chip overlaid at the bottom.
- **Filter drawer** from the right: sort chips, price buckets with counts, availability (in stock / sold out with counts), language, set chips with counts, sticky "Show N cards" button.
- Item page: large card image beside a **floating info card**: name, set and number, condition and "Last one" chips, price, "Negotiable", add button.
- **Slide-out bag drawer**; Shop by set as a list with release month, card count and a JP/CN/EN toggle.

Daybreak adopts that information architecture (bento home, floating search, overlay tiles, faceted drawer with counts, floating product panel, bag drawer, set list with language toggle, recently sold) with its own identity: deep indigo `#00009E`, warm off-white `#D8D2B3`, lacquer red accents, Cormorant Garamond headings and Inter for data. It adds what a full retailer needs: desktop mega-menu, category-specific catalogues and product templates, wishlist, real checkout, accounts and tracking.

**Cardventory / Zoho Inventory patterns used in admin:** instant price lookup with variants and sources; per-unit inventory with cost/ask/location; buy sheet and trade-in with cash vs credit split; store credit ledger; fast POS with mixed payments; containers/locations with bulk transfer; label printing sorted by location; publish-to-storefront toggle; CSV import/export.

## 2. Application architecture

```
React SPA (Vite)  ──>  Data layer (src/data/db.js)  ──>  today: localStorage + cross-tab sync
   storefront /          atomic operations:                next: Supabase (Postgres + Auth + Storage)
   admin / POS           addInventory, reserve,
                         recordTransaction, createOrder...
        │
        └── services/  ──> TCGdex, Pokémon TCG API (direct, CORS)
                       ──> /api/psa, /api/scrydex, /api/checkout (serverless, keys server-side)
```

Every write goes through one module of validate-then-apply functions. Swapping localStorage for Supabase means re-implementing those functions as Postgres RPCs (`security definer` functions running in a transaction) and keeping the UI unchanged.

### Recommended production stack
- **Frontend:** this React app (can move to Next.js later for SEO/SSR of product pages).
- **Database/Auth/Storage:** Supabase. Roles: `admin`, `staff` (POS only), `customer`. Row-level security so customers can only read published listings and their own orders.
- **Payments:** Stripe Checkout (AUD) + webhook `checkout.session.completed` → `record_sale` RPC.
- **Hosting:** Vercel (static app + `/api` functions).
- **Realtime:** Supabase Realtime on `inventory_units` so every open storefront and POS updates instantly.

## 3. Database schema (Postgres)

```sql
create table products (            -- catalogue: one row per card / sealed item / guard design
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('slab','single','sealed','guard')),
  tcg text not null default 'pokemon',          -- future TCGs
  name text not null, pokemon text, set_name text, set_code text, card_number text,
  language text, rarity text, variant text, era text, release_year int,
  product_type text, barcode text,              -- sealed
  design text, artwork text, colour text, style text, compatibility text,  -- guards
  description text, featured boolean default false, external_ids jsonb default '{}',
  is_demo boolean default false, created_at timestamptz default now(), updated_at timestamptz default now()
);
create unique index products_identity on products (type, lower(name), set_code, card_number, language, variant);

create table inventory_locations (id uuid primary key default gen_random_uuid(), name text not null, parent_id uuid references inventory_locations);

create table inventory_units (     -- physical copies (slabs always qty 1)
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products,
  sku text unique not null, qty int not null default 1 check (qty >= 0),
  condition text, psa_grade text, psa_cert text, cert_verified boolean default false, cert_verified_at timestamptz,
  cost numeric(12,2) not null default 0, ask numeric(12,2) not null,
  market jsonb,                     -- {value,currency,aud,source,fxRate,fxAt,updatedAt}
  location_id uuid references inventory_locations,
  status text not null default 'available' check (status in ('available','reserved','sold','archived')),
  published boolean default true, negotiable boolean default false,
  acquired_at timestamptz, sold_at timestamptz, label_printed_at timestamptz,
  version int not null default 1,   -- optimistic concurrency
  created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint slab_single check (psa_cert is null or qty <= 1)
);
create unique index units_cert on inventory_units (psa_cert) where psa_cert is not null and status <> 'archived';

create table reservations (unit_id uuid references inventory_units, holder text, qty int, expires_at timestamptz, primary key (unit_id, holder));
create table images (id uuid primary key default gen_random_uuid(), product_id uuid references products, unit_id uuid references inventory_units, url text, source text, attribution text, sort int, created_at timestamptz default now());
create table price_history (id bigserial primary key, unit_id uuid, product_id uuid, value numeric, currency text, aud numeric, source text, fx_rate numeric, at timestamptz default now());
create table customers (id uuid primary key default gen_random_uuid(), auth_user_id uuid, name text, email text unique, phone text, notes text, created_at timestamptz default now());
create table transactions (id uuid primary key default gen_random_uuid(), kind text check (kind in ('sale','trade','purchase','refund')), channel text, customer_id uuid references customers, order_id uuid, credit_issued numeric(12,2) default 0, notes text, idempotency_key text unique not null, created_by uuid, at timestamptz default now());
create table transaction_lines (id bigserial primary key, transaction_id uuid references transactions, direction text check (direction in ('out','in')), unit_id uuid references inventory_units, product_id uuid, qty int, listed_price numeric(12,2), price numeric(12,2), cost numeric(12,2));
create table payments (id bigserial primary key, transaction_id uuid references transactions, method text check (method in ('cash','card','bank','credit')), amount numeric(12,2), provider_ref text);
create table store_credit_ledger (id bigserial primary key, customer_id uuid references customers, amount numeric(12,2) not null, reason text not null, transaction_id uuid, created_by uuid, at timestamptz default now());
create table online_orders (id uuid primary key default gen_random_uuid(), number text unique, customer_id uuid references customers, status text, items jsonb, shipping_address jsonb, shipping_method text, shipping numeric, discount_code text, discount numeric, credit_applied numeric, total numeric, payment jsonb, transaction_id uuid, created_at timestamptz default now());
create table shipments (id uuid primary key default gen_random_uuid(), order_id uuid references online_orders, carrier text, tracking_number text, shipped_at timestamptz);
create table discounts (code text primary key, type text, value numeric, min_spend numeric, active boolean);
create table api_integrations (id text primary key, config jsonb, last_ok_at timestamptz, last_error text);  -- no secrets: those live in env vars
create table audit_log (id bigserial primary key, actor uuid, action text, entity text, entity_id text, detail jsonb, at timestamptz default now());
```

## 4. Synchronisation & concurrency

- **One source of truth:** storefront listings are a view over `inventory_units` where `published and status='available' and qty - reserved > 0`.
- **Checkout holds:** entering checkout inserts `reservations` (15 min, configurable); bank-transfer orders hold for 3 days. Expired holds are ignored.
- **Recording a sale** (`record_sale` RPC): `select ... for update` on the units, re-check availability, decrement qty, mark sold at 0, insert lines/payments/ledger, all in one transaction. Two buyers can't both get a one-off slab: the second fails cleanly with "just sold".
- **Idempotency:** every POS/online submission carries an `idempotency_key`; replays (double taps, offline resync, webhook retries) return the original transaction.
- **Offline POS:** cart and pending sales persist on-device; card payments are disabled offline (a payment provider is needed for that); on reconnect the outbox is replayed with idempotency keys, and any conflict (item sold online meanwhile) is surfaced for manual resolution rather than overselling.
- **Money model:** revenue = realised sale price; COGS = unit cost; trade-ins become inventory at agreed value; store credit is a liability ledger that can't go negative without explicit authorisation.

## 5. Integration register (verified November 2026)

| Provider | Data | Languages | Images | Pricing | Auth | Limits / terms | Fallback |
|---|---|---|---|---|---|---|---|
| TCGdex | Cards, sets, variants | 10+ incl. JA, Trad. Chinese | Yes | Partial TCGplayer/Cardmarket | None | Free, open source | Manual |
| Pokémon TCG API | English cards | EN | Yes | TCGplayer USD, Cardmarket EUR snapshots | Optional key | **Offline 1 Mar 2027** | TCGdex |
| Scrydex | Cards, sealed, raw & graded prices, pop reports, Vision | EN, JA | Yes | Yes | Key + Team ID, server-side | Paid credits | TCGdex |
| PSA Public API | Cert details, slab images | n/a | Yes where available | No | Bearer token | 100 calls/day free | Manual, marked unverified |
| TCGplayer | Marketplace | EN | Yes | Yes | Dev key | **No new access** | Via other APIs |
| Collectr | Portfolio | n/a | No | Export values | None | No public API | CSV import |
| Stripe | Payments | AUD | n/a | n/a | Keys | Fees | Bank transfer |
| open.er-api.com | FX | n/a | n/a | n/a | None | Daily | Manual rate |

Korean and Simplified Chinese prints have thin free API coverage; those use manual entry with your own photos until a provider is added.

## 6. Next phases

1. **Backend (highest priority):** Supabase project, schema above, RPCs mirroring `db.js`, Auth (magic link for customers, password + role for admin), Storage for photos, Realtime. Migrate data with the JSON backup.
2. **Payments:** Stripe webhook → `record_sale`; refunds via API.
3. **Email:** order confirmation, shipping, bank-transfer instructions (Resend/Postmark).
4. **Shipping:** Australia Post / Sendle API for live rates and labels.
5. **Scrydex:** subscribe, deploy proxy, enable Vision for one-tap raw card scans and graded price references.
