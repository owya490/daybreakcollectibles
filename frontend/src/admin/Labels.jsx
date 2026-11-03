import { useMemo, useState } from 'react';
import { useDB, productById, locationPath, updateUnits, updateSettings } from '../data/db.js';
import { QR, Barcode, useToast, Seg, Empty } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { chunk } from './Locations.jsx';
import { storefrontUrl } from './UnitEditor.jsx';
import { aud, COND_SHORT, LANG_SHORT } from '../lib/util.js';

const TEMPLATES = {
  'tags-2x4': { label: '8 tags per 4×6 sheet', per: 8 },
  'tags-2x3': { label: '6 tags per 4×6 sheet', per: 6 },
  'slab-strips': { label: '6 slab strips per 4×6', per: 6 },
  single: { label: '1 display sign per 4×6', per: 1 },
};

export function LabelTag({ u, template, showQR, showBar }) {
  return (
    <div className="ltag">
      {u.grade && <span className="lgrade">PSA {u.grade}</span>}
      <div style={{ minWidth: 0, flex: template === 'slab-strips' ? 1 : undefined }}>
        <div className="lname" style={u.grade && template !== 'slab-strips' ? { paddingRight: '0.45in' } : undefined}>{u.name}</div>
        <div className="lmeta">{[u.set, u.number].filter(Boolean).join(' · ')}{u.language ? ` · ${LANG_SHORT[u.language] || u.language}` : ''}{u.type === 'single' ? ` · ${COND_SHORT[u.condition] || u.condition}` : ''}</div>
      </div>
      <div className="lprice">{aud(u.ask, { round: Number.isInteger(u.ask) })}</div>
      <div className="lbottom">
        <div style={{ minWidth: 0 }}>{showBar && <Barcode value={u.sku} height={18} className="lbar" />}<div className="lsku">{u.sku}{u.cert ? ` · ${u.cert}` : ''}</div></div>
        {showQR && <QR value={storefrontUrl(u.id)} size={58} />}
      </div>
    </div>
  );
}

export default function Labels() {
  const s = useDB();
  const toast = useToast();
  const [scope, setScope] = useState('queue');
  const [template, setTemplate] = useState(s.settings.labelTemplate || 'tags-2x4');
  const [type, setType] = useState('');
  const [showQR, setShowQR] = useState(true);
  const [showBar, setShowBar] = useState(true);
  const items = useMemo(() => s.units.filter((u) => u.status === 'available' && u.qty > 0)
    .map((u) => ({ ...productById(s, u.productId), ...u, loc: locationPath(s, u.locationId) }))
    .filter((u) => (!type || u.type === type) && (scope === 'all' || !u.labelPrintedAt || new Date(u.updatedAt) > new Date(u.labelPrintedAt)))
    .sort((a, b) => a.loc.localeCompare(b.loc) || a.name.localeCompare(b.name)), [s, scope, type]);
  const sheets = chunk(items, TEMPLATES[template].per);
  const print = () => {
    window.print();
    setTimeout(() => {
      updateUnits(items.map((i) => i.id), { labelPrintedAt: new Date(Date.now() + 1000).toISOString() }, 'labels.printed');
      toast(`${items.length} labels marked as printed`);
    }, 500);
  };
  return (
    <>
      <div className="page-head no-print"><div><h1>Price labels</h1><p>4 × 6 inch sheets, sorted by location so you can walk the binders in order.</p></div>
        <button className="btn" disabled={!items.length} onClick={print}><Icon name="printer" size={16} />Print {items.length} label{items.length === 1 ? '' : 's'}</button></div>
      <div className="panel no-print stack" style={{ marginBottom: 16 }}>
        <div className="row wrap">
          <Seg value={scope} onChange={setScope} options={[{ value: 'queue', label: 'New & price changes' }, { value: 'all', label: 'All in stock' }]} />
          <select className="select" style={{ width: 'auto' }} value={template} onChange={(e) => { setTemplate(e.target.value); updateSettings({ labelTemplate: e.target.value }); }}>{Object.entries(TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          <select className="select" style={{ width: 'auto' }} value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option><option value="slab">PSA slabs</option><option value="single">Singles</option><option value="sealed">Sealed</option><option value="guard">Guards</option></select>
          <label className="check"><input type="checkbox" checked={showQR} onChange={(e) => setShowQR(e.target.checked)} />Storefront QR</label>
          <label className="check"><input type="checkbox" checked={showBar} onChange={(e) => setShowBar(e.target.checked)} />SKU barcode</label>
        </div>
        <p className="tiny muted">Thermal printers: set the printer's paper to 4×6 in (101.6×152.4 mm), scale 100%, margins none. Tested layout targets common 203/300 dpi direct-thermal printers (Zebra, Rollo, MUNBYN, Brother QL with 4×6 stock) printing from the browser's print dialog. "New & price changes" includes anything added or edited since its last label.</p>
      </div>
      {items.length === 0 ? <Empty title="All labels are up to date">Add or reprice stock and it will appear here.</Empty> : (
        <div className="print-area">
          <style>{'@media print { @page { size: 4in 6in; margin: 0; } }'}</style>
          <div className="sheets">{sheets.map((g, i) => <div key={i} className={`label-sheet ${template}`}>{g.map((u) => <LabelTag key={u.id} u={u} template={template} showQR={showQR} showBar={showBar} />)}</div>)}</div>
        </div>
      )}
    </>
  );
}
