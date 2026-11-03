import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDB, addInventory, findDuplicateProduct, findCert, getState } from '../data/db.js';
import { useToast, Seg, Empty } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { CardLookup, ProductFields, UnitFields, ImageManager, candidateToProduct, marketFrom } from './common.jsx';
import { num, TYPE_LABEL } from '../lib/util.js';

export const blankUnit = (type) => ({ condition: type === 'single' ? 'Near Mint' : type === 'sealed' ? 'Factory Sealed' : type === 'guard' ? 'New' : '', grade: '', cert: '', certVerified: false, cost: '', ask: '', qty: 1, locationId: null, published: true, negotiable: false, notes: '', acquiredAt: new Date().toISOString(), market: null });
export const blankProduct = (type) => ({ type, name: '', pokemon: '', set: '', number: '', language: type === 'guard' ? '' : 'English', rarity: '', variant: '', images: [], description: '', ...(type === 'guard' ? { set: 'Daybreak Originals', compatibility: 'Standard PSA holder (current label)' } : {}) });

/** Shared save handler: duplicate checks + add. Returns true on success. */
export function saveDraft({ product, unit, toast, reuse }) {
  if (!product.name?.trim()) { toast('Add a product name', 'err'); return false; }
  if (unit.ask === '' || num(unit.ask) <= 0) { toast('Set an asking price', 'err'); return false; }
  if (product.type === 'slab' && !unit.grade) { toast('Choose the PSA grade', 'err'); return false; }
  if (unit.cert && findCert(getState(), unit.cert)) { toast(`Cert ${unit.cert} is already in inventory`, 'err'); return false; }
  try {
    const res = addInventory({ product, units: [{ ...unit, cost: num(unit.cost), ask: num(unit.ask), qty: product.type === 'slab' ? 1 : Math.max(1, num(unit.qty)) }], reuseProductId: reuse || undefined });
    toast(`Saved ${res.units[0].sku}${unit.published ? '. Live on the storefront.' : '.'}`);
    return true;
  } catch (e) { toast(e.message, 'err'); return false; }
}

export default function AddInventory() {
  const [sp] = useSearchParams();
  const s = useDB();
  const toast = useToast();
  const [type, setType] = useState(sp.get('type') || 'single');
  const [step, setStep] = useState(type === 'sealed' || type === 'guard' ? 'form' : 'lookup');
  const [product, setProduct] = useState(blankProduct(type));
  const [unit, setUnit] = useState(blankUnit(type));
  const [reuse, setReuse] = useState(null);
  const switchType = (t) => { setType(t); setProduct(blankProduct(t)); setUnit(blankUnit(t)); setStep(t === 'sealed' || t === 'guard' ? 'form' : 'lookup'); setReuse(null); };
  const dup = step === 'form' ? findDuplicateProduct(s, product) : null;
  const reset = () => { setProduct(blankProduct(type)); setUnit(blankUnit(type)); setReuse(null); setStep(type === 'sealed' || type === 'guard' ? 'form' : 'lookup'); };

  return (
    <>
      <div className="page-head">
        <div><h1>Add inventory</h1><p>Look it up, confirm, price it, and it's live.</p></div>
        <div className="row wrap"><Link to="/admin/scan" className="btn secondary"><Icon name="camera" size={16} />Use camera</Link><Link to="/admin/psa" className="btn secondary"><Icon name="shield" size={16} />PSA cert lookup</Link></div>
      </div>
      <div style={{ marginBottom: 16 }}><Seg value={type} onChange={switchType} options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))} /></div>
      {type === 'slab' && step === 'lookup' && <div className="notice" style={{ marginBottom: 12 }}>Have the cert number? <Link to="/admin/psa" style={{ fontWeight: 700, textDecoration: 'underline' }}>PSA lookup</Link> pulls the grade and slab images automatically. Or identify the card below.</div>}
      {step === 'lookup' ? (
        <div className="panel">
          <h3>Identify the card</h3>
          <CardLookup autoFocus onPick={(c, pr) => {
            if (!c) { setStep('form'); return; }
            const p = candidateToProduct(c, type);
            setProduct({ ...blankProduct(type), ...p });
            setUnit({ ...blankUnit(type), market: marketFrom(pr) });
            setStep('form');
          }} />
        </div>
      ) : (
        <div className="dash-grid" style={{ marginTop: 0 }}>
          <div className="panel span-6 stack">
            <h3>Catalogue details {type !== 'sealed' && type !== 'guard' && <button className="btn ghost sm" onClick={() => setStep('lookup')}>Search again</button>}</h3>
            {dup && !reuse && <div className="notice warn small">This card is already in your catalogue ({s.units.filter((u) => u.productId === dup.id && u.status === 'available').length} in stock). <button className="btn sm" style={{ marginLeft: 6 }} onClick={() => { setReuse(dup.id); setProduct({ ...dup }); }}>Add as another copy</button></div>}
            {reuse && <div className="notice ok small">Adding a new physical copy to the existing catalogue record.</div>}
            <ProductFields p={product} set={setProduct} />
            <ImageManager images={product.images} onChange={(images) => setProduct({ ...product, images })} label={type === 'guard' ? 'Product photography' : 'Images'} />
          </div>
          <div className="panel span-6 stack">
            <h3>This copy</h3>
            <UnitFields type={type} u={unit} set={setUnit} market={unit.market} />
            <div className="row end wrap">
              <button className="btn secondary" onClick={reset}>Discard</button>
              <button className="btn secondary" onClick={() => saveDraft({ product, unit, toast, reuse }) && setUnit({ ...unit, cert: '', grade: type === 'slab' ? '' : unit.grade })}>Save & add another copy</button>
              <button className="btn" onClick={() => saveDraft({ product, unit, toast, reuse }) && reset()}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
