import { useState } from 'react';
import { useDB, productById, updateProduct, updateUnits, duplicateUnit, locationPath, getState } from '../data/db.js';
import { Modal, useToast, useConfirm, QR, Barcode, Field } from '../components/ui.jsx';
import { ProductFields, UnitFields, ImageManager, MarketBadge } from './common.jsx';
import { aud, fmtDate, num, TYPE_LABEL, timeAgo, money } from '../lib/util.js';

export function storefrontUrl(unitId) {
  const base = getState().settings.business.storefrontUrl || (location.origin + (import.meta.env.MODE === 'single' ? location.pathname + '#' : ''));
  return `${base.replace(/\/$/, '')}/item/${unitId}`;
}

export default function UnitEditor({ unitId, onClose }) {
  const s = useDB();
  const toast = useToast();
  const confirm = useConfirm();
  const unit = s.units.find((u) => u.id === unitId);
  const product = unit && productById(s, unit.productId);
  const [p, setP] = useState(product);
  const [u, setU] = useState(unit);
  const [tab, setTab] = useState('item');
  if (!unit || !product) return null;
  const siblings = s.units.filter((x) => x.productId === product.id && x.id !== unit.id && x.status !== 'archived');
  const history = s.priceHistory.filter((h) => h.unitId === unit.id).slice(0, 10);
  const audit = s.audit.filter((a) => a.entityId?.includes(unit.sku)).slice(0, 10);
  const save = () => {
    if (product.type === 'slab' && u.cert && s.units.some((x) => x.id !== u.id && x.cert === u.cert && x.status !== 'archived')) return toast('That cert number is already on another slab', 'err');
    updateProduct(product.id, { ...p, images: p.images });
    updateUnits([unit.id], { ...u, cost: num(u.cost), ask: num(u.ask), qty: product.type === 'slab' ? Math.min(1, num(u.qty) || 1) : num(u.qty) });
    toast('Saved. Storefront updated.');
    onClose();
  };
  return (
    <Modal title={<span>{product.name} <span className="badge grey">{unit.sku}</span></span>} onClose={onClose} width={820}>
      <div className="row wrap" style={{ marginBottom: 14 }}>
        {['item', 'images', 'history'].map((t) => <button key={t} className={'chip' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>{{ item: 'Details', images: `Images (${p.images?.length || 0})`, history: 'History' }[t]}</button>)}
        <span className="grow" />
        <span className={'badge ' + (unit.status === 'available' ? 'green' : unit.status === 'sold' ? 'red' : 'grey')}>{unit.status}</span>
        {unit.published ? <span className="badge">Published</span> : <span className="badge grey">Hidden</span>}
      </div>
      {tab === 'item' && (
        <div className="grid-2 collapse" style={{ gap: 22, alignItems: 'start' }}>
          <div className="stack"><div className="upper muted">{TYPE_LABEL[product.type]} · catalogue record</div><ProductFields p={p} set={setP} />
            {siblings.length > 0 && <p className="tiny muted">Catalogue edits apply to {siblings.length} other cop{siblings.length === 1 ? 'y' : 'ies'} of this product.</p>}
          </div>
          <div className="stack"><div className="upper muted">This physical copy</div><UnitFields type={product.type} u={u} set={setU} />
            <div className="row" style={{ gap: 14 }}><QR value={storefrontUrl(unit.id)} size={72} /><div className="small"><div className="muted">Storefront QR · SKU barcode</div><Barcode value={unit.sku} height={26} /><div className="tiny muted">{locationPath(s, unit.locationId)}</div></div></div>
          </div>
        </div>
      )}
      {tab === 'images' && <ImageManager images={p.images || []} onChange={(images) => setP({ ...p, images })} label="Product images (shared by all copies)" />}
      {tab === 'history' && (
        <div className="stack">
          <div><b className="small">Market price references</b>
            {history.length ? <table className="t" style={{ marginTop: 6 }}><tbody>{history.map((h) => <tr key={h.id}><td className="small">{fmtDate(h.at, true)}</td><td className="small">{h.source}</td><td className="num">{money(h.value, h.currency)}</td><td className="num">{h.aud != null ? aud(h.aud) : '-'}</td></tr>)}</tbody></table> : <p className="small muted">No market lookups recorded. Current: <MarketBadge market={unit.market} /></p>}
          </div>
          <div><b className="small">Audit trail</b>
            {audit.length ? <table className="t" style={{ marginTop: 6 }}><tbody>{audit.map((a) => <tr key={a.id}><td className="small">{timeAgo(a.at)}</td><td className="small">{a.action}</td><td className="small muted">{a.detail}</td></tr>)}</tbody></table> : <p className="small muted">No changes recorded yet.</p>}
          </div>
          <div className="small muted">Created {fmtDate(unit.createdAt, true)} · Acquired {fmtDate(unit.acquiredAt)}{unit.soldAt ? ` · Sold ${fmtDate(unit.soldAt)}` : ''}</div>
        </div>
      )}
      <div className="row wrap" style={{ marginTop: 20, justifyContent: 'space-between' }}>
        <div className="row wrap">
          <button className="btn secondary sm" onClick={() => { const c = duplicateUnit(unit.id); toast(`Duplicated as ${c.sku}`); onClose(); }}>Duplicate</button>
          {unit.status !== 'archived' ? <button className="btn secondary sm" onClick={async () => { if (await confirm({ title: 'Archive this item?', body: 'It will be removed from the storefront and stock counts. History is kept.', ok: 'Archive', danger: true })) { updateUnits([unit.id], { status: 'archived', published: false }, 'unit.archive'); toast('Archived'); onClose(); } }}>Archive</button>
            : <button className="btn secondary sm" onClick={() => { updateUnits([unit.id], { status: unit.qty > 0 ? 'available' : 'sold' }, 'unit.restore'); toast('Restored'); onClose(); }}>Restore</button>}
        </div>
        <div className="row"><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save changes</button></div>
      </div>
    </Modal>
  );
}
