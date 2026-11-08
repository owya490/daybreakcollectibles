import { useMemo, useState } from 'react';
import { useDB, updateOrder, ORDER_LABEL, ORDER_STATUSES } from '../data/db.js';
import { Modal, Field, useToast, useConfirm, Empty, Seg } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { aud, fmtDate, cls, toCSV, download } from '../lib/util.js';

const CARRIERS = ['Australia Post', 'Australia Post Express', 'Sendle', 'StarTrack', 'CouriersPlease', 'Aramex', 'Hand delivered / pickup'];
const BADGE = { awaiting_payment: 'amber', paid: 'solid', processing: '', shipped: 'green', completed: 'grey', cancelled: 'red', refunded: 'red' };

function Invoice({ o, biz }) {
  return (
    <div className="print-area doc print-only">
      <div className="row between"><div><h2 className="serif" style={{ color: '#00009E', fontSize: 28 }}>{biz.name}</h2><div className="small">{biz.email}{biz.abn ? ` · ABN ${biz.abn}` : ''}</div></div><div className="right"><b>Tax invoice</b><div>{o.number}</div><div className="small">{fmtDate(o.createdAt)}</div></div></div>
      <p style={{ marginTop: 16 }}><b>Bill / ship to</b><br />{o.customer.name}<br />{o.customer.line1} {o.customer.line2}<br />{o.customer.suburb} {o.customer.state} {o.customer.postcode}<br />{o.customer.email}</p>
      <table className="t" style={{ marginTop: 12 }}><thead><tr><th>Item</th><th>SKU</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Total</th></tr></thead>
        <tbody>{o.items.map((i) => <tr key={i.unitId}><td>{i.name}</td><td>{i.sku}</td><td className="num">{i.qty}</td><td className="num">{aud(i.price)}</td><td className="num">{aud(i.price * i.qty)}</td></tr>)}</tbody></table>
      <div style={{ marginLeft: 'auto', width: 260, marginTop: 10 }}>
        {o.discount > 0 && <div className="sum-row"><span>Discount</span><span>−{aud(o.discount)}</span></div>}
        <div className="sum-row"><span>Shipping</span><span>{aud(o.shipping)}</span></div>
        {o.creditApplied > 0 && <div className="sum-row"><span>Store credit</span><span>−{aud(o.creditApplied)}</span></div>}
        <div className="sum-row total"><span>Total (AUD, incl. GST where applicable)</span><span>{aud(o.total)}</span></div>
      </div>
    </div>
  );
}

