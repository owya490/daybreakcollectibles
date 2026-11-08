import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDB, creditBalance, ORDER_LABEL, upsertCustomer } from '../data/db.js';
import { Field, Empty, useToast } from '../components/ui.jsx';
import { useShop } from './shop.jsx';
import { aud, fmtDate } from '../lib/util.js';

/**
 * Customer account. In this build, sign-in is a lightweight email session on this
 * device. Production uses Supabase Auth magic links (see docs/ARCHITECTURE.md).
 */
export default function Account() {
  const shop = useShop();
  const s = useDB();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  if (!shop.session) {
    return (
      <div className="prose" style={{ maxWidth: 460 }}>
        <h1>Your account</h1>
        <p>Sign in to see your orders, tracking and store credit.</p>
        <form className="panel stack" style={{ marginTop: 18 }} onSubmit={(e) => {
          e.preventDefault();
          if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Enter a valid email', 'err');
          const existing = s.customers.find((c) => c.email?.toLowerCase() === email.toLowerCase());
          if (!existing) upsertCustomer({ name: name || email.split('@')[0], email });
          shop.setSession({ email, name: existing?.name || name || email.split('@')[0] });
        }}>
          <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
          <Field label="Name (new customers)"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
          <button className="btn lg block">Continue</button>
          <p className="tiny muted">Preview sign-in: no password is needed on this device. Live accounts will use a secure one-time email link.</p>
        </form>
      </div>
    );
  }
  const customer = s.customers.find((c) => c.email?.toLowerCase() === shop.session.email.toLowerCase());
  const orders = s.orders.filter((o) => o.customer.email.toLowerCase() === shop.session.email.toLowerCase());
  const bal = customer ? creditBalance(s, customer.id) : 0;
  const ledger = customer ? s.ledger.filter((l) => l.customerId === customer.id) : [];
  return (
    <div className="prose" style={{ maxWidth: 900 }}>
      <div className="row between wrap"><h1 style={{ marginBottom: 0 }}>Hi, {shop.session.name}</h1><button className="btn secondary sm" onClick={() => shop.setSession(null)}>Sign out</button></div>
      <p className="muted">{shop.session.email}</p>
      <div className="grid-2 collapse" style={{ marginTop: 20 }}>
        <div className="panel"><div className="upper muted">Store credit</div><div style={{ fontSize: 32, fontWeight: 800 }}>{aud(bal)}</div><p className="small muted">Usable online at checkout and at our card show booth.</p></div>
        <div className="panel"><div className="upper muted">Orders</div><div style={{ fontSize: 32, fontWeight: 800 }}>{orders.length}</div><p className="small muted">Wishlist: <Link to="/wishlist" style={{ color: 'var(--indigo)' }}>{shop.wish.length} saved</Link></p></div>
      </div>
      <h2>Order history</h2>
      {orders.length === 0 ? <Empty title="No orders yet" action={<Link to="/new-arrivals" className="btn">Shop new arrivals</Link>} /> : (
        <div className="table-wrap"><table className="t"><thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Tracking</th><th className="num">Total</th></tr></thead>
          <tbody>{orders.map((o) => (
            <tr key={o.id}><td><Link to={`/order/${o.id}`} style={{ color: 'var(--indigo)', fontWeight: 600 }}>{o.number}</Link></td><td>{fmtDate(o.createdAt)}</td><td><span className="badge">{ORDER_LABEL[o.status]}</span></td><td>{o.tracking?.number || '-'}</td><td className="num">{aud(o.total)}</td></tr>
          ))}</tbody></table></div>
      )}
      {ledger.length > 0 && (<>
        <h2>Credit history</h2>
        <div className="table-wrap"><table className="t"><thead><tr><th>Date</th><th>Detail</th><th className="num">Amount</th></tr></thead>
          <tbody>{ledger.map((l) => <tr key={l.id}><td>{fmtDate(l.at)}</td><td>{l.reason}</td><td className="num" style={{ color: l.amount < 0 ? 'var(--red)' : 'var(--green)' }}>{l.amount > 0 ? '+' : ''}{aud(l.amount)}</td></tr>)}</tbody></table></div>
      </>)}
    </div>
  );
}
