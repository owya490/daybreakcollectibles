import { Fragment, useMemo, useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDB, listings, unitById, productById, availableQty } from '../data/db.js';
import { ProductImage, Empty } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import ProductTile from './ProductTile.jsx';
import { useShop } from './shop.jsx';
import { aud, cls, TYPE_LABEL, TYPE_PATH, fmtDate } from '../lib/util.js';

export default function ProductPage() {
  const { unitId } = useParams();
  const s = useDB();
  const shop = useShop();
  const unit = unitById(s, unitId);
  const product = unit && productById(s, unit.productId);
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(1);
  useEffect(() => { setImg(0); setQty(1); }, [unitId]);
  const all = useMemo(() => listings(s), [s]);

  if (!unit || !product || !unit.published || unit.status === 'archived') {
    return <div className="wrap"><Empty title="This listing isn't available" action={<Link className="btn" to="/shop">Browse the case</Link>}>It may have sold, or been taken down while we update it.</Empty></div>;
  }
  const l = { ...product, ...unit, unitId: unit.id };
  const avail = availableQty(unit, shop.holder);
  const sold = unit.status === 'sold' || unit.qty <= 0;
  const heldElsewhere = !sold && avail <= 0;
  const inCart = shop.inCart(unit.id);
  const otherCopies = all.filter((x) => x.productId === product.id && x.unitId !== unit.id);
  const related = all.filter((x) => x.unitId !== unit.id && x.productId !== product.id && x.available > 0 && (x.pokemon && x.pokemon === product.pokemon || x.set === product.set || x.type === product.type)).slice(0, 8);
  const guards = (product.compatibleGuardIds || []).flatMap((gid) => all.filter((x) => x.productId === gid && x.available > 0));
  const imgs = product.images?.length ? product.images : [null];
  const ship = s.settings.shipping.filter((x) => x.active);

  const spec = {
    slab: [['Pokémon', product.pokemon], ['Set', product.set], ['Card number', product.number], ['Language', product.language], ['PSA grade', unit.grade], ['Certification', unit.cert], ['Rarity', product.rarity], ['Variant', product.variant], ['Era', product.era]],
    single: [['Pokémon', product.pokemon], ['Set', product.set], ['Card number', product.number], ['Language', product.language], ['Rarity', product.rarity], ['Variant', product.variant], ['Condition', unit.condition], ['Quantity available', avail]],
    sealed: [['Product type', product.productType], ['Set', product.set], ['Language', product.language], ['Release year', product.releaseYear], ['Condition', unit.condition], ['Quantity available', avail]],
    guard: [['Design', product.design], ['Artwork', product.artwork], ['Colour', product.colour], ['Style', product.style], ['Compatibility', product.compatibility || 'Standard PSA holder'], ['Stock', avail > 0 ? `${avail} available` : 'Sold out']],
  }[product.type].filter(([, v]) => v !== '' && v !== null && v !== undefined);

  return (
    <div className="wrap" style={{ paddingBottom: 120 }}>
      <div className="crumbs" style={{ paddingTop: 22 }}>
        <Link to="/">Home</Link><span>/</span><Link to={`/${TYPE_PATH[product.type]}`}>{TYPE_LABEL[product.type]}</Link><span>/</span><span>{product.name}</span>
      </div>
      <div className="pdp">
        <div className="pdp-gallery">
          {imgs.length > 1 ? (
            <div className="pdp-thumbs">{imgs.map((im, i) => <button key={i} className={cls(i === img && 'on')} onClick={() => setImg(i)} aria-label={`Image ${i + 1}`}><ProductImage product={product} index={i} /></button>)}</div>
          ) : <div />}
          <div className="pdp-stage">
            <ProductImage product={product} index={img} />
            {product.images?.[img]?.source && <p className="tiny muted center" style={{ marginTop: 14 }}>Image: {product.images[img].source}{product.images[img].label ? ` · ${product.images[img].label}` : ''}</p>}
          </div>
        </div>

        <div className="pdp-info">
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="badge">{TYPE_LABEL[product.type]}</span>
            {product.language && <span className="badge cream">{product.language}</span>}
            {unit.grade && <span className="badge solid">PSA {unit.grade}</span>}
            {product.demo && <span className="badge grey">Sample listing</span>}
            {unit.certVerified ? <span className="badge green"><Icon name="shield" size={13} /> PSA verified</span> : unit.cert && <span className="badge amber">Cert entered manually</span>}
          </div>
          <h1 style={{ marginTop: 12 }}>{product.name}</h1>
          <p className="muted" style={{ marginTop: 4 }}>{[product.set, product.number].filter(Boolean).join(' · ')}</p>
          <div className="pdp-price">{aud(unit.ask)}</div>
          <div className="row wrap" style={{ gap: 8 }}>
            {sold ? <span className="badge red">Sold</span> : heldElsewhere ? <span className="badge amber">In another customer's checkout</span> : avail === 1 ? <span className="badge red">Last one</span> : <span className="badge green">{avail} in stock</span>}
            {unit.negotiable && !sold && <span className="badge">Negotiable at shows</span>}
          </div>

          {!sold && (
            <div className="row" style={{ marginTop: 20, gap: 10 }}>
              {avail > 1 && (
                <div className="qty"><button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease">−</button><span>{qty}</span><button onClick={() => setQty((q) => Math.min(avail, q + 1))} aria-label="Increase">+</button></div>
              )}
              <button className="btn lg grow" disabled={heldElsewhere || (inCart && unit.qty === 1)} onClick={() => shop.add(unit.id, qty)}>
                <Icon name="bag" size={18} /> {inCart && unit.qty === 1 ? 'In your bag' : heldElsewhere ? 'Currently held' : 'Add to bag'}
              </button>
              <button className={cls('btn secondary lg square')} onClick={() => shop.toggleWish(unit.id)} aria-label="Wishlist" style={{ width: 52 }}>
                <Icon name="heart" style={shop.wish.includes(unit.id) ? { fill: 'var(--red)', color: 'var(--red)' } : undefined} />
              </button>
            </div>
          )}
          {sold && <Link to={`/${TYPE_PATH[product.type]}${product.pokemon ? `?pokemon=${encodeURIComponent(product.pokemon)}` : ''}`} className="btn secondary lg block" style={{ marginTop: 20 }}>See similar in stock</Link>}

          <dl className="spec">{spec.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{k === 'Certification' ? <>{v} {unit.certVerified && <a className="small" style={{ color: 'var(--indigo)', marginLeft: 6 }} href={`https://www.psacard.com/cert/${String(v).replace(/\D/g, '')}`} target="_blank" rel="noreferrer">Verify on PSA</a>}</> : v}</dd></Fragment>)}</dl>

          {product.description && <p style={{ marginTop: 18, color: 'var(--ink-2)' }}>{product.description}</p>}
          {unit.notes && unit.publicNotes && <p style={{ marginTop: 8 }} className="small muted">{unit.notes}</p>}

          {otherCopies.length > 0 && (
            <div className="copies">
              <div className="upper" style={{ padding: '10px 14px', background: 'var(--cream-50)' }}>Other copies of this card</div>
              <Link to={`/item/${unit.id}`} className="on"><span>{unit.grade ? `PSA ${unit.grade}` : unit.condition}</span><span>{aud(unit.ask)}</span></Link>
              {otherCopies.map((c) => <Link key={c.unitId} to={`/item/${c.unitId}`}><span>{c.grade ? `PSA ${c.grade}` : c.condition}{c.available <= 0 ? ' · sold' : ''}</span><span>{aud(c.ask)}</span></Link>)}
            </div>
          )}

          {guards.length > 0 && (
            <div className="notice" style={{ marginTop: 18 }}>
              <b>Pairs well with</b>
              <div className="row" style={{ marginTop: 8 }}>
                {guards.slice(0, 2).map((g) => <Link key={g.unitId} to={`/item/${g.unitId}`} className="row grow" style={{ gap: 8 }}><div style={{ width: 40 }}><ProductImage product={g} /></div><div className="small"><b>{g.name.replace('Daybreak Guard: ', '')}</b><div>{aud(g.ask)}</div></div></Link>)}
              </div>
            </div>
          )}

          <details style={{ marginTop: 18 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Shipping & returns</summary>
            <ul className="small muted" style={{ paddingLeft: 18, marginTop: 8 }}>
              {ship.map((x) => <li key={x.id}>{x.name}: {x.price ? aud(x.price) : 'Free'}{x.freeOver ? `, free over ${aud(x.freeOver, { round: true })}` : ''}</li>)}
              <li>Slabs ship double-boxed with tracking. See <Link to="/shipping-returns" style={{ textDecoration: 'underline' }}>shipping & returns</Link>.</li>
            </ul>
          </details>
          <p className="tiny muted" style={{ marginTop: 14 }}>SKU {unit.sku} · Listed {fmtDate(unit.createdAt)}</p>
        </div>
      </div>
      {related.length > 0 && (
        <section className="section">
          <div className="section-head"><div><h2>You may also like</h2></div></div>
          <div className="rail">{related.map((x) => <ProductTile key={x.unitId} l={x} />)}</div>
        </section>
      )}
    </div>
  );
}
