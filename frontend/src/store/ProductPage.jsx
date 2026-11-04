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

  const status = sold ? ['red', 'Sold'] : heldElsewhere ? ['amber', "In another client's checkout"] : avail === 1 ? ['', 'One available'] : ['', `${avail} available`];
  return (
    <div className="wrap">
      <div className="crumbs" style={{ paddingTop: 30, justifyContent: 'flex-start' }}>
        <Link to="/">Home</Link><span>/</span><Link to={`/${TYPE_PATH[product.type]}`}>{TYPE_LABEL[product.type]}</Link><span>/</span><span>{product.name}</span>
      </div>
      <div className="pdp">
        <div className="pdp-gallery">
          {imgs.length > 1 ? (
            <div className="pdp-thumbs">{imgs.map((im, i) => <button key={i} className={cls(i === img && 'on')} onClick={() => setImg(i)} aria-label={`Image ${i + 1}`}><ProductImage product={product} index={i} compact /></button>)}</div>
          ) : <div />}
          <div className="pdp-stage">
            <ProductImage product={product} index={img} />
            {product.images?.[img]?.source && <p className="tiny muted center" style={{ marginTop: 22, letterSpacing: '0.04em' }}>{product.images[img].label ? `${product.images[img].label} · ` : ''}Image: {product.images[img].source}</p>}
          </div>
        </div>

        <div className="pdp-info">
          <div className="kicker eyebrow">
            <span>{TYPE_LABEL[product.type]}</span>
            {product.language && <span>{product.language}</span>}
            {product.demo && <span className="badge grey">Sample</span>}
          </div>
          <h1 style={{ marginTop: 14 }}>{product.name}</h1>
          <p className="sub">{[product.set, product.number].filter(Boolean).join(', ')}{unit.grade ? ` · PSA ${unit.grade}` : ''}</p>
          <div className="pdp-price">{aud(unit.ask)}</div>
          <div className="pdp-status">
            <span><span className={cls('dot', status[0])} />{status[1]}</span>
            {unit.negotiable && !sold && <span>Negotiable at shows</span>}
            {unit.certVerified ? <span style={{ color: 'var(--green)' }}>PSA verified</span> : unit.cert ? <span>Cert entered by hand</span> : null}
          </div>

          {!sold && (
            <div className="row" style={{ marginTop: 28, gap: 10 }}>
              {avail > 1 && (
                <div className="qty"><button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease">−</button><span>{qty}</span><button onClick={() => setQty((q) => Math.min(avail, q + 1))} aria-label="Increase">+</button></div>
              )}
              <button className="btn lg grow" disabled={heldElsewhere || (inCart && unit.qty === 1)} onClick={() => shop.add(unit.id, qty)}>
                {inCart && unit.qty === 1 ? 'In your bag' : heldElsewhere ? 'Currently held' : 'Add to bag'}
              </button>
              <button className="btn secondary lg square" onClick={() => shop.toggleWish(unit.id)} aria-label="Wishlist" style={{ width: 52 }}>
                <Icon name="heart" stroke={1.4} style={shop.wish.includes(unit.id) ? { fill: 'var(--red)', color: 'var(--red)' } : undefined} />
              </button>
            </div>
          )}
          {sold && <Link to={`/${TYPE_PATH[product.type]}${product.pokemon ? `?pokemon=${encodeURIComponent(product.pokemon)}` : ''}`} className="btn secondary lg block" style={{ marginTop: 28 }}>See similar pieces</Link>}

          <dl className="spec">{spec.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{k === 'Certification' ? <>{v} {unit.certVerified && <a className="small" style={{ color: 'var(--navy)', marginLeft: 8, borderBottom: '1px solid var(--line-2)' }} href={`https://www.psacard.com/cert/${String(v).replace(/\D/g, '')}`} target="_blank" rel="noreferrer">Verify on PSA</a>}</> : v}</dd></Fragment>)}</dl>

          {product.description && <details className="acc" open><summary>Description</summary><div>{product.description}</div></details>}

          {otherCopies.length > 0 && (
            <details className="acc" open><summary>Other copies of this card</summary>
              <div className="copies" style={{ marginTop: 0 }}>
                <Link to={`/item/${unit.id}`} className="on"><span>{unit.grade ? `PSA ${unit.grade}` : unit.condition} · viewing</span><span>{aud(unit.ask)}</span></Link>
                {otherCopies.map((c) => <Link key={c.unitId} to={`/item/${c.unitId}`}><span>{c.grade ? `PSA ${c.grade}` : c.condition}{c.available <= 0 ? ' · sold' : ''}</span><span>{aud(c.ask)}</span></Link>)}
              </div>
            </details>
          )}

          {guards.length > 0 && (
            <details className="acc" open><summary>Pairs with</summary>
              <div className="row" style={{ gap: 16 }}>
                {guards.slice(0, 2).map((g) => <Link key={g.unitId} to={`/item/${g.unitId}`} className="row grow" style={{ gap: 12 }}><div style={{ width: 48 }}><ProductImage product={g} compact /></div><div className="small"><div className="serif" style={{ fontSize: 15 }}>{g.name.replace('Daybreak Guard: ', '')}</div><div>{aud(g.ask)}</div></div></Link>)}
              </div>
            </details>
          )}

          <details className="acc"><summary>Shipping & returns</summary>
            <div><ul style={{ paddingLeft: 18, margin: 0 }}>
              {ship.map((x) => <li key={x.id}>{x.name}: {x.price ? aud(x.price) : 'Free'}{x.freeOver ? `, free over ${aud(x.freeOver, { round: true })}` : ''}</li>)}
              <li>Slabs ship double-boxed with tracking. See <Link to="/shipping-returns" style={{ borderBottom: '1px solid var(--line-2)' }}>shipping & returns</Link>.</li>
            </ul></div>
          </details>
          <p className="eyebrow muted" style={{ marginTop: 20 }}>SKU {unit.sku} · Listed {fmtDate(unit.createdAt)}</p>
        </div>
      </div>
      {related.length > 0 && (
        <section className="section">
          <div className="section-head"><div><div className="eyebrow">You may also consider</div><h2>From the same shelf</h2></div></div>
          <div className="rail">{related.map((x) => <ProductTile key={x.unitId} l={x} />)}</div>
        </section>
      )}
    </div>
  );
}
