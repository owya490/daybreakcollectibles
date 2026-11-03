import { Link, useParams } from 'react-router-dom';
import { useDB, ORDER_LABEL } from '../data/db.js';
import { Empty } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { aud, fmtDate, cls } from '../lib/util.js';

const FLOW = ['awaiting_payment', 'paid', 'processing', 'shipped', 'completed'];

export function OrderTimeline({ order }) {
  const idx = FLOW.indexOf(order.status);
  if (['cancelled', 'refunded'].includes(order.status)) return <span className="badge red">{ORDER_LABEL[order.status]}</span>;
  return (
    <div className="steps">
      {FLOW.filter((x) => x !== 'awaiting_payment' || order.payment?.provider !== 'demo').map((st) => {
        const i = FLOW.indexOf(st);
        return <span key={st} className={cls(i === idx && 'on', i < idx && 'done')}>{ORDER_LABEL[st]}</span>;
      })}
    </div>
  );
}

export default function OrderPage() {
  const { orderId } = useParams();
  const order = useDB((s) => s.orders.find((o) => o.id === orderId));
  const biz = useDB((s) => s.settings.business);
  if (!order) return <div className="wrap"><Empty title="Order not found" action={<Link className="btn" to="/account">Your account</Link>}>Sign in with the email you used to see your orders.</Empty></div>;
  return (
    <div className="prose" style={{ maxWidth: 820 }}>
      <span className="badge green"><Icon name="check" size={13} /> Order received</span>
      <h1 style={{ marginTop: 10 }}>Thank you, {order.customer.name.split(' ')[0]}.</h1>
      <p>Order <b>{order.number}</b> placed {fmtDate(order.createdAt, true)}. A confirmation will be sent to {order.customer.email} once email delivery is connected.</p>
      <div style={{ marginTop: 18 }}><OrderTimeline order={order} /></div>
      {order.status === 'awaiting_payment' && order.payment.provider === 'bank_transfer' && (
        <div className="notice warn" style={{ marginTop: 10 }}>
          <b>Bank transfer</b>: please pay {aud(order.total)} using reference <b>{order.number}</b>. Your items are held for 3 days. Bank details will be included in your confirmation email from {biz.email}.
        </div>
      )}
      {order.payment.provider === 'demo' && <div className="notice" style={{ marginTop: 10 }}>Preview order. Payment was simulated; no card was charged.</div>}
      {order.tracking?.number && (
        <div className="notice ok" style={{ marginTop: 10 }}>Shipped with {order.tracking.carrier}. Tracking number <b>{order.tracking.number}</b>{order.tracking.carrier?.includes('Australia Post') && <> · <a style={{ textDecoration: 'underline' }} href={`https://auspost.com.au/mypost/track/details/${encodeURIComponent(order.tracking.number)}`} target="_blank" rel="noreferrer">Track parcel</a></>}</div>
      )}
      <div className="panel" style={{ marginTop: 20 }}>
        {order.items.map((i) => <div key={i.unitId} className="sum-row"><span>{i.name} × {i.qty}</span><span>{aud(i.price * i.qty)}</span></div>)}
        <hr className="divider" />
        {order.discount > 0 && <div className="sum-row"><span>Discount {order.discountCode}</span><span>−{aud(order.discount)}</span></div>}
        <div className="sum-row"><span>Shipping ({order.shippingMethod})</span><span>{order.shipping ? aud(order.shipping) : 'Free'}</span></div>
        {order.creditApplied > 0 && <div className="sum-row"><span>Store credit</span><span>−{aud(order.creditApplied)}</span></div>}
        <div className="sum-row total"><span>Total</span><span>{aud(order.total)}</span></div>
      </div>
      <div className="row" style={{ marginTop: 20 }}><Link to="/account" className="btn secondary">View all orders</Link><Link to="/new-arrivals" className="btn">Keep browsing</Link></div>
    </div>
  );
}
