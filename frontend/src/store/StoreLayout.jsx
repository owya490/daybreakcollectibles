import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Wordmark, BRAND } from '../components/Logo.jsx';
import Icon from '../components/Icon.jsx';
import { Drawer, ProductImage, useToast } from '../components/ui.jsx';
import { useShop } from './shop.jsx';
import { useDB, listings, hasDemoData, addNewsletter } from '../data/db.js';
import { matches, metaLine } from './ProductTile.jsx';
import { aud } from '../lib/util.js';

export const JP = { slab: '鑑定品', single: 'シングル', sealed: '未開封', guard: 'アートガード', new: '新着', about: '物語', sets: 'セット' };

const NAV = [
  { to: '/psa-slabs', label: 'PSA Slabs', jp: JP.slab, dd: [
    { h: 'By grade', links: [['PSA 10', '/psa-slabs?grade=PSA 10'], ['PSA 9', '/psa-slabs?grade=PSA 9'], ['PSA 8 and below', '/psa-slabs?grade=PSA 8']] },
    { h: 'By language', links: [['Japanese', '/psa-slabs?language=Japanese'], ['English', '/psa-slabs?language=English'], ['All slabs', '/psa-slabs']] },
  ], note: 'Graded and individually listed with their certification number.' },
  { to: '/singles', label: 'Singles', jp: JP.single, dd: [
    { h: 'Asian prints', links: [['Japanese', '/singles?language=Japanese'], ['Korean', '/singles?language=Korean'], ['Simplified Chinese', '/singles?language=Chinese (Simplified)'], ['Traditional Chinese', '/singles?language=Chinese (Traditional)']] },
    { h: 'Browse', links: [['English', '/singles?language=English'], ['Alternate Art', '/singles?variant=Alternate Art'], ['Special Art Rare', '/singles?variant=Special Art Rare'], ['Shop by set', '/sets']] },
  ], note: 'Raw cards across every major print language.' },
  { to: '/sealed', label: 'Sealed', jp: JP.sealed, dd: [
    { h: 'Product type', links: [['Booster boxes', '/sealed?productType=Booster Box'], ['Elite Trainer Boxes', '/sealed?productType=Elite Trainer Box'], ['Booster bundles', '/sealed?productType=Booster Bundle']] },
    { h: 'Language', links: [['Japanese sealed', '/sealed?language=Japanese'], ['English sealed', '/sealed?language=English']] },
  ], note: 'Factory sealed product, stored and shipped with care.' },
  { to: '/extended-art-guards', label: 'Art Guards', jp: JP.guard },
  { to: '/new-arrivals', label: 'New Arrivals', jp: JP.new },
  { to: '/about', label: 'The House', jp: JP.about },
];

