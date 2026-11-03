import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import Icon from '../components/Icon.jsx';
import { Drawer, ProductImage, useToast } from '../components/ui.jsx';
import { useShop } from './shop.jsx';
import { useDB, listings, hasDemoData, addNewsletter } from '../data/db.js';
import { matches, metaLine } from './ProductTile.jsx';
import { aud } from '../lib/util.js';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/psa-slabs', label: 'PSA Slabs', dd: [
    { h: 'By grade', links: [['PSA 10', '/psa-slabs?grade=PSA 10'], ['PSA 9', '/psa-slabs?grade=PSA 9'], ['PSA 8 and below', '/psa-slabs?grade=PSA 8']] },
    { h: 'By language', links: [['Japanese slabs', '/psa-slabs?language=Japanese'], ['English slabs', '/psa-slabs?language=English'], ['All slabs', '/psa-slabs']] },
  ] },
  { to: '/singles', label: 'Singles', dd: [
    { h: 'Asian prints', links: [['Japanese', '/singles?language=Japanese'], ['Korean', '/singles?language=Korean'], ['Simplified Chinese', '/singles?language=Chinese (Simplified)'], ['Traditional Chinese', '/singles?language=Chinese (Traditional)']] },
    { h: 'Browse', links: [['English', '/singles?language=English'], ['Alternate Art', '/singles?variant=Alternate Art'], ['Special Art Rare', '/singles?variant=Special Art Rare'], ['Shop by set', '/sets']] },
  ] },
  { to: '/sealed', label: 'Sealed', dd: [
    { h: 'Product type', links: [['Booster Boxes', '/sealed?productType=Booster Box'], ['Elite Trainer Boxes', '/sealed?productType=Elite Trainer Box'], ['Booster Bundles', '/sealed?productType=Booster Bundle']] },
    { h: 'Language', links: [['Japanese sealed', '/sealed?language=Japanese'], ['English sealed', '/sealed?language=English']] },
  ] },
  { to: '/extended-art-guards', label: 'Extended Art Guards' },
  { to: '/new-arrivals', label: 'New Arrivals' },
  { to: '/about', label: 'About Us' },
];

function searchPlaceholder(pathname) {
  if (pathname.startsWith('/psa-slabs')) return 'Search slabs, grade or cert number';
  if (pathname.startsWith('/singles')) return 'Search singles by name, set or number';
  if (pathname.startsWith('/sealed')) return 'Search sealed product';
  if (pathname.startsWith('/extended-art-guards')) return 'Search guard designs';
  if (pathname.startsWith('/sets')) return 'Search sets';
  return 'Search Pokémon, set, number or PSA cert';
}

