import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDB, listings } from '../data/db.js';
import { ProductImage } from '../components/ui.jsx';
import { BRAND } from '../components/Logo.jsx';
import Icon from '../components/Icon.jsx';
import ProductTile from './ProductTile.jsx';
import { JP } from './StoreLayout.jsx';
import { aud, TYPE_LABEL } from '../lib/util.js';

function Head({ eyebrow, jp, title, sub, to, cta = 'View all' }) {
  return (
    <div className="section-head">
      <div>
        <div className="eyebrow">{eyebrow}{jp && <span className="jp">{jp}</span>}</div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {to && <Link to={to} className="link">{cta} <Icon name="arrow" size={14} /></Link>}
    </div>
  );
}

export default function Home() {
  const s = useDB();
  const all = useMemo(() => listings(s), [s]);
  const avail = all.filter((l) => l.available > 0);
  const newest = [...avail].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const by = (fn) => avail.filter(fn);
  const withImg = (xs) => xs.filter((l) => l.images?.length);
  const banners = s.settings.banners.filter((b) => b.active);
  const [bi, setBi] = useState(0);
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setBi((i) => (i + 1) % banners.length), 8000);
    return () => clearInterval(t);
  }, [banners.length]);
  const b = banners[bi % Math.max(1, banners.length)];
  const spotlight = [...withImg(by((l) => l.type === 'slab' && l.featured))].sort((a, c) => c.ask - a.ask)[0] || withImg(avail)[0];
  const collections = ['slab', 'single', 'sealed', 'guard'].map((t, i) => {
    const xs = by((l) => l.type === t);
    return { t, n: xs.length, img: withImg(xs.filter((x) => x.featured))[0] || withImg(xs)[0] || xs[0], idx: i + 1 };
  });
  const langs = [['Japanese', '日本語'], ['Korean', '한국어'], ['Chinese (Traditional)', '中文'], ['English', 'English']].map(([l, label]) => ({ l, label, n: by((x) => x.language === l || (l.startsWith('Chinese') && x.language?.startsWith('Chinese'))).length }));

  return (
    <>
      {b && (
        <section className="hero" aria-roledescription="carousel">
          <div className="clouds" style={{ backgroundImage: `url(${BRAND.cloudBand})` }} aria-hidden="true" />
          <div className="hero-inner">
            <span className="eyebrow">Buy<i>·</i>Sell<i>·</i>Trade</span>
            <img className="crest" src={BRAND.crest} alt="Daybreak crest: a crane beneath the rising sun" />
            <div className="house"><span>Est.</span><span className="script">the house of</span><span>2026</span></div>
            <h1 key={b.id}>{b.title}</h1>
            {b.subtitle && <p className="lede">{b.subtitle}</p>}
            <div className="ctas">
              <Link to={b.link || '/shop'} className="btn cream lg">{b.cta || 'Explore'}</Link>
              <Link to="/psa-slabs" className="btn outline-cream lg">PSA slabs</Link>
            </div>
            {banners.length > 1 && <div className="hero-dots">{banners.map((x, i) => <button key={x.id} className={i === bi ? 'on' : ''} onClick={() => setBi(i)} aria-label={`Show message ${i + 1}`} />)}</div>}
          </div>
        </section>
      )}

      <div className="wrap">
        <section className="section">
          <Head eyebrow="The collection" title="Four ways in" sub="Graded slabs, raw singles, sealed product and our own Extended Art Guards." />
          <div className="collections">
            {collections.map((c) => (
              <Link key={c.t} to={`/${{ slab: 'psa-slabs', single: 'singles', sealed: 'sealed', guard: 'extended-art-guards' }[c.t]}`} className="collection">
                <div className="num"><span className="eyebrow">{String(c.idx).padStart(2, '0')}</span><span className="jp">{JP[c.t]}</span></div>
                <div className="art">{c.img && <ProductImage product={c.img} compact />}</div>
                <h3>{c.t === 'guard' ? 'Extended Art Guards' : TYPE_LABEL[c.t] === 'Raw Single' ? 'Singles' : TYPE_LABEL[c.t] === 'Sealed' ? 'Sealed' : 'PSA Slabs'}</h3>
                <div className="foot"><span>{c.n} {c.n === 1 ? 'piece' : 'pieces'}</span><Icon name="arrow" size={16} stroke={1.3} /></div>
              </Link>
            ))}
          </div>
        </section>

        <section className="section">
          <Head eyebrow="Just arrived" jp={JP.new} title="New to the house" to="/new-arrivals" />
          <div className="pgrid">{newest.slice(0, 8).map((l) => <ProductTile key={l.unitId} l={l} />)}</div>
        </section>
      </div>

      {spotlight && (
        <section className="section">
          <div className="spotlight">
            <div className="art"><ProductImage product={spotlight} /></div>
            <div className="copy">
              <span className="eyebrow muted">From the vault</span>
              <h3>{spotlight.name}</h3>
              <dl>
                <dt>Set</dt><dd>{spotlight.set}{spotlight.number ? `, ${spotlight.number}` : ''}</dd>
                {spotlight.grade && <><dt>Grade</dt><dd>PSA {spotlight.grade}</dd></>}
                <dt>Language</dt><dd>{spotlight.language}</dd>
                <dt>Price</dt><dd>{aud(spotlight.ask)}</dd>
              </dl>
              <Link to={`/item/${spotlight.unitId}`} className="link" style={{ alignSelf: 'flex-start', marginTop: 8 }}>View the piece <Icon name="arrow" size={14} /></Link>
            </div>
          </div>
        </section>
      )}

      <div className="wrap">
        {by((l) => l.language === 'Japanese').length > 0 && (
          <section className="section">
            <Head eyebrow="Our specialty" jp="日本語" title="Japanese prints" sub="Sourced direct, chosen for centring, colour and condition." to="/shop?language=Japanese" />
            <div className="rail">{by((l) => l.language === 'Japanese').slice(0, 10).map((l) => <ProductTile key={l.unitId} l={l} />)}</div>
          </section>
        )}

        <section className="section">
          <div className="langs">
            {langs.map((x) => <Link key={x.l} to={x.l.startsWith('Chinese') ? '/singles?language=Chinese (Traditional)&language=Chinese (Simplified)' : `/shop?language=${encodeURIComponent(x.l)}`}><span className="jp">{x.label}</span><span className="eyebrow">{x.l.startsWith('Chinese') ? 'Chinese' : x.l} · {x.n}</span></Link>)}
          </div>
        </section>

        {by((l) => l.type === 'sealed').length > 0 && (
          <section className="section">
            <Head eyebrow="Sealed" jp={JP.sealed} title="Unopened, as intended" to="/sealed" />
            <div className="rail">{by((l) => l.type === 'sealed').map((l) => <ProductTile key={l.unitId} l={l} />)}</div>
          </section>
        )}

        <section className="statement">
          <img className="seal" src={BRAND.seal} alt="朝の光, light of the morning" />
          <span className="eyebrow muted">The house of Daybreak</span>
          <blockquote>A Sydney house for Japanese and Asian Pokémon cards. Every listing is a single, real card from our own case, described honestly and priced by hand.</blockquote>
          <Link to="/about" className="link">Our story <Icon name="arrow" size={14} /></Link>
          <div className="principles">
            <div><span className="eyebrow">壱 · Authenticity</span><b>Verified first</b><p>PSA certificates are checked against PSA records wherever possible, and marked plainly when entered by hand.</p></div>
            <div><span className="eyebrow">弐 · Singular</span><b>One of one</b><p>Each slab and single is tracked as its own copy. The card you see is the card you receive.</p></div>
            <div><span className="eyebrow">参 · Care</span><b>Shipped with care</b><p>Tracked Australia Post, double-boxed slabs, signature on high-value orders.</p></div>
            <div><span className="eyebrow">肆 · Exchange</span><b>Buy, sell, trade</b><p>Find us at Sydney card shows. Store credit carries between the booth and online.</p></div>
          </div>
        </section>
      </div>
    </>
  );
}
