import { useMemo, useState } from 'react';
import { useDB, addLocation, renameLocation, deleteLocation, productById, locationPath, updateUnits } from '../data/db.js';
import { useToast, QR, ProductImage, Empty } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { LocationSelect } from './common.jsx';
import { descendants, exportInventoryCSV } from './Inventory.jsx';
import { aud, cls, TYPE_LABEL } from '../lib/util.js';

export default function Locations() {
  const s = useDB();
  const toast = useToast();
  const [sel, setSel] = useState('loc-main');
  const [name, setName] = useState('');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState([]);
  const [dest, setDest] = useState(null);
  const [printLabels, setPrintLabels] = useState(false);
  const stockIn = (id) => { const ids = new Set([id, ...descendants(s, id)]); return s.units.filter((u) => ids.has(u.locationId) && u.status === 'available' && u.qty > 0); };
  const tree = useMemo(() => {
    const out = [];
    const walk = (pid, depth) => s.locations.filter((l) => l.parentId === pid).sort((a, b) => a.name.localeCompare(b.name)).forEach((l) => { out.push({ ...l, depth }); walk(l.id, depth + 1); });
    walk(null, 0);
    return out;
  }, [s]);
  const units = (sel === '__none' ? s.units.filter((u) => !u.locationId && u.status === 'available' && u.qty > 0) : stockIn(sel)).map((u) => ({ ...productById(s, u.productId), ...u })).filter((r) => !q || [r.name, r.sku, r.cert].join(' ').toLowerCase().includes(q.toLowerCase()));
  const value = units.reduce((a, u) => ({ ask: a.ask + u.ask * u.qty, cost: a.cost + u.cost * u.qty, qty: a.qty + u.qty }), { ask: 0, cost: 0, qty: 0 });
  const cur = s.locations.find((l) => l.id === sel);
  return (
    <>
      <div className="page-head"><div><h1>Inventory locations</h1><p>Binders, boxes, display cases and showcase rows. Moving stock keeps its history.</p></div>
        <button className="btn secondary" onClick={() => { setPrintLabels(true); setTimeout(() => { window.print(); setPrintLabels(false); }, 200); }}><Icon name="printer" size={16} />Print location labels</button></div>
      <div className="dash-grid" style={{ marginTop: 0 }}>
        <div className="panel span-4 stack">
          <h3>Locations</h3>
          <div className="tree">
            {tree.map((l) => <div key={l.id} className={cls('node', sel === l.id && 'on')} style={{ paddingLeft: 10 + l.depth * 16 }} onClick={() => { setSel(l.id); setPicked([]); }}><Icon name={l.depth === 0 ? 'home' : 'box'} size={15} />{l.name}<span className="n">{stockIn(l.id).reduce((a, u) => a + u.qty, 0)}</span></div>)}
            <div className={cls('node', sel === '__none' && 'on')} onClick={() => setSel('__none')}><Icon name="alert" size={15} />Unassigned<span className="n">{s.units.filter((u) => !u.locationId && u.status === 'available' && u.qty > 0).length}</span></div>
          </div>
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; addLocation(name.trim(), sel === '__none' ? null : sel); setName(''); toast('Location added'); }}>
            <input className="input" placeholder={`New location inside ${cur?.name || 'root'}`} value={name} onChange={(e) => setName(e.target.value)} /><button className="btn">Add</button>
          </form>
          {cur && <RenameRow key={cur.id} loc={cur} onDelete={() => { try { deleteLocation(cur.id); setSel('loc-main'); toast('Location removed'); } catch (e) { toast(e.message, 'err'); } }} onRename={(v) => { renameLocation(cur.id, v); toast('Renamed'); }} />}
        </div>
        <div className="panel span-8 stack">
          <h3>{sel === '__none' ? 'Unassigned stock' : locationPath(s, sel)} <span className="small muted" style={{ fontWeight: 400 }}>{value.qty} units · {aud(value.ask, { round: true })} asking · {aud(value.cost, { round: true })} cost</span></h3>
          <div className="row wrap">
            <input className="input" style={{ maxWidth: 260 }} placeholder="Search this location" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn secondary sm" onClick={() => exportInventoryCSV(units, s)}><Icon name="download" size={14} />Report CSV</button>
          </div>
          {picked.length > 0 && <div className="bulkbar" style={{ position: 'static' }}><b>{picked.length} selected</b><div style={{ width: 220 }}><LocationSelect value={dest} onChange={setDest} /></div><button className="btn secondary sm" onClick={() => { updateUnits(picked, { locationId: dest }, 'location.transfer'); toast(`Moved ${picked.length} items`); setPicked([]); }}>Transfer</button></div>}
          {units.length === 0 ? <Empty title="Empty">No stock here.</Empty> : (
            <div className="table-wrap"><table className="t"><thead><tr><th style={{ width: 30 }}><input type="checkbox" checked={picked.length === units.length} onChange={() => setPicked(picked.length === units.length ? [] : units.map((u) => u.id))} aria-label="Select all" /></th><th></th><th>Item</th><th>Location</th><th className="num">Qty</th><th className="num">Asking</th></tr></thead>
              <tbody>{units.map((u) => <tr key={u.id}><td><input type="checkbox" checked={picked.includes(u.id)} onChange={() => setPicked((p) => (p.includes(u.id) ? p.filter((x) => x !== u.id) : [...p, u.id]))} aria-label={`Select ${u.sku}`} /></td><td><div className="thumb-sm"><ProductImage product={u} compact /></div></td><td><div className="cell-title">{u.name}{u.grade ? ` · PSA ${u.grade}` : ''}</div><div className="cell-sub">{u.sku} · {TYPE_LABEL[u.type]}</div></td><td className="small">{locationPath(s, u.locationId)}</td><td className="num">{u.qty}</td><td className="num">{aud(u.ask)}</td></tr>)}</tbody></table></div>
          )}
        </div>
      </div>
      {printLabels && (
        <div className="print-area print-only">
          <style>{'@page { size: 4in 6in; margin: 0; }'}</style>
          <div className="sheets">{chunk(tree, 8).map((g, i) => <div key={i} className="label-sheet tags-2x4">{g.map((l) => <div key={l.id} className="ltag"><div className="lname">{l.name}</div><div className="lmeta">{locationPath(s, l.id)}</div><div className="lbottom"><span className="lsku">{l.id}</span><QR value={`daybreak-location:${l.id}`} size={58} /></div></div>)}</div>)}</div>
        </div>
      )}
    </>
  );
}
export const chunk = (xs, n) => xs.reduce((a, x, i) => (i % n ? a[a.length - 1].push(x) : a.push([x]), a), []);

function RenameRow({ loc, onRename, onDelete }) {
  const [v, setV] = useState(loc.name);
  return (
    <form className="row wrap" onSubmit={(e) => { e.preventDefault(); if (v.trim() && v !== loc.name) onRename(v.trim()); }}>
      <input className="input" style={{ height: 32, maxWidth: 180 }} value={v} onChange={(e) => setV(e.target.value)} aria-label="Location name" />
      <button className="btn secondary sm" disabled={!v.trim() || v === loc.name}>Rename</button>
      <button type="button" className="btn ghost sm" onClick={onDelete}>Delete</button>
    </form>
  );
}
