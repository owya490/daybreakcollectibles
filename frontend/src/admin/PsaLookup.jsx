import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDB, findCert } from '../data/db.js';
import { useToast, Field } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { lookupCert, PsaNotConfigured, guessName } from '../services/psa.js';
import { ProductFields, UnitFields, ImageManager, CardLookup, marketFrom } from './common.jsx';
import { blankProduct, blankUnit, saveDraft } from './AddInventory.jsx';
import { useCamera } from './Scan.jsx';
import { cls } from '../lib/util.js';

const STEPS = ['Scan cert', 'Retrieve details', 'Slab images', 'Confirm grade', 'Cost', 'Asking price', 'Save'];

export default function PsaLookup() {
  const [sp] = useSearchParams();
  const s = useDB();
  const toast = useToast();
  const [cert, setCert] = useState(sp.get('cert') || '');
  const [state, setState] = useState({ phase: 'input' });
  const [product, setProduct] = useState(blankProduct('slab'));
  const [unit, setUnit] = useState(blankUnit('slab'));
  const [showPrice, setShowPrice] = useState(false);
  const [scanning, setScanning] = useState(false);
  const onCode = useCallback((raw) => { const v = String(raw).replace(/\D/g, ''); if (v.length >= 8) { setCert(v); setScanning(false); } }, []);
  const cam = useCamera({ onCode });
  useEffect(() => { if (scanning) cam.start(); else cam.stop(); }, [scanning]);
  useEffect(() => { if (sp.get('cert')) run(sp.get('cert')); }, []);

  const run = async (c = cert) => {
    const clean = String(c).replace(/\D/g, '');
    if (!clean) return toast('Enter a cert number', 'err');
    const dup = findCert(s, clean);
    if (dup) { setState({ phase: 'dup', dup }); return; }
    setState({ phase: 'loading' });
    try {
      const r = await lookupCert(clean);
      const images = [r.frontImage && { url: r.frontImage, source: 'PSA certification image', label: 'Front' }, r.backImage && { url: r.backImage, source: 'PSA certification image', label: 'Back' }].filter(Boolean);
      setProduct({ ...blankProduct('slab'), name: guessName(r.subject) + (r.variety ? ` ${r.variety.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase())}` : ''), pokemon: guessName(r.subject), set: r.brand, number: r.cardNumber, releaseYear: parseInt(r.year, 10) || '', images, psa: r });
      setUnit({ ...blankUnit('slab'), cert: r.cert, certVerified: true, grade: r.grade, psaVerifiedAt: r.retrievedAt });
      setState({ phase: 'result', verified: true, r });
    } catch (e) {
      setProduct(blankProduct('slab'));
      setUnit({ ...blankUnit('slab'), cert: clean, certVerified: false });
      setState({ phase: 'result', verified: false, error: e.message, notConfigured: e instanceof PsaNotConfigured });
    }
  };
  const stepIdx = state.phase === 'input' || state.phase === 'loading' ? 0 : !unit.grade ? 3 : !unit.cost ? 4 : !unit.ask ? 5 : 6;

  return (
    <>
      <div className="page-head"><div><h1>PSA certification lookup</h1><p>Scan or type a cert number. Verified details are clearly marked; nothing is invented.</p></div></div>
      <div className="steps">{STEPS.map((x, i) => <span key={x} className={cls(i === stepIdx && 'on', i < stepIdx && 'done')}>{i + 1}. {x}</span>)}</div>
      <div className="panel" style={{ marginBottom: 14 }}>
        <form className="row wrap" onSubmit={(e) => { e.preventDefault(); run(); }}>
          <input className="input lg" style={{ maxWidth: 320 }} inputMode="numeric" placeholder="PSA cert number" value={cert} onChange={(e) => setCert(e.target.value)} autoFocus />
          <button className="btn lg" disabled={state.phase === 'loading'}>{state.phase === 'loading' ? 'Looking up…' : 'Look up'}</button>
          <button type="button" className="btn secondary lg" onClick={() => setScanning((x) => !x)}><Icon name="scan" />{scanning ? 'Stop camera' : 'Scan label barcode'}</button>
        </form>
        {scanning && <div className="camera" style={{ maxWidth: 420, marginTop: 12, aspectRatio: '4/3' }}><video ref={cam.videoRef} playsInline muted /><div className="frame wide" />{cam.status === 'error' && <p style={{ position: 'absolute' }}>{cam.error}</p>}</div>}
      </div>

      {state.phase === 'dup' && <div className="notice danger">Cert {state.dup.cert} is already in inventory as {state.dup.sku}. <Link to={`/admin/inventory?q=${state.dup.cert}`} style={{ textDecoration: 'underline' }}>Open it</Link> instead of adding a duplicate.</div>}

      {state.phase === 'result' && (<>
        {state.verified
          ? <div className="notice ok" style={{ marginBottom: 14 }}><b>Verified with PSA.</b> {state.r.year} {state.r.brand} · {state.r.subject} · {state.r.gradeDescription}{state.r.population != null && ` · Pop ${state.r.population}`} · <a href={state.r.verifyUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>View on PSA</a>. Check the card name and set below; PSA labels use abbreviations.</div>
          : <div className="notice warn" style={{ marginBottom: 14 }}><b>Not verified.</b> {state.error} {state.notConfigured && <Link to="/admin/integrations" style={{ textDecoration: 'underline' }}>Set up PSA</Link>} Enter the slab details manually; the listing will be marked "cert entered manually". You can <a href={`https://www.psacard.com/cert/${cert.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>check this cert on PSA's site</a>.</div>}
        <div className="dash-grid" style={{ marginTop: 0 }}>
          <div className="panel span-6 stack">
            <h3>Card details <button className="btn ghost sm" onClick={() => setShowPrice((x) => !x)}>{showPrice ? 'Hide' : 'Match card for image & raw price'}</button></h3>
            {showPrice && <CardLookup initial={{ name: product.pokemon }} compact onPick={(c, pr) => { if (c) { setProduct({ ...product, name: product.name || c.name, set: c.set, setCode: c.setCode, number: c.number, rarity: c.rarity, language: c.language, images: product.images.length ? product.images : (c.image ? [{ url: c.image, source: c.imageSource, label: 'Card artwork (not the slab)' }] : []) }); setUnit({ ...unit, market: marketFrom(pr) ? { ...marketFrom(pr), label: 'Raw card reference (not graded)' } : null }); } setShowPrice(false); }} />}
            <ProductFields p={product} set={setProduct} />
            <ImageManager images={product.images} onChange={(images) => setProduct({ ...product, images })} label="Slab images (front & back)" />
            {!product.images.length && <p className="tiny muted">No PSA images available. Photograph the slab front and back and upload them here.</p>}
          </div>
          <div className="panel span-6 stack">
            <h3>Grade, cost & price</h3>
            {unit.certVerified && <span className="badge green" style={{ alignSelf: 'flex-start' }}><Icon name="shield" size={13} /> Cert {unit.cert} verified</span>}
            <UnitFields type="slab" u={unit} set={(u) => setUnit({ ...u, certVerified: u.cert === unit.cert ? unit.certVerified : false })} market={unit.market} />
            <p className="tiny muted">Graded market prices are not available from the connected card APIs. The market reference shown (if any) is for the raw card. Check recent graded sales before pricing.</p>
            <div className="row end"><button className="btn secondary" onClick={() => { setState({ phase: 'input' }); setCert(''); }}>Cancel</button>
              <button className="btn" onClick={() => { if (saveDraft({ product: { ...product, verifiedFields: unit.certVerified ? ['grade', 'cert', 'subject'] : [] }, unit, toast })) { setState({ phase: 'input' }); setCert(''); } }}>Save slab</button></div>
          </div>
        </div>
      </>)}
    </>
  );
}
