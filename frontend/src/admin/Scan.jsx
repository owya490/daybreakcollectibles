import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDB, findDuplicateProduct, productById, getState } from '../data/db.js';
import { useToast, ProductImage, Seg } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { CardLookup, UnitFields, candidateToProduct, marketFrom, Pickers } from './common.jsx';
import { blankUnit, blankProduct, saveDraft } from './AddInventory.jsx';
import { recognise, recognitionAvailable, barcodeSupported, detectCodes } from '../services/recognition.js';
import { aud, cls, VARIANTS, fileToDataUrl } from '../lib/util.js';

const STEPS = ['Scan', 'Identify', 'Variant', 'Condition', 'Cost', 'Price', 'Save'];

/** Camera hook: rear camera, capture to blob, optional live barcode detection. */
export function useCamera({ onCode } = {}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | starting | live | error
  const [error, setError] = useState('');
  const stop = useCallback(() => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; setStatus('idle'); }, []);
  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setError('Camera access needs HTTPS (or localhost) and a supported browser.'); setStatus('error'); return; }
    setStatus('starting');
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      streamRef.current = st;
      if (videoRef.current) { videoRef.current.srcObject = st; await videoRef.current.play().catch(() => {}); }
      setStatus('live');
    } catch (e) { setError(e.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your browser settings.' : `Camera unavailable: ${e.message}`); setStatus('error'); }
  }, []);
  useEffect(() => stop, [stop]);
  useEffect(() => {
    if (status !== 'live' || !onCode || !barcodeSupported()) return;
    let alive = true;
    const tick = async () => {
      if (!alive || !videoRef.current) return;
      const codes = await detectCodes(videoRef.current);
      if (codes.length && alive) onCode(codes[0].rawValue);
      if (alive) setTimeout(tick, 450);
    };
    tick();
    return () => { alive = false; };
  }, [status, onCode]);
  const capture = () => new Promise((resolve) => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return resolve(null);
    const c = document.createElement('canvas');
    const k = Math.min(1, 1000 / Math.max(v.videoWidth, v.videoHeight)); // keep stored photos small
    c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((b) => resolve({ blob: b, url: c.toDataURL('image/jpeg', 0.85) }), 'image/jpeg', 0.9);
  });
  return { videoRef, status, error, start, stop, capture };
}

/** Interpret a scanned code: Daybreak SKU, storefront QR, or PSA cert barcode. */
export function interpretCode(raw) {
  const s = getState();
  const v = String(raw).trim();
  const m = v.match(/\/item\/(u-[\w]+)/);
  if (m) { const u = s.units.find((x) => x.id === m[1]); if (u) return { kind: 'unit', unit: u }; }
  const bySku = s.units.find((x) => x.sku.toLowerCase() === v.toLowerCase());
  if (bySku) return { kind: 'unit', unit: bySku };
  const byCert = s.units.find((x) => x.cert && x.cert.replace(/\D/g, '') === v.replace(/\D/g, '') && x.status !== 'archived');
  if (byCert) return { kind: 'unit', unit: byCert };
  if (/^\d{8,10}$/.test(v)) return { kind: 'psa', cert: v };
  if (/^\d{12,13}$/.test(v)) { const p = s.products.find((x) => x.barcode === v); return p ? { kind: 'product', product: p } : { kind: 'barcode', code: v }; }
  return { kind: 'unknown', raw: v };
}

