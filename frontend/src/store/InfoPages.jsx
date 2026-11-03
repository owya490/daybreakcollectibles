import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDB } from '../data/db.js';
import { Field, useToast } from '../components/ui.jsx';
import { aud } from '../lib/util.js';

// Draft copy for Daybreak to review. Legal pages are templates, not legal advice.
export function About() {
  return (
    <div className="prose">
      <span className="upper muted">About Daybreak</span>
      <h1>An Asian TCG specialist.</h1>
      <p>Daybreak Collectibles buys, sells and trades Pokémon cards, with a focus on Japanese, Korean and Chinese prints alongside the English releases collectors love.</p>
      <p>You'll find us at card shows around Sydney, and here online. Every listing on this site is a specific card in our inventory, tracked individually from the day we acquire it to the day it finds a new home.</p>
      <h2>What we carry</h2>
      <ul><li>PSA-graded slabs, verified against PSA's certificate records where available</li><li>Raw singles across every major language</li><li>Sealed booster boxes, Elite Trainer Boxes and bundles</li><li>Daybreak Extended Art Guards, designed in-house</li></ul>
      <h2>Buy, sell, trade</h2>
      <p>Bring your collection to our booth. We make cash and trade offers on the spot, and store credit works both online and in person.</p>
      <div className="row" style={{ marginTop: 22 }}><Link to="/new-arrivals" className="btn">See new arrivals</Link><Link to="/contact" className="btn secondary">Get in touch</Link></div>
    </div>
  );
}

export function Contact() {
  const biz = useDB((s) => s.settings.business);
  const toast = useToast();
  const [f, setF] = useState({ name: '', email: '', msg: '' });
  return (
    <div className="prose">
      <h1>Contact</h1>
      <p>Questions about a card, an order, or selling your collection? Email <a href={`mailto:${biz.email}`} style={{ color: 'var(--indigo)', fontWeight: 600 }}>{biz.email}</a> or message us on <a href={biz.instagram} target="_blank" rel="noreferrer" style={{ color: 'var(--indigo)', fontWeight: 600 }}>Instagram</a>.</p>
      <form className="panel stack" style={{ marginTop: 20 }} onSubmit={(e) => {
        e.preventDefault();
        if (!f.name || !/^\S+@\S+\.\S+$/.test(f.email) || !f.msg) return toast('Fill in all fields', 'err');
        window.location.href = `mailto:${biz.email}?subject=${encodeURIComponent('Website enquiry from ' + f.name)}&body=${encodeURIComponent(f.msg + '\n\n' + f.email)}`;
      }}>
        <div className="grid-2 collapse"><Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field><Field label="Email"><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field></div>
        <Field label="Message"><textarea className="textarea" rows={5} value={f.msg} onChange={(e) => setF({ ...f, msg: e.target.value })} /></Field>
        <button className="btn">Open in email</button>
        <p className="tiny muted">This opens your email app. A direct contact form can be connected to an email service later.</p>
      </form>
    </div>
  );
}

export function ShippingReturns() {
  const ship = useDB((s) => s.settings.shipping.filter((x) => x.active));
  return (
    <div className="prose">
      <h1>Shipping & Returns</h1>
      <h2>Shipping within Australia</h2>
      <ul>{ship.map((x) => <li key={x.id}>{x.name}: {x.price ? aud(x.price) : 'Free'}{x.freeOver ? ` (free over ${aud(x.freeOver, { round: true })})` : ''}</li>)}</ul>
      <p>Orders are packed within 2 business days. Raw cards ship in a penny sleeve and top loader between rigid card. Slabs ship bubble-wrapped and double-boxed.</p>
      <h2>International</h2>
      <p>We currently ship within Australia only. Contact us if you're overseas and interested in a specific item.</p>
      <h2>Returns</h2>
      <p>Because each card is a unique item, all sales are final unless an item arrives damaged in transit or is materially different from its listing. Contact us within 7 days of delivery with photos and we'll make it right. This does not limit your rights under the Australian Consumer Law.</p>
    </div>
  );
}

export function Terms() {
  return (
    <div className="prose">
      <h1>Terms & Conditions</h1>
      <p className="notice warn">Template for review. Have these terms checked before launch.</p>
      <h2>Listings</h2><p>Photos show the actual item where marked. Condition grades for raw cards are our honest assessment. PSA grades are as assigned by PSA.</p>
      <h2>Pricing</h2><p>All prices are in Australian dollars. Market prices shown in our systems are references only; the listed price is the price.</p>
      <h2>Orders</h2><p>An order is accepted when payment is received. Items in checkout are held for a limited time. We may cancel and refund orders in the event of a listing error.</p>
      <h2>Store credit</h2><p>Store credit has no cash value, does not expire unless stated, and may be used online or at our booth.</p>
    </div>
  );
}

export function Privacy() {
  return (
    <div className="prose">
      <h1>Privacy Policy</h1>
      <p className="notice warn">Template for review against the Australian Privacy Principles before launch.</p>
      <p>We collect the details you give us (name, email, phone, delivery address) to process orders, manage store credit and, if you opt in, send updates about new stock.</p>
      <p>Payments are processed by our payment provider; we do not store card numbers. We do not sell your personal information.</p>
      <p>You can ask us to access, correct or delete your information at any time via the contact page.</p>
    </div>
  );
}

export function NotFound() {
  return <div className="prose center"><h1>Page not found</h1><p>The page you're looking for has moved or never existed.</p><Link to="/" className="btn" style={{ marginTop: 18 }}>Back home</Link></div>;
}
