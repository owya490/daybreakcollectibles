import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import Icon from './Icon.jsx';
import { cls, TYPE_LABEL } from '../lib/util.js';

// ---------- Toasts ----------
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, kind = 'ok') => {
    const id = Math.random();
    setItems((x) => [...x, { id, msg, kind }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === 'err' ? 5200 : 2800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => <div key={t.id} className={cls('toast', t.kind)}>{t.msg}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------- Overlay primitives ----------
function useEsc(onClose) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [onClose]);
}
export function Drawer({ title, onClose, children, footer, side = 'right' }) {
  useEsc(onClose);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className={cls('drawer', side === 'left' && 'left')} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="drawer-head">
          <h3 className="serif" style={{ fontSize: 26, color: 'var(--indigo)' }}>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </>
  );
}
export function Modal({ title, onClose, children, width = 560 }) {
  useEsc(onClose);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" style={{ '--mw': width + 'px' }}>
        <div className="modal-head">
          <h3 style={{ fontSize: 18, fontWeight: 650 }}>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </>
  );
}

/** Promise-based confirm without a browser dialog. */
const ConfirmCtx = createContext(null);
export function ConfirmProvider({ children }) {
  const [req, setReq] = useState(null);
  const ask = useCallback((opts) => new Promise((resolve) => setReq({ ...opts, resolve })), []);
  const done = (v) => { req?.resolve(v); setReq(null); };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {req && (
        <Modal title={req.title || 'Are you sure?'} onClose={() => done(false)} width={420}>
          <p className="muted" style={{ marginBottom: 18 }}>{req.body}</p>
          <div className="row end">
            <button className="btn secondary" onClick={() => done(false)}>Cancel</button>
            <button className={cls('btn', req.danger && 'danger')} onClick={() => done(true)}>{req.ok || 'Confirm'}</button>
          </div>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => useContext(ConfirmCtx);

// ---------- Product imagery ----------
/** Shows the product's real image, or a clearly labelled placeholder. Never a substitute image. */
export function ProductImage({ product, index = 0, className, square, slab, alt, note, compact }) {
  const img = product?.images?.[index];
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [img?.url]);
  const shape = square ? 'square' : slab ? 'slab' : '';
  return (
    <div className={cls('pimg', shape, className)}>
      {img?.url && !broken ? (
        <img src={img.url} alt={alt || product?.name || ''} loading="lazy" decoding="async" onError={() => setBroken(true)} referrerPolicy="no-referrer" />
      ) : (
        <div className={cls('placeholder', product?.type === 'guard' && 'cream')}>
          <div className="ph-sun" />
          {!compact && <div className="ph-title">{product?.name || 'Product'}</div>}
          <div className="ph-note">{note || (broken ? 'Image unavailable' : product?.type === 'guard' ? 'Product photo pending' : product?.type === 'sealed' ? 'Product photo pending' : 'Photo pending')}</div>
          {product?.type && !compact && <div className="ph-note" style={{ opacity: 0.55 }}>{TYPE_LABEL[product.type]}</div>}
        </div>
      )}
    </div>
  );
}

// ---------- QR / barcode ----------
export function QR({ value, size = 96, style }) {
  const [src, setSrc] = useState(null);
  useEffect(() => { QRCode.toDataURL(value || ' ', { margin: 0, width: size * 2, errorCorrectionLevel: 'M' }).then(setSrc).catch(() => setSrc(null)); }, [value, size]);
  return src ? <img src={src} alt={`QR code: ${value}`} style={{ width: size, height: size, ...style }} /> : <div style={{ width: size, height: size }} />;
}
export function Barcode({ value, height = 28, className }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try { JsBarcode(ref.current, value, { format: 'CODE128', displayValue: false, height, margin: 0, width: 1.2 }); } catch { /* invalid */ }
  }, [value, height]);
  return <svg ref={ref} className={className} />;
}

// ---------- Inputs ----------
export function Field({ label, hint, error, children, style }) {
  return (
    <label className="field" style={style}>
      {label && <span>{label}</span>}
      {children}
      {hint && <small className="hint">{hint}</small>}
      {error && <small className="err">{error}</small>}
    </label>
  );
}
export function MoneyInput({ value, onChange, ...rest }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', fontSize: 14 }}>$</span>
      <input className="input money" inputMode="decimal" style={{ paddingLeft: 24 }} value={value ?? ''} onChange={(e) => onChange(e.target.value)} onFocus={(e) => e.target.select()} {...rest} />
    </div>
  );
}
export function Seg({ value, onChange, options, lg }) {
  return (
    <div className={cls('seg', lg && 'lg')} role="tablist">
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return <button key={v} type="button" role="tab" aria-selected={value === v} className={cls(value === v && 'on')} onClick={() => onChange(v)}>{l}</button>;
      })}
    </div>
  );
}
export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <div className="serif">{title}</div>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>{children}</div>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
export function useLocalState(key, initial) {
  const [v, setV] = useState(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : initial; } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } }, [key, v]);
  return [v, setV];
}
export function useOnline() {
  const [on, setOn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener('online', a); window.addEventListener('offline', b);
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); };
  }, []);
  return on;
}