function OrderDetail({ id, onClose }) {
  const s = useDB();
  const toast = useToast();
  const confirm = useConfirm();
  const o = s.orders.find((x) => x.id === id);
  const [track, setTrack] = useState({ carrier: o?.tracking?.carrier || 'Australia Post', number: o?.tracking?.number || '' });
  const [note, setNote] = useState('');
  const [printing, setPrinting] = useState(false);
  const [refund, setRefund] = useState(null);
  if (!o) return null;
  const set = (status, extra = {}, msg) => { try { updateOrder(o.id, { status, ...extra }, note || msg); setNote(''); toast(`Order ${ORDER_LABEL[status].toLowerCase()}`); } catch (e) { toast(e.message, 'err'); } };
  const mail = `mailto:${o.customer.email}?subject=${encodeURIComponent(`Your Daybreak order ${o.number}`)}&body=${encodeURIComponent(`Hi ${o.customer.name.split(' ')[0]},\n\n${o.tracking?.number ? `Your order has shipped with ${o.tracking.carrier}. Tracking: ${o.tracking.number}` : 'Thanks for your order.'}\n\nDaybreak Collectibles`)}`;
  return (
    <Modal title={<span>Order {o.number} <span className={cls('badge', BADGE[o.status])}>{ORDER_LABEL[o.status]}</span></span>} onClose={onClose} width={820}>
      <div className="grid-2 collapse" style={{ gap: 18, alignItems: 'start' }}>
        <div className="stack">
          <div className="panel" style={{ padding: 14 }}>
            <b>{o.customer.name}</b><div className="small">{o.customer.email} {o.customer.phone}</div>
            <div className="small" style={{ marginTop: 6 }}>{o.shippingMethod}</div>
            {o.customer.line1 && <div className="small muted">{o.customer.line1} {o.customer.line2}, {o.customer.suburb} {o.customer.state} {o.customer.postcode}</div>}
            {o.customer.notes && <div className="notice small" style={{ marginTop: 8 }}>{o.customer.notes}</div>}
          </div>
          <div>{o.items.map((i) => <div key={i.unitId} className="sum-row"><span>{i.name} ×{i.qty}<div className="tiny muted">{i.sku}</div></span><span>{aud(i.price * i.qty)}</span></div>)}
            {o.discount > 0 && <div className="sum-row muted"><span>Discount {o.discountCode}</span><span>−{aud(o.discount)}</span></div>}
            <div className="sum-row muted"><span>Shipping</span><span>{aud(o.shipping)}</span></div>
            {o.creditApplied > 0 && <div className="sum-row muted"><span>Store credit</span><span>−{aud(o.creditApplied)}</span></div>}
            <div className="sum-row total"><span>Total</span><span>{aud(o.total)}</span></div>
            <div className="tiny muted">Payment: {o.payment.provider}{o.payment.reference ? ` · ${o.payment.reference}` : ''}{o.payment.provider === 'demo' ? ' (simulated)' : ''}</div>
          </div>
          <div><b className="small">History</b>{o.history.map((h, i) => <div key={i} className="small" style={{ padding: '4px 0', borderBottom: '1px solid var(--line)' }}>{fmtDate(h.at, true)} · <b>{ORDER_LABEL[h.status]}</b>{h.note ? ` · ${h.note}` : ''}</div>)}</div>
        </div>
        <div className="stack">
          <Field label="Note for this update (optional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          {o.status === 'awaiting_payment' && <button className="btn" onClick={() => set('paid', {}, 'Payment confirmed manually')}>Mark payment received</button>}
          {o.status === 'paid' && <button className="btn" onClick={() => set('processing', {}, 'Packing')}>Start processing</button>}
          {['paid', 'processing'].includes(o.status) && (
            <div className="panel stack" style={{ padding: 14 }}>
              <b className="small">Ship order</b>
              <div className="grid-2"><Field label="Carrier"><select className="select" value={track.carrier} onChange={(e) => setTrack({ ...track, carrier: e.target.value })}>{CARRIERS.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Tracking number"><input className="input" value={track.number} onChange={(e) => setTrack({ ...track, number: e.target.value })} /></Field></div>
              <button className="btn" onClick={() => set('shipped', { tracking: track }, `Shipped ${track.carrier} ${track.number}`)}><Icon name="truck" size={16} />Mark shipped</button>
            </div>
          )}
          {o.status === 'shipped' && <button className="btn" onClick={() => set('completed', {}, 'Delivered')}>Mark completed</button>}
          <div className="row wrap">
            <button className="btn secondary" onClick={() => { setPrinting(true); setTimeout(() => { window.print(); setPrinting(false); }, 150); }}><Icon name="printer" size={16} />Invoice</button>
            <a className="btn secondary" href={mail}>Email customer</a>
            {['awaiting_payment', 'paid', 'processing'].includes(o.status) && o.status === 'awaiting_payment' && <button className="btn secondary" onClick={async () => { if (await confirm({ title: 'Cancel order?', body: 'Held stock is released back to the storefront.', ok: 'Cancel order', danger: true })) set('cancelled', {}, 'Cancelled'); }}>Cancel</button>}
            {['paid', 'processing', 'shipped', 'completed'].includes(o.status) && <button className="btn secondary" onClick={() => setRefund({ restock: true })}>Refund</button>}
          </div>
          <p className="tiny muted">Card refunds go through the payment provider. This records the refund, reverses revenue and (optionally) returns stock.</p>
        </div>
      </div>
      {printing && <Invoice o={o} biz={s.settings.business} />}
      {refund && (
        <Modal title={`Refund ${o.number}`} onClose={() => setRefund(null)} width={440}>
          <div className="stack">
            <p className="small">Records a refund of <b>{aud(o.total)}</b> and reverses the revenue. {o.payment.provider === 'stripe' ? 'Issue the card refund in Stripe (or via the refund endpoint).' : 'Return the funds to the customer manually.'} Store credit used on the order is returned to their balance.</p>
            <label className="check"><input type="checkbox" checked={refund.restock} onChange={(e) => setRefund({ restock: e.target.checked })} /> Return the items to stock</label>
            <div className="row end"><button className="btn secondary" onClick={() => setRefund(null)}>Back</button><button className="btn danger" onClick={() => { set('refunded', { restock: refund.restock }, refund.restock ? 'Refunded and restocked' : 'Refunded (not restocked)'); setRefund(null); }}>Record refund</button></div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}

export default function Orders({ fulfilment }) {
  const s = useDB();
  const [status, setStatus] = useState(fulfilment ? 'to-ship' : 'all');
  const [open, setOpen] = useState(null);
  const counts = useMemo(() => Object.fromEntries(ORDER_STATUSES.map((st) => [st, s.orders.filter((o) => o.status === st).length])), [s]);
  const rows = s.orders.filter((o) => status === 'all' || (status === 'to-ship' ? ['paid', 'processing'].includes(o.status) : o.status === status));
  return (
    <>
      <div className="page-head"><div><h1>{fulfilment ? 'Shipping & fulfilment' : 'Online orders'}</h1><p>{fulfilment ? 'Paid orders ready to pack and ship.' : `${s.orders.length} orders`}</p></div>
        <button className="btn secondary" onClick={() => download('daybreak-orders.csv', toCSV(s.orders.map((o) => ({ number: o.number, date: o.createdAt, status: o.status, customer: o.customer.name, email: o.customer.email, items: o.items.map((i) => i.name).join('; '), total: o.total, shipping: o.shipping, tracking: o.tracking?.number || '' }))), 'text/csv')}><Icon name="download" size={16} />CSV</button></div>
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <button className={cls('chip', status === 'to-ship' && 'on')} onClick={() => setStatus('to-ship')}>To ship <span className="n">{counts.paid + counts.processing}</span></button>
        <button className={cls('chip', status === 'all' && 'on')} onClick={() => setStatus('all')}>All <span className="n">{s.orders.length}</span></button>
        {ORDER_STATUSES.map((st) => <button key={st} className={cls('chip', status === st && 'on')} onClick={() => setStatus(st)}>{ORDER_LABEL[st]} <span className="n">{counts[st]}</span></button>)}
      </div>
      {rows.length === 0 ? <Empty title="No orders here">Online orders appear the moment a customer checks out.</Empty> : (
        <div className="table-wrap"><table className="t"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Delivery</th><th>Status</th><th className="num">Total</th></tr></thead>
          <tbody>{rows.map((o) => <tr key={o.id} className="click" onClick={() => setOpen(o.id)}><td className="cell-title">{o.number}</td><td className="small">{fmtDate(o.createdAt, true)}</td><td className="small">{o.customer.name}</td><td className="small">{o.items.map((i) => i.name).join(', ')}</td><td className="small">{o.shippingMethod}{o.tracking?.number ? ` · ${o.tracking.number}` : ''}</td><td><span className={cls('badge', BADGE[o.status])}>{ORDER_LABEL[o.status]}</span></td><td className="num"><b>{aud(o.total)}</b></td></tr>)}</tbody></table></div>
      )}
      {open && <OrderDetail id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