function FloatingSearch() {
  const s = useDB();
  const loc = useLocation();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hl, setHl] = useState(-1); // -1 = Enter runs a full search; arrows pick a suggestion
  const box = useRef(null);
  const all = useMemo(() => listings(s), [s]);
  const results = useMemo(() => (q.trim().length < 2 ? [] : all.filter((l) => matches(l, q)).slice(0, 7)), [q, all]);
  useEffect(() => { setOpen(false); setQ(''); }, [loc.pathname]);
  useEffect(() => {
    const h = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', h);
    return () => document.removeEventListener('pointerdown', h);
  }, []);
  if (loc.pathname.startsWith('/checkout')) return null;
  const go = () => { if (q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`); };
  return (
    <div className="float-search" ref={box}>
      {open && results.length > 0 && (
        <div className="suggest" role="listbox">
          {results.map((l, i) => (
            <Link key={l.unitId} to={`/item/${l.unitId}`} className={i === hl ? 'hl' : ''} role="option">
              <div className="thumb"><ProductImage product={l} compact /></div>
              <div className="grow">
                <div style={{ fontWeight: 600, fontSize: 14 }} className="truncate">{l.name}{l.grade ? ` · PSA ${l.grade}` : ''}</div>
                <div className="tiny muted truncate">{metaLine(l)} · {l.language || 'Daybreak'}</div>
              </div>
              <b className="small">{aud(l.ask)}</b>
            </Link>
          ))}
          <a className="all" href="#" onClick={(e) => { e.preventDefault(); go(); }}>See all results for "{q}"</a>
        </div>
      )}
      <form className="pill" role="search" onSubmit={(e) => { e.preventDefault(); if (open && hl >= 0 && results[hl]) nav(`/item/${results[hl].unitId}`); else go(); }}>
        <Icon name="search" size={18} style={{ color: 'var(--ink-3)' }} />
        <input aria-label="Search the store" placeholder={searchPlaceholder(loc.pathname)} value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setHl(-1); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setHl((h) => Math.min(h + 1, results.length - 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setHl((h) => Math.max(h - 1, 0)); } }} />
        {q && <button type="button" className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => setQ('')} aria-label="Clear search"><Icon name="x" size={16} /></button>}
        <button className="btn sm" type="submit">Search</button>
      </form>
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
        <p className="tiny muted">Shipping and discount codes are applied at checkout. Prices in AUD, GST inclusive where applicable.</p>
        <button className="btn lg block" disabled={blocked} onClick={() => { shop.setCartOpen(false); nav('/checkout'); }}>Checkout</button>
        {blocked && <p className="err">Remove sold-out items to continue.</p>}
      </div>
    )}>
      {shop.lines.length === 0 ? (
        <div className="empty"><div className="serif">Your bag is empty</div><p>Every card is one of a kind. When it's gone, it's gone.</p>
          <button className="btn secondary" style={{ marginTop: 16 }} onClick={() => { shop.setCartOpen(false); nav('/new-arrivals'); }}>See new arrivals</button></div>
      ) : shop.lines.map((l) => (
        <div className="cline" key={l.unitId}>
          <Link to={`/item/${l.unitId}`} onClick={() => shop.setCartOpen(false)}><ProductImage product={l.product} compact /></Link>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.25 }}>{l.product.name}{l.unit.grade ? ` · PSA ${l.unit.grade}` : ''}</div>
            <div className="tiny muted">{l.product.set}{l.unit.condition && l.product.type !== 'slab' ? ` · ${l.unit.condition}` : ''}</div>
            {l.problem && <div className="err tiny">{l.problem}</div>}
            {l.unit.qty > 1 && !l.problem?.startsWith('Sold') && (
              <div className="qty" style={{ height: 32, marginTop: 6 }}>
                <button onClick={() => shop.setQty(l.unitId, l.qty - 1)} aria-label="Decrease">−</button><span>{l.qty}</span>
                <button onClick={() => shop.setQty(l.unitId, Math.min(l.qty + 1, l.available))} aria-label="Increase">+</button>
              </div>
            )}
          </div>
          <div className="right">
            <div style={{ fontWeight: 700 }}>{aud(l.price * l.qty)}</div>
            <button className="btn ghost sm" onClick={() => shop.remove(l.unitId)}>Remove</button>
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
  return (
    <footer className="s-footer">
      <div className="wrap">
        <div className="cols">
          <div>
            <Logo inverse />
            <p style={{ marginTop: 14, maxWidth: 320, fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>An Asian TCG specialist. PSA slabs, curated singles, sealed product and Daybreak Extended Art Guards. Sydney, Australia.</p>
            <form className="news" onSubmit={(e) => { e.preventDefault(); if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Enter a valid email', 'err'); addNewsletter(email); setEmail(''); toast('Subscribed. Watch for new drops.'); }}>
              <input className="input" type="email" placeholder="Email for new drops" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Newsletter email" />
              <button className="btn cream">Join</button>
            </form>
          </div>
          <div><h6>Shop</h6><Link to="/psa-slabs">PSA Slabs</Link><Link to="/singles">Singles</Link><Link to="/sealed">Sealed</Link><Link to="/extended-art-guards">Extended Art Guards</Link><Link to="/new-arrivals">New Arrivals</Link><Link to="/recently-sold">Recently Sold</Link></div>
          <div><h6>Support</h6><Link to="/contact">Contact</Link><Link to="/shipping-returns">Shipping & Returns</Link><Link to="/account">Order tracking</Link><Link to="/account">My account</Link></div>
          <div><h6>Daybreak</h6><Link to="/about">About Us</Link><a href={biz.instagram} target="_blank" rel="noreferrer">Instagram</a><Link to="/privacy">Privacy Policy</Link><Link to="/terms">Terms & Conditions</Link><Link to="/admin">Staff login</Link></div>
        </div>
        <div className="legal"><span>© {new Date().getFullYear()} {biz.name}. Prices in AUD.</span><span>Pokémon and all related names are trademarks of Nintendo, Creatures and GAME FREAK. Daybreak is not affiliated with The Pokémon Company.</span></div>
      </div>
    </footer>
  );
}

export default function StoreLayout() {
  const shop = useShop();
  const demo = useDB(hasDemoData);
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => setMenu(false), [loc.pathname, loc.search]);
  return (
    <div className="store">
      {demo && <div className="demo-strip">Preview with <b>sample inventory</b>. Items marked "Sample" are demonstration records, not Daybreak stock. <Link to="/admin/settings">Manage data</Link></div>}
      <header className="s-header">
        <div className="wrap s-header-inner">
          <button className="icon-btn mobile-only menu-btn" onClick={() => setMenu(true)} aria-label="Open menu"><Icon name="menu" /></button>
          <Link to="/" aria-label="Daybreak Collectibles home"><Logo /></Link>
          <nav className="s-nav" aria-label="Main">
            {NAV.map((n) => (
              <div className="nav-item" key={n.to}>
                <NavLink to={n.to} end={n.end} className={({ isActive }) => 'top' + (isActive ? ' active' : '')}>{n.label}{n.dd && <Icon name="down" size={14} style={{ marginLeft: 3, opacity: 0.6 }} />}</NavLink>
                {n.dd && <div className="dd">{n.dd.map((g) => <div key={g.h}><h5>{g.h}</h5>{g.links.map(([l, to]) => <Link key={to} to={to}>{l}</Link>)}</div>)}</div>}
              </div>
            ))}
          </nav>
          <div className="s-actions">
            <Link className="icon-btn" to="/account" aria-label="Account"><Icon name="user" /></Link>
            <Link className="icon-btn" to="/wishlist" aria-label="Wishlist"><Icon name="heart" />{shop.wish.length > 0 && <span className="count">{shop.wish.length}</span>}</Link>
            <button className="icon-btn" onClick={() => shop.setCartOpen(true)} aria-label={`Bag, ${shop.count} items`}><Icon name="bag" />{shop.count > 0 && <span className="count">{shop.count}</span>}</button>
          </div>
        </div>
      </header>
      <main style={{ flex: 1 }}><Outlet /></main>
      <Footer />
      <FloatingSearch />
      <CartDrawer />
      {menu && (
        <Drawer title="Menu" side="left" onClose={() => setMenu(false)}>
          <nav className="m-menu">
            {NAV.map((n) => <Link key={n.to} to={n.to}>{n.label}<Icon name="right" size={16} /></Link>)}
            <h5 className="upper">Browse</h5>
            <Link to="/featured">Featured<Icon name="right" size={16} /></Link>
            <Link to="/sets">Shop by set<Icon name="right" size={16} /></Link>
            <Link to="/shop?max=50">Under $50<Icon name="right" size={16} /></Link>
            <Link to="/recently-sold">Recently sold<Icon name="right" size={16} /></Link>
            <h5 className="upper">Help</h5>
            <Link to="/account">Account & orders<Icon name="right" size={16} /></Link>
            <Link to="/shipping-returns">Shipping & returns<Icon name="right" size={16} /></Link>
            <Link to="/contact">Contact<Icon name="right" size={16} /></Link>
          </nav>
        </Drawer>
      )}
    </div>
  );
}
