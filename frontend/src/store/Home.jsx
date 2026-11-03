import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDB, listings } from '../data/db.js';
import { ProductImage } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import ProductTile from './ProductTile.jsx';

function Fan({ items, n = 3 }) {
  const pick = items.slice(0, n);
  if (!pick.length) return null;
  return <div className="fan">{pick.map((l) => <ProductImage key={l.unitId} product={l} compact />)}</div>;
}

function Rail({ title, sub, to, items }) {
  if (!items.length) return null;
  return (
    <section className="section">
      <div className="section-head">
        <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
        <Link to={to}>View all <Icon name="arrow" size={15} style={{ verticalAlign: -3 }} /></Link>
      </div>
      <div className="rail">{items.slice(0, 12).map((l) => <ProductTile key={l.unitId} l={l} />)}</div>
    </section>
  );
}

export default function Home() {
  const s = useDB();
  const all = useMemo(() => listings(s), [s]);
  const sold = useMemo(() => listings(s, { includeSold: true }).filter((l) => l.status === 'sold'), [s]);
  const avail = all.filter((l) => l.available > 0);
  const newest = [...avail].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const featured = avail.filter((l) => l.featured);
  const by = (fn) => avail.filter(fn);
  const banners = s.settings.banners.filter((b) => b.active);
  const [bi, setBi] = useState(0);
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setBi((i) => (i + 1) % banners.length), 7000);
    return () => clearInterval(t);
  }, [banners.length]);
  const b = banners[bi % Math.max(1, banners.length)];
  const heroCards = (featured.length >= 3 ? featured : newest).filter((l) => l.images?.length).slice(0, 3);
  const langs = [...new Set(avail.map((l) => l.language).filter(Boolean))];
  const sets = new Set(avail.filter((l) => l.type !== 'guard').map((l) => l.set));
  const under50 = by((l) => l.ask < 50).length;
  const b50_200 = by((l) => l.ask >= 50 && l.ask < 200).length;
  const over200 = by((l) => l.ask >= 200).length;

  return (
    <div className="wrap" style={{ paddingBottom: 40 }}>
      {b && (
        <section className="hero" aria-roledescription="carousel">
          <div className="hero-copy">
            <span className="upper">{b.eyebrow}</span>
            <h1>{b.title}</h1>
            <p>{b.subtitle}</p>
            <div className="row wrap" style={{ marginTop: 6 }}>
              <Link to={b.link || '/shop'} className="btn cream lg">{b.cta || 'Shop now'}</Link>
              <Link to="/psa-slabs" className="btn ghost lg" style={{ color: '#fff' }}>PSA slabs <Icon name="arrow" size={16} /></Link>
            </div>
          </div>
          <div className="hero-art">
            <div className="hero-sun" />
            <div className="hero-fan">{heroCards.map((l) => <ProductImage key={l.unitId} product={l} />)}</div>
          </div>
          {banners.length > 1 && <div className="hero-dots">{banners.map((x, i) => <button key={x.id} className={i === bi ? 'on' : ''} onClick={() => setBi(i)} aria-label={`Show banner ${i + 1}`} />)}</div>}
        </section>
      )}

      <section className="bento" aria-label="Browse the collection">
        <Link to="/featured" className="tile big">
          <Fan items={featured.filter((l) => l.images?.length)} />
          <span className="badge solid" style={{ alignSelf: 'flex-start', marginBottom: 8 }}>Hand-picked</span>
          <h3 style={{ fontSize: 38 }}>Featured</h3>
          <div className="sub">The pieces collectors ask about.</div>
          <Icon name="arrow" className="arrow" />
        </Link>
        <Link to="/new-arrivals" className="tile wide indigo">
          <Fan items={newest.filter((l) => l.images?.length)} />
          <h3>New arrivals</h3><div className="sub">Just in. First come, first served.</div>
        </Link>
        <Link to="/psa-slabs" className="tile"><Fan items={by((l) => l.type === 'slab' && l.images?.length)} n={2} /><h3>PSA Slabs</h3><div className="sub">{by((l) => l.type === 'slab').length} graded</div><Icon name="right" className="arrow" size={18} /></Link>
        <Link to="/sets" className="tile cream"><h3>Shop by set</h3><div className="sub">{sets.size} sets</div><Icon name="right" className="arrow" size={18} /></Link>
        <Link to="/shop?budget=1" className="tile wide">
          <h3>Shop by budget</h3><div className="sub">Something great at every price.</div>
          <div className="chips">
            <span className="badge">Under $50 · {under50}</span><span className="badge">$50 to $200 · {b50_200}</span><span className="badge">$200+ · {over200}</span>
          </div>
        </Link>
        <Link to="/singles?language=Japanese" className="tile"><Fan items={by((l) => l.language === 'Japanese' && l.images?.length)} n={2} /><h3>Language</h3><div className="sub">{langs.slice(0, 3).join(' · ')}{langs.length > 3 ? ` +${langs.length - 3}` : ''}</div><Icon name="right" className="arrow" size={18} /></Link>
        <Link to="/extended-art-guards" className="tile indigo"><h3>Art Guards</h3><div className="sub">Daybreak Originals</div><Icon name="right" className="arrow" size={18} /></Link>
        <Link to="/sealed" className="tile"><h3>Sealed</h3><div className="sub">{by((l) => l.type === 'sealed').length} products</div><Icon name="right" className="arrow" size={18} /></Link>
        <Link to="/recently-sold" className="tile cream"><Fan items={sold.filter((l) => l.images?.length)} n={2} /><h3>Recently sold</h3><div className="sub">{sold.length} found new homes</div><Icon name="right" className="arrow" size={18} /></Link>
        <Link to="/shop" className="tile wide"><h3>View all</h3><div className="sub">The full case · {avail.length} listings</div><Icon name="arrow" className="arrow" /></Link>
      </section>

      <Rail title="Latest arrivals" sub="Fresh to the case this week." to="/new-arrivals" items={newest} />
      <Rail title="Featured PSA slabs" sub="Graded, verified, ready for the display." to="/psa-slabs" items={by((l) => l.type === 'slab')} />
      <Rail title="Japanese Pokémon cards" sub="Our specialty. Sourced direct." to="/shop?language=Japanese" items={by((l) => l.language === 'Japanese')} />
      <Rail title="Asian prints" sub="Korean, Simplified and Traditional Chinese." to="/singles?language=Korean" items={by((l) => ['Korean', 'Chinese (Simplified)', 'Chinese (Traditional)'].includes(l.language))} />
      <Rail title="English Pokémon cards" to="/shop?language=English" items={by((l) => l.language === 'English')} />
      <Rail title="Sealed product" sub="Booster boxes, ETBs and bundles." to="/sealed" items={by((l) => l.type === 'sealed')} />
      <Rail title="Extended Art Guards" sub="Designed in-house for PSA holders." to="/extended-art-guards" items={by((l) => l.type === 'guard')} />
      <Rail title="Staff picks" sub="Chosen by the Daybreak team." to="/featured" items={featured} />

      <section className="intro">
        <div className="left">
          <span className="upper">The house of Daybreak</span>
          <h2 style={{ marginTop: 10 }}>An Asian TCG specialist, built at the card show table.</h2>
          <p style={{ marginTop: 14, fontSize: 16, lineHeight: 1.7 }}>We buy, sell and trade Pokémon cards across Japanese, Korean, Chinese and English prints. Every listing is a real card in our case, photographed and priced by us.</p>
          <Link to="/about" className="btn" style={{ marginTop: 20 }}>Our story</Link>
        </div>
        <div className="right">
          <div><b>Authenticity first</b><p>PSA certificates are verified against PSA records wherever we can, and marked clearly when entered by hand.</p></div>
          <div><b>One of one</b><p>Each slab and single is tracked as an individual copy. What you see is the exact card you receive.</p></div>
          <div><b>Shipped with care</b><p>Tracked Australia Post shipping, double-boxed slabs, signature on high-value orders.</p></div>
          <div><b>Buy, sell, trade</b><p>Find us at Sydney card shows. Store credit carries across online and in person.</p></div>
        </div>
      </section>
    </div>
  );
}
