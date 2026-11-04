import { useState } from 'react';
import { useDB, updateSettings, exportBackup, importBackup, clearDemoData, resetToDemo, hasDemoData } from '../data/db.js';
import { Field, useToast, useConfirm, MoneyInput, QR } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { LogoMark } from '../components/Logo.jsx';
import { download, fileToDataUrl, sha256, num, uid, fmtDate } from '../lib/util.js';

export default function Settings() {
  const s = useDB();
  const toast = useToast();
  const confirm = useConfirm();
  const st = s.settings;
  const set = (patch) => updateSettings(patch);
  const [pw, setPw] = useState('');
  const shopUrl = st.business.storefrontUrl || location.origin;
  return (
    <>
      <div className="page-head"><div><h1>Settings</h1><p>Brand, banners, shipping, discounts, trade rules and your data.</p></div></div>
      <div className="dash-grid" style={{ marginTop: 0 }}>
        <div className="panel span-6 stack">
          <h3>Brand & business</h3>
          <div className="row"><LogoMark size={64} /><div className="stack tight grow">
            <label className="btn secondary sm" style={{ alignSelf: 'flex-start' }}><Icon name="upload" size={14} />Replace crest<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files[0]; if (f) { set({ logoDataUrl: await fileToDataUrl(f, 600, 0.92) }); toast('Logo updated across the site'); } }} /></label>
            <span className="tiny muted">The Daybreak crest and wordmark are built into the site. Upload a replacement crest only if the mark changes.</span>
            {st.logoDataUrl && <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => set({ logoDataUrl: null })}>Remove</button>}
          </div></div>
          <div className="grid-2 collapse">
            <Field label="Business name"><input className="input" value={st.business.name} onChange={(e) => set({ business: { ...st.business, name: e.target.value } })} /></Field>
            <Field label="Contact email"><input className="input" value={st.business.email} onChange={(e) => set({ business: { ...st.business, email: e.target.value } })} /></Field>
            <Field label="Instagram URL"><input className="input" value={st.business.instagram} onChange={(e) => set({ business: { ...st.business, instagram: e.target.value } })} /></Field>
            <Field label="ABN (for invoices)"><input className="input" value={st.business.abn} onChange={(e) => set({ business: { ...st.business, abn: e.target.value } })} /></Field>
            <Field label="Public storefront URL" hint="Used for label and booth QR codes" style={{ gridColumn: '1 / -1' }}><input className="input" placeholder={location.origin} value={st.business.storefrontUrl} onChange={(e) => set({ business: { ...st.business, storefrontUrl: e.target.value.trim() } })} /></Field>
          </div>
          <div className="row"><QR value={shopUrl} size={96} /><div className="small"><b>Booth QR code</b><div className="muted">Links to {shopUrl}. Right-click or long-press to save, or print this page.</div></div></div>
        </div>

        <div className="panel span-6 stack">
          <h3>Homepage banners <button className="btn sm secondary" onClick={() => set({ banners: [...st.banners, { id: uid('b'), active: true, eyebrow: 'New', title: 'New banner', subtitle: '', cta: 'Shop now', link: '/new-arrivals' }] })}><Icon name="plus" size={14} />Add</button></h3>
          {st.banners.map((b, i) => (
            <div key={b.id} className="card pad stack tight">
              <div className="row between"><label className="check"><input type="checkbox" checked={b.active} onChange={(e) => set({ banners: st.banners.map((x) => (x.id === b.id ? { ...x, active: e.target.checked } : x)) })} />Show banner {i + 1}</label><button className="btn ghost sm" onClick={() => set({ banners: st.banners.filter((x) => x.id !== b.id) })}>Remove</button></div>
              {['eyebrow', 'title', 'subtitle', 'cta', 'link'].map((k) => <input key={k} className="input" placeholder={k} value={b[k]} onChange={(e) => set({ banners: st.banners.map((x) => (x.id === b.id ? { ...x, [k]: e.target.value } : x)) })} />)}
            </div>
          ))}
        </div>

        <div className="panel span-6 stack">
          <h3>Shipping rates <button className="btn sm secondary" onClick={() => set({ shipping: [...st.shipping, { id: uid('s'), name: 'New rate', price: 10, freeOver: null, domestic: true, active: true }] })}><Icon name="plus" size={14} />Add</button></h3>
          {st.shipping.map((r) => (
            <div key={r.id} className="row wrap">
              <input type="checkbox" checked={r.active} onChange={(e) => set({ shipping: st.shipping.map((x) => (x.id === r.id ? { ...x, active: e.target.checked } : x)) })} aria-label="Active" />
              <input className="input grow" style={{ minWidth: 180 }} value={r.name} onChange={(e) => set({ shipping: st.shipping.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)) })} />
              <div style={{ width: 100 }}><MoneyInput value={r.price} onChange={(v) => set({ shipping: st.shipping.map((x) => (x.id === r.id ? { ...x, price: num(v) } : x)) })} /></div>
              <div style={{ width: 130 }}><MoneyInput placeholder="free over" value={r.freeOver ?? ''} onChange={(v) => set({ shipping: st.shipping.map((x) => (x.id === r.id ? { ...x, freeOver: v === '' ? null : num(v) } : x)) })} /></div>
              <button className="btn ghost sm square" onClick={() => set({ shipping: st.shipping.filter((x) => x.id !== r.id) })} aria-label="Remove"><Icon name="trash" size={14} /></button>
            </div>
          ))}
          <label className="check"><input type="checkbox" checked={st.international} onChange={(e) => set({ international: e.target.checked })} />Offer international shipping (add international rates above first)</label>
        </div>

        <div className="panel span-6 stack">
          <h3>Discount codes <button className="btn sm secondary" onClick={() => set({ discounts: [...st.discounts, { code: 'NEWCODE', type: 'percent', value: 10, active: true, minSpend: 0 }] })}><Icon name="plus" size={14} />Add</button></h3>
          {st.discounts.map((d, i) => (
            <div key={i} className="row wrap">
              <input type="checkbox" checked={d.active} onChange={(e) => set({ discounts: st.discounts.map((x, j) => (j === i ? { ...x, active: e.target.checked } : x)) })} aria-label="Active" />
              <input className="input" style={{ width: 130, textTransform: 'uppercase' }} value={d.code} onChange={(e) => set({ discounts: st.discounts.map((x, j) => (j === i ? { ...x, code: e.target.value.toUpperCase() } : x)) })} />
              <select className="select" style={{ width: 90 }} value={d.type} onChange={(e) => set({ discounts: st.discounts.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)) })}><option value="percent">%</option><option value="fixed">$</option></select>
              <input className="input" style={{ width: 80 }} value={d.value} onChange={(e) => set({ discounts: st.discounts.map((x, j) => (j === i ? { ...x, value: num(e.target.value) } : x)) })} />
              <div style={{ width: 130 }}><MoneyInput placeholder="min spend" value={d.minSpend || ''} onChange={(v) => set({ discounts: st.discounts.map((x, j) => (j === i ? { ...x, minSpend: num(v) } : x)) })} /></div>
              <button className="btn ghost sm square" onClick={() => set({ discounts: st.discounts.filter((_, j) => j !== i) })} aria-label="Remove"><Icon name="trash" size={14} /></button>
            </div>
          ))}
        </div>

        <div className="panel span-6 stack">
          <h3>Buying, trading & checkout rules</h3>
          <div className="grid-2">
            <Field label="Default trade-in offer (% of market)"><input className="input" value={st.tradePct ?? 80} onChange={(e) => set({ tradePct: num(e.target.value) })} /></Field>
            <Field label="Default cash offer (% of market)"><input className="input" value={st.cashPct ?? 70} onChange={(e) => set({ cashPct: num(e.target.value) })} /></Field>
            <Field label="Checkout hold (minutes)"><input className="input" value={st.reservationMinutes} onChange={(e) => set({ reservationMinutes: Math.max(5, num(e.target.value)) })} /></Field>
          </div>
          <label className="check"><input type="checkbox" checked={st.allowNegativeCredit} onChange={(e) => set({ allowNegativeCredit: e.target.checked })} />Allow negative store credit balances (not recommended)</label>
        </div>

        <div className="panel span-6 stack">
          <h3>Admin passcode</h3>
          <div className="row"><input className="input" type="password" placeholder="New passcode (6+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /><button className="btn" disabled={pw.length < 6} onClick={async () => { set({ adminPassHash: await sha256(pw) }); setPw(''); toast('Passcode changed'); }}>Change</button></div>
          <p className="tiny muted">This build protects the admin on this device. A live deployment should use Supabase Auth with an admin role enforced by row-level security, so nothing private is ever sent to customers' browsers.</p>
        </div>

        <div className="panel span-12 stack">
          <h3>Your data</h3>
          <p className="small muted">Everything currently lives in this browser and syncs instantly between open tabs. Export a backup regularly, and before clearing browser data. {s.audit.length} audit entries recorded.</p>
          <div className="row wrap">
            <button className="btn" onClick={() => download(`daybreak-backup-${new Date().toISOString().slice(0, 10)}.json`, exportBackup(), 'application/json')}><Icon name="download" size={16} />Export full backup</button>
            <label className="btn secondary"><Icon name="upload" size={16} />Restore backup<input type="file" accept="application/json" hidden onChange={async (e) => { const f = e.target.files[0]; if (!f) return; if (await confirm({ title: 'Restore this backup?', body: 'This replaces all current data on this device.', ok: 'Restore', danger: true })) { try { importBackup(await f.text()); toast('Backup restored'); } catch (err) { toast(err.message, 'err'); } } e.target.value = ''; }} /></label>
            {hasDemoData(s) && <button className="btn danger" onClick={async () => { if (await confirm({ title: 'Remove all sample data?', body: 'Deletes the demonstration products, customers and transactions. Anything you added yourself is kept.', ok: 'Remove sample data', danger: true })) { clearDemoData(); toast('Sample data removed'); } }}>Remove sample data</button>}
            <button className="btn ghost" onClick={async () => { if (await confirm({ title: 'Reset to the demo?', body: 'Erases ALL data on this device and reloads the sample inventory. Export a backup first if you need it.', ok: 'Erase and reset', danger: true })) { resetToDemo(); toast('Reset to demo data'); } }}>Reset to demo</button>
          </div>
          <details><summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>Recent audit log</summary>
            <table className="t" style={{ marginTop: 8 }}><tbody>{s.audit.slice(0, 40).map((a) => <tr key={a.id}><td className="small">{fmtDate(a.at, true)}</td><td className="small">{a.action}</td><td className="small">{a.entityId}</td><td className="small muted">{a.detail}</td></tr>)}</tbody></table>
          </details>
        </div>
      </div>
    </>
  );
}
