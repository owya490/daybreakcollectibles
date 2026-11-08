import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDB, reserve, release, createOrder, creditBalance, getState } from '../data/db.js';
import { ProductImage, Field, Empty, useToast } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { useShop } from './shop.jsx';
import { aud, r2, cls } from '../lib/util.js';

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

export default function Checkout() {
  const s = useDB();
  const shop = useShop();
  const toast = useToast();
  const nav = useNavigate();
  const settings = s.settings;
  const [form, setForm] = useState({ name: shop.session?.name || '', email: shop.session?.email || '', phone: '', line1: '', line2: '', suburb: '', state: 'NSW', postcode: '', notes: '' });
  const [shipId, setShipId] = useState(settings.shipping.find((x) => x.active)?.id);
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState(null);
  const [useCredit, setUseCredit] = useState(false);
  const [pay, setPay] = useState('card');
  const [hold, setHold] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [now, setNow] = useState(Date.now());

  // Reserve stock while the customer is checking out (prevents double-selling one-off cards).
  const key = shop.lines.map((l) => `${l.unitId}:${l.qty}`).join(',');
  useEffect(() => {
    if (!shop.lines.length) return;
    const r = reserve(shop.lines.map((l) => ({ unitId: l.unitId, qty: l.qty })), shop.holder);
    setHold(r);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [key]);
  useEffect(() => () => release(shop.holder), []);

  const ship = settings.shipping.find((x) => x.id === shipId);
  const subtotal = r2(shop.lines.reduce((a, l) => a + l.price * l.qty, 0));
  const discount = useMemo(() => {
    if (!applied) return 0;
    if (applied.minSpend && subtotal < applied.minSpend) return 0;
    return r2(applied.type === 'percent' ? subtotal * applied.value / 100 : Math.min(applied.value, subtotal));
  }, [applied, subtotal]);
  const shipping = ship ? (ship.freeOver && subtotal - discount >= ship.freeOver ? 0 : ship.price) : 0;
  const customer = shop.session && s.customers.find((c) => c.email?.toLowerCase() === shop.session.email.toLowerCase());
  const balance = customer ? creditBalance(s, customer.id) : 0;
  const merchAfterDiscount = r2(subtotal - discount);
  const creditApplied = useCredit ? r2(Math.min(balance, merchAfterDiscount)) : 0;
  const total = r2(merchAfterDiscount + shipping - creditApplied);
  const remaining = hold?.until ? Math.max(0, Math.floor((new Date(hold.until).getTime() - now) / 1000)) : 0;
  const stripeReady = !!(settings.integrations.stripePublishableKey && settings.integrations.checkoutApiUrl);

  if (!shop.lines.length) return <div className="wrap"><Empty title="Your bag is empty" action={<Link to="/new-arrivals" className="btn">See new arrivals</Link>}>Add something special first.</Empty></div>;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const applyCode = () => {
    const d = settings.discounts.find((x) => x.active && x.code.toUpperCase() === code.trim().toUpperCase());
    if (!d) return toast('That code is not valid', 'err');
    if (d.minSpend && subtotal < d.minSpend) return toast(`Spend ${aud(d.minSpend)} to use ${d.code}`, 'err');
    setApplied(d); toast(`${d.code} applied`);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!ship?.name.toLowerCase().includes('pickup')) {
      if (!form.line1.trim()) e.line1 = 'Required';
      if (!form.suburb.trim()) e.suburb = 'Required';
      if (!/^\d{4}$/.test(form.postcode)) e.postcode = '4-digit postcode';
    }
    setErrors(e);
    return !Object.keys(e).length;
  };

  const placeOrder = async () => {
    if (!validate()) return toast('Check the highlighted fields', 'err');
    if (shop.lines.some((l) => l.problem)) return toast('Some items are no longer available', 'err');
    if (remaining <= 0) {
      const r = reserve(shop.lines.map((l) => ({ unitId: l.unitId, qty: l.qty })), shop.holder);
      if (!r.ok) return toast(r.errors[0].message, 'err');
      setHold(r);
    }
    setBusy(true);
    try {
      const items = shop.lines.map((l) => ({ unitId: l.unitId, productId: l.product.id, name: l.product.name + (l.unit.grade ? ` PSA ${l.unit.grade}` : ''), sku: l.unit.sku, qty: l.qty, price: l.price, image: l.product.images?.[0]?.url || null }));
      const base = { items, customer: { ...form }, shippingMethod: ship?.name, shipping, discountCode: applied?.code || null, discount, creditApplied, total, holder: shop.holder };
      if (pay === 'card' && stripeReady) {
        // Production path: server creates a Stripe Checkout Session; webhook marks the order paid.
        const order = createOrder({ ...base, payment: { provider: 'stripe', status: 'pending' } });
        const res = await fetch(settings.integrations.checkoutApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.id, number: order.number, email: form.email, items, shipping, discount, creditApplied, currency: 'aud', successUrl: `${location.origin}/order/${order.id}`, cancelUrl: `${location.origin}/checkout` }) });
        if (!res.ok) throw new Error('Could not start card payment. Your items are held; try again or choose bank transfer.');
        const { url } = await res.json();
        shop.clear();
        window.location.href = url;
        return;
      }
      const payment = pay === 'bank'
        ? { provider: 'bank_transfer', status: 'pending', reference: null }
        : { provider: 'demo', status: 'paid', reference: 'DEMO-' + Date.now().toString(36).toUpperCase(), note: 'Simulated card payment (Stripe not configured)' };
      const order = createOrder({ ...base, payment });
      if (!shop.session) shop.setSession({ email: form.email, name: form.name });
      shop.clear();
      nav(`/order/${order.id}`);
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wrap">
      <div className="cat-head"><div><div className="crumbs"><Link to="/">Home</Link><span>/</span><span>Checkout</span></div><h1>Checkout</h1></div>
        {remaining > 0 && <span className="badge amber" style={{ height: 30, fontSize: 13 }}>Items held for you · {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>}
      </div>
      {hold && !hold.ok && <div className="notice danger" style={{ marginBottom: 14 }}>{hold.errors.map((e) => e.message).join('. ')}. Please update your bag.</div>}
      <div className="checkout">
        <div className="stack" style={{ gap: 16 }}>
          <div className="panel">
            <h3>Contact</h3>
            {!shop.session && <p className="small muted" style={{ marginBottom: 10 }}>Checking out as a guest. <Link to="/account" style={{ color: 'var(--indigo)', fontWeight: 600 }}>Sign in</Link> to use store credit.</p>}
            <div className="grid-2 collapse">
              <Field label="Full name" error={errors.name}><input className="input" value={form.name} onChange={set('name')} autoComplete="name" /></Field>
              <Field label="Email" error={errors.email}><input className="input" type="email" value={form.email} onChange={set('email')} autoComplete="email" /></Field>
              <Field label="Phone (optional)"><input className="input" value={form.phone} onChange={set('phone')} autoComplete="tel" /></Field>
            </div>
          </div>
          <div className="panel">
            <h3>Delivery</h3>
            <div className="stack" style={{ gap: 8, marginBottom: 14 }}>
              {settings.shipping.filter((x) => x.active).map((x) => {
                const free = x.freeOver && merchAfterDiscount >= x.freeOver;
                return (
                  <label key={x.id} className={cls('radio-card', shipId === x.id && 'on')}>
                    <input type="radio" name="ship" checked={shipId === x.id} onChange={() => setShipId(x.id)} />
                    <div className="grow"><b>{x.name}</b>{x.freeOver && <div className="tiny muted">Free over {aud(x.freeOver, { round: true })}</div>}</div>
                    <b>{x.price === 0 || free ? 'Free' : aud(x.price)}</b>
                  </label>
                );
              })}
              {!settings.international && <p className="tiny muted">Currently shipping within Australia only.</p>}
            </div>
            {!ship?.name.toLowerCase().includes('pickup') && (
              <div className="grid-2 collapse">
                <Field label="Street address" error={errors.line1} style={{ gridColumn: '1 / -1' }}><input className="input" value={form.line1} onChange={set('line1')} autoComplete="address-line1" /></Field>
                <Field label="Apartment, unit (optional)" style={{ gridColumn: '1 / -1' }}><input className="input" value={form.line2} onChange={set('line2')} autoComplete="address-line2" /></Field>
                <Field label="Suburb" error={errors.suburb}><input className="input" value={form.suburb} onChange={set('suburb')} autoComplete="address-level2" /></Field>
                <div className="grid-2">
                  <Field label="State"><select className="select" value={form.state} onChange={set('state')}>{STATES.map((x) => <option key={x}>{x}</option>)}</select></Field>
                  <Field label="Postcode" error={errors.postcode}><input className="input" inputMode="numeric" value={form.postcode} onChange={set('postcode')} autoComplete="postal-code" maxLength={4} /></Field>
                </div>
              </div>
            )}
            <Field label="Order notes (optional)" style={{ marginTop: 12 }}><textarea className="textarea" value={form.notes} onChange={set('notes')} placeholder="Anything we should know" /></Field>
          </div>
          <div className="panel">
            <h3>Payment</h3>
            <div className="stack" style={{ gap: 8 }}>
              <label className={cls('radio-card', pay === 'card' && 'on')}>
                <input type="radio" checked={pay === 'card'} onChange={() => setPay('card')} />
                <div className="grow"><b>Card, Apple Pay or Google Pay</b><div className="tiny muted">{stripeReady ? 'Secure payment via Stripe. You will be redirected.' : 'Stripe is not connected yet. This preview simulates a successful payment.'}</div></div>
                <Icon name="credit" />
              </label>
              <label className={cls('radio-card', pay === 'bank' && 'on')}>
                <input type="radio" checked={pay === 'bank'} onChange={() => setPay('bank')} />
                <div className="grow"><b>Bank transfer (PayID / BSB)</b><div className="tiny muted">Items are held for 3 days. Details are emailed with your order number.</div></div>
                <Icon name="dollar" />
              </label>
            </div>
            {!stripeReady && pay === 'card' && <div className="notice warn" style={{ marginTop: 12 }}>Demo mode: no real charge is made. Connect Stripe in Admin › API Integrations to take live payments.</div>}
          </div>
        </div>

        <aside className="panel" style={{ position: 'sticky', top: 90 }}>
          <h3>Order summary</h3>
          {shop.lines.map((l) => (
            <div className="cline" key={l.unitId} style={{ gridTemplateColumns: '46px 1fr auto' }}>
              <ProductImage product={l.product} compact />
              <div style={{ minWidth: 0 }}><div className="small" style={{ fontWeight: 600 }}>{l.product.name}{l.unit.grade ? ` · PSA ${l.unit.grade}` : ''}</div><div className="tiny muted">Qty {l.qty}</div>{l.problem && <div className="err tiny">{l.problem}</div>}</div>
              <b className="small">{aud(l.price * l.qty)}</b>
            </div>
          ))}
          <div className="row" style={{ marginTop: 14 }}>
            <input className="input" placeholder="Discount code" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Discount code" />
            <button className="btn secondary" onClick={applyCode}>Apply</button>
          </div>
          {customer && balance > 0 && (
            <label className="check" style={{ marginTop: 12 }}><input type="checkbox" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} /> Use store credit ({aud(balance)} available)</label>
          )}
          <div style={{ marginTop: 14 }}>
            <div className="sum-row"><span>Subtotal</span><span>{aud(subtotal)}</span></div>
            {discount > 0 && <div className="sum-row" style={{ color: 'var(--green)' }}><span>Discount ({applied.code})</span><span>−{aud(discount)}</span></div>}
            <div className="sum-row"><span>Shipping</span><span>{shipping ? aud(shipping) : 'Free'}</span></div>
            {creditApplied > 0 && <div className="sum-row" style={{ color: 'var(--green)' }}><span>Store credit</span><span>−{aud(creditApplied)}</span></div>}
            <div className="sum-row total"><span>Total (AUD)</span><span>{aud(total)}</span></div>
            <p className="tiny muted">Includes GST where applicable.</p>
          </div>
          <button className="btn lg block" style={{ marginTop: 14 }} disabled={busy || shop.lines.some((l) => l.problem)} onClick={placeOrder}>
            {busy ? 'Placing order…' : pay === 'bank' ? 'Place order' : stripeReady ? `Pay ${aud(total)}` : `Place order · ${aud(total)}`}
          </button>
          <p className="tiny muted center" style={{ marginTop: 10 }}>By placing an order you agree to our <Link to="/terms" style={{ textDecoration: 'underline' }}>terms</Link>.</p>
        </aside>
      </div>
    </div>
  );
}