export default function Scan() {
  const s = useDB();
  const toast = useToast();
  const nav = useNavigate();
  const [type, setType] = useState('single');
  const [phase, setPhase] = useState('scan'); // scan | identify | confirm
  const [photo, setPhoto] = useState(null);
  const [recog, setRecog] = useState(null);
  const [hint, setHint] = useState({});
  const [product, setProduct] = useState(null);
  const [unit, setUnit] = useState(blankUnit('single'));
  const [session, setSession] = useState([]);
  const [code, setCode] = useState(null);
  const onCode = useCallback((raw) => setCode((c) => (c?.raw === raw ? c : { raw, ...interpretCode(raw) })), []);
  const cam = useCamera({ onCode });
  const fileRef = useRef(null);
  const sticky = useRef({ cost: '', locationId: null, condition: 'Near Mint' });

  useEffect(() => { if (phase === 'scan') cam.start(); else cam.stop(); }, [phase]);
  useEffect(() => { if (code?.kind === 'psa') { cam.stop(); nav(`/admin/psa?cert=${code.cert}`); } }, [code]);

  const identify = async (shot) => {
    setPhoto(shot?.url || null);
    setPhase('identify');
    setRecog(null);
    if (shot?.blob && recognitionAvailable()) {
      setRecog({ loading: true });
      try { const r = await recognise(shot.blob); setRecog(r); if (r.candidates[0]) setHint({ name: r.candidates[0].name, number: r.candidates[0].number, language: r.candidates[0].language }); }
      catch (e) { setRecog({ error: e.message }); }
    }
  };
  const pick = (c, pr) => {
    const p = c ? candidateToProduct(c, type) : blankProduct(type);
    const dup = c && findDuplicateProduct(s, p);
    setProduct(dup ? { ...dup, _reuse: dup.id } : p);
    setUnit({ ...blankUnit(type), cost: sticky.current.cost, locationId: sticky.current.locationId, condition: type === 'single' ? sticky.current.condition : '', market: marketFrom(pr) });
    setPhase('confirm');
  };
  const save = (again) => {
    const { _reuse, ...p } = product;
    if (photo && !p.images?.length) p.images = [{ url: photo, source: 'Scanned photo (Daybreak)' }];
    if (!saveDraft({ product: p, unit, toast, reuse: _reuse })) return;
    sticky.current = { cost: '', locationId: unit.locationId, condition: unit.condition || 'Near Mint' };
    setSession((x) => [{ name: p.name, ask: unit.ask, at: Date.now() }, ...x]);
    setProduct(null); setPhoto(null); setHint({});
    setPhase(again ? 'scan' : 'done');
  };
  const stepIdx = phase === 'scan' ? 0 : phase === 'identify' ? 1 : unit.ask ? 5 : unit.cost ? 4 : 3;
  const existing = code?.kind === 'unit' ? code.unit : null;

  return (
    <>
      <div className="page-head">
        <div><h1>Scan cards</h1><p>Bulk mode: each save returns to the camera. {session.length > 0 && <b>{session.length} added this session.</b>}</p></div>
        <Seg value={type} onChange={(t) => { setType(t); setPhase('scan'); }} options={[{ value: 'single', label: 'Raw singles' }, { value: 'sealed', label: 'Sealed' }, { value: 'slab', label: 'PSA slab' }]} />
      </div>
      <div className="steps">{STEPS.map((x, i) => <span key={x} className={cls(i === stepIdx && 'on', i < stepIdx && 'done')}>{i + 1}. {x}</span>)}</div>
      {type === 'slab' && <div className="notice" style={{ marginBottom: 12 }}>For slabs, point the camera at the PSA label barcode, or <Link to="/admin/psa" style={{ fontWeight: 700, textDecoration: 'underline' }}>type the cert number</Link>.</div>}

      {phase === 'scan' && (
        <div className="dash-grid" style={{ marginTop: 0 }}>
          <div className="span-6">
            <div className="camera">
              <video ref={cam.videoRef} playsInline muted />
              {cam.status === 'live' && <div className={cls('frame', type === 'slab' && 'wide')} />}
              {cam.status !== 'live' && <div className="center" style={{ position: 'absolute', padding: 20 }}>{cam.status === 'error' ? <p>{cam.error}</p> : <p>Starting camera…</p>}</div>}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn lg grow" disabled={cam.status !== 'live'} onClick={async () => identify(await cam.capture())}><Icon name="camera" />Capture</button>
              <button className="btn secondary lg" onClick={() => fileRef.current?.click()}>Photo</button>
              <button className="btn secondary lg" onClick={() => identify(null)}>Search</button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) identify({ blob: f, url: await fileToDataUrl(f) }); }} />
            </div>
            <p className="tiny muted" style={{ marginTop: 8 }}>{barcodeSupported() ? 'Barcodes and QR codes (SKU labels, PSA labels, sealed EAN) are detected automatically.' : 'Automatic barcode detection is not supported in this browser (works in Chrome on Android and desktop).'}</p>
          </div>
          <div className="span-6 stack">
            {existing && <ExistingCard unit={existing} onClear={() => setCode(null)} />}
            {code?.kind === 'barcode' && <div className="notice small">Barcode {code.code} isn't linked to a product yet. Capture or search to add it, and save the barcode on the sealed product.</div>}
            {code?.kind === 'unknown' && <div className="notice small">Scanned "{code.raw}" but it doesn't match a SKU, cert or barcode.</div>}
            <div className="panel">
              <h3>Recognition</h3>
              {recognitionAvailable() ? <p className="small">Image recognition is connected. Captured photos are matched and shown as candidates for you to confirm.</p>
                : <p className="small muted">Automatic image recognition needs a recognition provider (see API Integrations). Until then, capture keeps the photo and you confirm the card with a quick name or number search: usually two or three taps.</p>}
            </div>
            {session.length > 0 && <div className="panel"><h3>Added this session</h3>{session.slice(0, 8).map((x) => <div key={x.at} className="sum-row small"><span>{x.name}</span><b>{aud(x.ask)}</b></div>)}</div>}
          </div>
        </div>
      )}

      {phase === 'identify' && (
        <div className="dash-grid" style={{ marginTop: 0 }}>
          <div className="span-4">{photo ? <div className="camera" style={{ aspectRatio: '5/7' }}><img src={photo} alt="Captured card" /></div> : <div className="panel small muted">No photo. Searching by text.</div>}
            <button className="btn secondary block" style={{ marginTop: 10 }} onClick={() => setPhase('scan')}>Retake</button></div>
          <div className="span-8 panel">
            <h3>Identify the card</h3>
            {recog?.loading && <div className="notice small">Matching image…</div>}
            {recog?.error && <div className="notice warn small">Recognition failed: {recog.error}. Search below.</div>}
            {recog?.candidates?.length > 0 && <div className="notice small" style={{ marginBottom: 10 }}>Recognition suggests {recog.candidates.slice(0, 3).map((c) => `${c.name} ${c.number || ''} (${Math.round((c.confidence || 0) * 100)}%)`).join(', ')}. Confirm the exact print below.</div>}
            {type === 'sealed' ? (
              <div className="stack"><p className="small muted">Sealed product databases have limited API coverage, so enter the product details. Scanning the EAN links it for next time.</p><button className="btn" onClick={() => pick(null, null)}>Enter sealed product</button></div>
            ) : <CardLookup key={JSON.stringify(hint)} initial={hint} autoFocus onPick={pick} />}
          </div>
        </div>
      )}

      {phase === 'confirm' && product && (
        <div className="dash-grid" style={{ marginTop: 0 }}>
          <div className="span-4 panel stack">
            <ProductImage product={photo && !product.images?.length ? { ...product, images: [{ url: photo }] } : product} />
            <div><div className="cell-title">{product.name}</div><div className="cell-sub">{product.set} · {product.number} · {product.language}</div>{product._reuse && <span className="badge amber" style={{ marginTop: 6 }}>Already in catalogue: adding a copy</span>}</div>
            {type === 'single' && <div className="field"><span>Variant</span><Pickers value={product.variant} onChange={(v) => setProduct({ ...product, variant: v })} options={VARIANTS.slice(0, 7)} /></div>}
            {type === 'sealed' && <><input className="input" placeholder="Product name" value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} /><input className="input" placeholder="Set" value={product.set} onChange={(e) => setProduct({ ...product, set: e.target.value })} /><input className="input" placeholder="EAN barcode" value={product.barcode || (code?.kind === 'barcode' ? code.code : '')} onChange={(e) => setProduct({ ...product, barcode: e.target.value })} /></>}
          </div>
          <div className="span-8 panel stack">
            <UnitFields type={type} u={unit} set={setUnit} market={unit.market} />
            <div className="row end wrap">
              <button className="btn secondary" onClick={() => setPhase('identify')}>Back</button>
              <button className="btn secondary lg" onClick={() => save(false)}>Save</button>
              <button className="btn lg" onClick={() => save(true)}>Save & scan next</button>
            </div>
          </div>
        </div>
      )}
      {phase === 'done' && <div className="panel center"><p className="serif" style={{ fontSize: 26, color: 'var(--indigo)' }}>Saved</p><div className="row" style={{ justifyContent: 'center', marginTop: 12 }}><button className="btn" onClick={() => setPhase('scan')}>Scan another</button><Link className="btn secondary" to="/admin/inventory">View inventory</Link></div></div>}
    </>
  );
}

function ExistingCard({ unit, onClear }) {
  const s = useDB();
  const p = productById(s, unit.productId);
  return (
    <div className="panel" style={{ borderColor: 'var(--indigo)' }}>
      <h3>Already in inventory <button className="btn ghost sm" onClick={onClear}>Dismiss</button></h3>
      <div className="row"><div style={{ width: 60 }}><ProductImage product={p} compact /></div><div className="grow"><div className="cell-title">{p?.name}{unit.grade ? ` PSA ${unit.grade}` : ''}</div><div className="cell-sub">{unit.sku} · {unit.status} · qty {unit.qty}</div></div><b>{aud(unit.ask)}</b></div>
      <div className="row" style={{ marginTop: 10 }}><Link className="btn sm" to={`/admin/pos?add=${unit.id}`}>Sell in POS</Link><Link className="btn sm secondary" to={`/admin/inventory?q=${unit.sku}`}>Open record</Link></div>
    </div>
  );
}