function SearchOverlay({ onClose }) {
  const s = useDB();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [hl, setHl] = useState(-1);
  const all = useMemo(() => listings(s), [s]);
  const results = useMemo(() => (q.trim().length < 2 ? [] : all.filter((l) => matches(l, q)).slice(0, 8)), [q, all]);
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [onClose]);
  const go = (path) => { onClose(); nav(path); };
  return (
    <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Search">
      <div className="so-head"><button className="icon-btn" onClick={onClose} aria-label="Close search"><Icon name="x" /></button></div>
      <form role="search" onSubmit={(e) => { e.preventDefault(); if (hl >= 0 && results[hl]) go(`/item/${results[hl].unitId}`); else if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`); }}>
        <Icon name="search" size={24} stroke={1.2} />
        <input autoFocus aria-label="Search the collection" placeholder="Pokémon, set, number or PSA cert" value={q}
          onChange={(e) => { setQ(e.target.value); setHl(-1); }}
          onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setHl((h) => Math.min(h + 1, results.length - 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setHl((h) => Math.max(h - 1, -1)); } }} />
      </form>
      {!q && <div className="so-hints">{['Charizard', 'Umbreon', 'Japanese', 'PSA 10', 'Booster Box', '151'].map((t) => <button key={t} className="chip" onClick={() => setQ(t)}>{t}</button>)}</div>}
      <div className="so-results">
        {results.map((l, i) => (
          <a key={l.unitId} href="#" className={'res' + (i === hl ? ' hl' : '')} onClick={(e) => { e.preventDefault(); go(`/item/${l.unitId}`); }}>
            <ProductImage product={l} compact />
            <div style={{ minWidth: 0 }}><div className="nm truncate">{l.name}{l.grade ? `, PSA ${l.grade}` : ''}</div><div className="eyebrow muted truncate" style={{ marginTop: 2 }}>{metaLine(l)}{l.language ? ` · ${l.language}` : ''}</div></div>
            <span className="small">{aud(l.ask)}</span>
          </a>
        ))}
        {q.trim().length >= 2 && <div style={{ marginTop: 22 }}><a href="#" className="link" onClick={(e) => { e.preventDefault(); go(`/search?q=${encodeURIComponent(q.trim())}`); }}>{results.length ? `All results for “${q}”` : 'No exact matches. Search anyway'} <Icon name="arrow" size={14} /></a></div>}
      </div>
    </div>
  );
}

function CartDrawer() {
  const shop = useShop();
  const nav = useNavigate();
  if (!shop.cartOpen) return null;
  const blocked = shop.lines.some((l) => l.problem);
  return (
    <Drawer title="Your bag" onClose={() => shop.setCartOpen(false)} footer={shop.lines.length > 0 && (
      <div className="stack">
        <div className="sum-row total" style={{ borderTop: 0, marginTop: 0, paddingTop: 0 }}><span>Subtotal</span><span>{aud(shop.subtotal)}</span></div>
        <p className="tiny muted">Shipping and codes are applied at checkout. Prices in AUD.</p>
        <button className="btn lg block" disabled={blocked} onClick={() => { shop.setCartOpen(false); nav('/checkout'); }}>Checkout</button>
        {blocked && <p className="err">Remove sold items to continue.</p>}
      </div>
    )}>
      {shop.lines.length === 0 ? (
        <div className="empty"><div className="serif">Your bag is empty</div><p>Each piece is one of a kind. When it is gone, it is gone.</p>
          <button className="btn secondary" style={{ marginTop: 22 }} onClick={() => { shop.setCartOpen(false); nav('/new-arrivals'); }}>New arrivals</button></div>
      ) : shop.lines.map((l) => (
        <div className="cline" key={l.unitId}>
          <Link to={`/item/${l.unitId}`} onClick={() => shop.setCartOpen(false)}><ProductImage product={l.product} compact /></Link>
          <div style={{ minWidth: 0 }}>
            <div className="nm">{l.product.name}{l.unit.grade ? `, PSA ${l.unit.grade}` : ''}</div>
            <div className="eyebrow muted" style={{ marginTop: 4 }}>{l.product.set}{l.unit.condition && l.product.type !== 'slab' ? ` · ${l.unit.condition}` : ''}</div>
            {l.problem && <div className="err tiny">{l.problem}</div>}
            {l.unit.qty > 1 && !l.problem?.startsWith('Sold') && (
              <div className="qty" style={{ height: 32, marginTop: 8 }}>
                <button onClick={() => shop.setQty(l.unitId, l.qty - 1)} aria-label="Decrease">−</button><span>{l.qty}</span>
                <button onClick={() => shop.setQty(l.unitId, Math.min(l.qty + 1, l.available))} aria-label="Increase">+</button>
              </div>
            )}
          </div>
          <div className="right">
            <div>{aud(l.price * l.qty)}</div>
            <button className="btn ghost sm" style={{ padding: 0, marginTop: 4 }} onClick={() => shop.remove(l.unitId)}>Remove</button>
          </div>
        </div>
      ))}
    </Drawer>
  );
}

function Footer() {
  const biz = useDB((s) => s.settings.business);
  const toast = useToast();
  const [email, setEmail] = useState('');
  const handle = (biz.instagram || '').replace(/\/$/, '').split('/').pop() || 'daybreakcollectibles';
  return (
    <footer className="s-footer">
      <div className="band" style={{ backgroundImage: `url(${BRAND.cloudBand})` }} aria-hidden="true" />
      <div className="wrap">
        <div className="f-brand">
          <img src={BRAND.crest} alt="" style={{ height: 92, width: 'auto' }} />
          <span className="eyebrow">Buy <span style={{ opacity: 0.6 }}>·</span> Sell <span style={{ opacity: 0.6 }}>·</span> Trade</span>
          <img className="wm" src={BRAND.wordmarkCream} alt="Daybreak Collectibles" />
        </div>
        <div className="cols">
          <div><h6>Collection</h6><Link to="/psa-slabs">PSA Slabs</Link><Link to="/singles">Singles</Link><Link to="/sealed">Sealed</Link><Link to="/extended-art-guards">Extended Art Guards</Link><Link to="/new-arrivals">New Arrivals</Link><Link to="/recently-sold">Recently Sold</Link></div>
          <div><h6>Client care</h6><Link to="/contact">Contact</Link><Link to="/shipping-returns">Shipping & Returns</Link><Link to="/account">Orders & tracking</Link><Link to="/account">Account</Link></div>
          <div><h6>The house</h6><Link to="/about">Our story</Link><a href={biz.instagram} target="_blank" rel="noreferrer">Instagram @{handle}</a><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/admin">Staff login</Link></div>
          <div>
            <h6>New arrivals, first</h6>
            <p style={{ fontSize: 14, color: 'rgba(242,232,206,0.8)', maxWidth: 340 }}>Occasional letters when notable pieces arrive. Nothing more.</p>
            <form className="news" onSubmit={(e) => { e.preventDefault(); if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Enter a valid email', 'err'); addNewsletter(email); setEmail(''); toast('Thank you. You are on the list.'); }}>
              <input className="input" type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Newsletter email" />
              <button className="btn outline-cream sm">Join</button>
            </form>
          </div>
        </div>
        <div className="legal"><span>© {new Date().getFullYear()} {biz.name} · Sydney · Est. 2026 · Prices in AUD</span><span>Pokémon is a trademark of Nintendo, Creatures and GAME FREAK. Daybreak is not affiliated with The Pokémon Company.</span></div>
      </div>
    </footer>
  );
}

export default function StoreLayout() {
  const shop = useShop();
  const demo = useDB(hasDemoData);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const loc = useLocation();
  useEffect(() => { setMenu(false); setSearch(false); }, [loc.pathname, loc.search]);
  return (
    <div className="store">
      <div className="announce">
        {demo ? <><span className="long">Preview with sample inventory<span className="dot" />Listings shown are demonstration records, not Daybreak stock<span className="dot" /></span><span className="short">Preview · sample inventory<span className="dot" /></span><Link to="/admin/settings">Manage</Link></>
          : <>Buy<span className="dot" />Sell<span className="dot" />Trade<span className="dot" />Sydney card shows & online</>}
      </div>
      <header className="s-header">
        <div className="wrap s-header-inner">
          <div className="left">
            <button className="icon-btn mobile-only" onClick={() => setMenu(true)} aria-label="Open menu"><Icon name="menu" stroke={1.4} /></button>
            <button className="icon-btn" onClick={() => setSearch(true)} aria-label="Search"><Icon name="search" stroke={1.4} /></button>
            <span className="tagline">The house of Daybreak</span>
          </div>
          <Link to="/" className="brand-link" aria-label="Daybreak Collectibles home"><Wordmark height={46} /></Link>
          <div className="s-actions">
            <Link className="icon-btn desk-only" to="/account" aria-label="Account"><Icon name="user" stroke={1.4} /></Link>
            <Link className="icon-btn" to="/wishlist" aria-label="Wishlist"><Icon name="heart" stroke={1.4} />{shop.wish.length > 0 && <span className="count">{shop.wish.length}</span>}</Link>
            <button className="icon-btn" onClick={() => shop.setCartOpen(true)} aria-label={`Bag, ${shop.count} items`}><Icon name="bag" stroke={1.4} />{shop.count > 0 && <span className="count">{shop.count}</span>}</button>
          </div>
        </div>
        <nav className="s-nav" aria-label="Main">
          {NAV.map((n) => (
            <div className="nav-item" key={n.to}>
              <NavLink to={n.to} className={({ isActive }) => 'top' + (isActive ? ' active' : '')}>{n.label}</NavLink>
              {n.dd && (
                <div className="dd">
                  <div className="dd-inner">
                    {n.dd.map((g) => <div key={g.h}><h5>{g.h}</h5>{g.links.map(([l, to]) => <Link key={to} to={to}>{l}</Link>)}</div>)}
                    <div className="dd-feature"><span className="jp">{n.jp}</span><p className="small muted">{n.note}</p><Link to={n.to} className="link" style={{ alignSelf: 'flex-start' }}>View all {n.label} <Icon name="arrow" size={14} /></Link></div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>
      </header>
      <main style={{ flex: 1 }}><Outlet /></main>
      <Footer />
      <CartDrawer />
      {search && <SearchOverlay onClose={() => setSearch(false)} />}
      {menu && (
        <Drawer title="Menu" side="left" onClose={() => setMenu(false)}>
          <nav className="m-menu">
            {NAV.map((n) => <Link key={n.to} to={n.to}>{n.label}<span className="jp small muted">{n.jp}</span></Link>)}
            <h5 className="eyebrow">Browse</h5>
            <Link to="/featured">Featured<Icon name="right" size={16} /></Link>
            <Link to="/sets">Shop by set<Icon name="right" size={16} /></Link>
            <Link to="/recently-sold">Recently sold<Icon name="right" size={16} /></Link>
            <h5 className="eyebrow">Client care</h5>
            <Link to="/account">Account & orders<Icon name="right" size={16} /></Link>
            <Link to="/shipping-returns">Shipping & returns<Icon name="right" size={16} /></Link>
            <Link to="/contact">Contact<Icon name="right" size={16} /></Link>
          </nav>
        </Drawer>
      )}
    </div>
  );
}
