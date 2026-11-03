import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDB, updateUnits, updateProduct } from '../data/db.js';
import { ProductImage, Modal, useToast, Field, Empty } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import UnitEditor from './UnitEditor.jsx';
import { aud, num } from '../lib/util.js';

export default function Guards() {
  const s = useDB();
  const toast = useToast();
  const [edit, setEdit] = useState(null);
  const [linking, setLinking] = useState(null);
  const [stock, setStock] = useState({});
  const guards = useMemo(() => s.products.filter((p) => p.type === 'guard' && !p.archived).map((p) => ({ p, units: s.units.filter((u) => u.productId === p.id && u.status !== 'archived') })), [s]);
  const totals = guards.reduce((a, g) => { g.units.forEach((u) => { a.qty += u.qty; a.value += u.qty * u.ask; a.cost += u.qty * u.cost; }); return a; }, { qty: 0, value: 0, cost: 0 });
  return (
    <>
      <div className="page-head"><div><h1>Extended Art Guards</h1><p>{guards.length} designs · {totals.qty} in stock · {aud(totals.value)} at asking · {aud(totals.cost)} manufacturing cost</p></div>
        <div className="row">{Object.keys(stock).length > 0 && <button className="btn" onClick={() => { Object.entries(stock).forEach(([id, q]) => updateUnits([id], { qty: num(q), status: num(q) > 0 ? 'available' : 'sold' }, 'guards.stock')); setStock({}); toast('Stock levels saved'); }}>Save stock levels</button>}<Link to="/admin/inventory/new?type=guard" className="btn secondary"><Icon name="plus" size={16} />New design</Link></div></div>
      {guards.length === 0 ? <Empty title="No guard designs yet" action={<Link to="/admin/inventory/new?type=guard" className="btn">Add a design</Link>} /> : (
        <div className="pos-results" style={{ maxHeight: 'none', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
          {guards.map(({ p, units }) => (
            <div key={p.id} className="pos-item" style={{ cursor: 'default' }}>
              <ProductImage product={p} />
              <div className="cell-title">{p.name.replace('Daybreak Guard: ', '')}</div>
              <div className="cell-sub">{[p.design, p.artwork, p.colour, p.style].filter(Boolean).join(' · ')}</div>
              {units.map((u) => (
                <div key={u.id} className="row between small">
                  <span>{u.sku} · {aud(u.ask)} <span className="muted">(cost {aud(u.cost)})</span></span>
                  <input className="input" style={{ width: 64, height: 32 }} inputMode="numeric" value={stock[u.id] ?? u.qty} onChange={(e) => setStock({ ...stock, [u.id]: e.target.value.replace(/\D/g, '') })} aria-label="Quantity" />
                </div>
              ))}
              {units.some((u) => u.qty <= 3) && <span className="badge amber">Low stock</span>}
              <div className="tiny muted">Recommended on {s.products.filter((x) => (x.compatibleGuardIds || []).includes(p.id)).length} products</div>
              <div className="row">
                {units[0] && <button className="btn secondary sm" onClick={() => setEdit(units[0].id)}>Edit</button>}
                <button className="btn secondary sm" onClick={() => setLinking(p)}>Recommend on…</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {edit && <UnitEditor unitId={edit} onClose={() => setEdit(null)} />}
      {linking && <LinkProducts guard={linking} onClose={() => setLinking(null)} />}
    </>
  );
}

function LinkProducts({ guard, onClose }) {
  const s = useDB();
  const toast = useToast();
  const [q, setQ] = useState('');
  const cands = s.products.filter((p) => (p.type === 'slab' || p.type === 'single') && (!q || [p.name, p.pokemon, p.set].join(' ').toLowerCase().includes(q.toLowerCase()))).slice(0, 60);
  const toggle = (p) => {
    const has = (p.compatibleGuardIds || []).includes(guard.id);
    updateProduct(p.id, { compatibleGuardIds: has ? p.compatibleGuardIds.filter((x) => x !== guard.id) : [...(p.compatibleGuardIds || []), guard.id] });
  };
  return (
    <Modal title={`Recommend "${guard.name}" on`} onClose={onClose} width={620}>
      <div className="stack">
        <Field label="Search slabs and cards"><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Umbreon" autoFocus /></Field>
        <div className="stack tight" style={{ maxHeight: 380, overflowY: 'auto' }}>
          {cands.map((p) => <label key={p.id} className="check" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}><input type="checkbox" checked={(p.compatibleGuardIds || []).includes(guard.id)} onChange={() => toggle(p)} />{p.name} <span className="muted small">{p.set}</span></label>)}
        </div>
        <div className="row end"><button className="btn" onClick={() => { toast('Recommendations saved'); onClose(); }}>Done</button></div>
      </div>
    </Modal>
  );
}
