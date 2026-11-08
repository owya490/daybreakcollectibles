import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useDB, updateSettings, hasDemoData, getSaveError } from '../data/db.js';
import Logo, { LogoMark, Wordmark } from '../components/Logo.jsx';
import Icon from '../components/Icon.jsx';
import { Field, useLocalState, useToast } from '../components/ui.jsx';
import { sha256, cls } from '../lib/util.js';
import Dashboard from './Dashboard.jsx';
import Inventory from './Inventory.jsx';
import AddInventory from './AddInventory.jsx';
import Scan from './Scan.jsx';
import PsaLookup from './PsaLookup.jsx';
import Pricing from './Pricing.jsx';
import { Purchases, BuySheet } from './Purchases.jsx';
import Trade from './Trade.jsx';
import { Customers, StoreCredit } from './Customers.jsx';
import POS from './POS.jsx';
import Orders from './Orders.jsx';
import Locations from './Locations.jsx';
import Labels from './Labels.jsx';
import Guards from './Guards.jsx';
import Reports from './Reports.jsx';
import Transactions from './Transactions.jsx';
import Integrations from './Integrations.jsx';
import Settings from './Settings.jsx';

const NAV = [
  { h: 'Overview', items: [['', 'Dashboard', 'grid']] },
  { h: 'Inventory', items: [['inventory', 'Inventory', 'layers'], ['inventory/new', 'Add Inventory', 'plus'], ['scan', 'Scan Cards', 'scan'], ['psa', 'PSA Lookup', 'shield'], ['pricing', 'Pricing', 'dollar'], ['locations', 'Locations', 'pin'], ['labels', 'Price Labels', 'printer'], ['guards', 'Art Guards', 'sparkle']] },
  { h: 'Buy · Sell · Trade', items: [['pos', 'Point of Sale', 'store'], ['buy-sheet', 'Buy Sheet', 'receipt'], ['purchases', 'Purchases', 'box'], ['trade', 'Trade Calculator', 'repeat'], ['transactions', 'Transactions', 'credit']] },
  { h: 'Customers & orders', items: [['orders', 'Online Orders', 'bag', 'orders'], ['fulfilment', 'Shipping & Fulfilment', 'truck'], ['customers', 'Customers', 'users'], ['store-credit', 'Store Credit', 'credit']] },
  { h: 'Business', items: [['reports', 'Reports', 'chart'], ['integrations', 'API Integrations', 'plug'], ['settings', 'Settings', 'settings']] },
];

function Login({ onDone }) {
  const hash = useDB((s) => s.settings.adminPassHash);
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const setup = !hash;
  return (
    <div className="login">
      <form className="box stack" onSubmit={async (e) => {
        e.preventDefault();
        if (setup) {
          if (pw.length < 6) return toast('Use at least 6 characters', 'err');
          if (pw !== pw2) return toast('Passcodes do not match', 'err');
          updateSettings({ adminPassHash: await sha256(pw) }, 'admin.passcode.set');
          onDone();
        } else if ((await sha256(pw)) === hash) onDone();
        else toast('Incorrect passcode', 'err');
      }}>
        <div className="row" style={{ justifyContent: 'center', flexDirection: 'column', gap: 14 }}><LogoMark size={86} /><Wordmark height={34} /></div>
        <h1 className="serif center" style={{ fontSize: 28, color: 'var(--navy-deep)', marginTop: 8 }}>{setup ? 'Set up admin access' : 'Admin sign in'}</h1>
        <p className="small muted">{setup ? 'Create a passcode for this device. You can change it in Settings.' : 'Enter your Daybreak admin passcode.'}</p>
        <Field label="Passcode"><input className="input lg" type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={setup ? 'new-password' : 'current-password'} /></Field>
        {setup && <Field label="Confirm passcode"><input className="input lg" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></Field>}
        <button className="btn lg block">{setup ? 'Create passcode' : 'Sign in'}</button>
        <p className="tiny muted">This preview stores data on this device. Production sign-in uses Supabase Auth with role-based access, enforced server-side.</p>
        <Link to="/" className="small" style={{ color: 'var(--indigo)' }}>← Back to storefront</Link>
      </form>
    </div>
  );
}

export default function AdminApp() {
  const [authed, setAuthed] = useState(() => { try { return sessionStorage.getItem('daybreak-admin') === '1'; } catch { return false; } });
  const [collapsed, setCollapsed] = useLocalState('daybreak-admin-collapsed', false);
  const [mopen, setMopen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const s = useDB();
  useEffect(() => setMopen(false), [loc.pathname]);
  if (!authed) return <Login onDone={() => { try { sessionStorage.setItem('daybreak-admin', '1'); } catch { /* */ } setAuthed(true); }} />;
  if (loc.pathname.startsWith('/admin/show')) return <POS showMode />;

  const awaiting = s.orders.filter((o) => ['paid', 'processing', 'awaiting_payment'].includes(o.status)).length;
  const saveErr = getSaveError();
  return (
    <div className={cls('admin', collapsed && 'collapsed', mopen && 'mopen')}>
      {mopen && <div className="scrim" style={{ zIndex: 85 }} onClick={() => setMopen(false)} />}
      <aside className="side" aria-label="Admin navigation">
        <div className="side-top"><LogoMark size={40} /><Wordmark inverse height={26} /></div>
        <NavLink to="/admin/show" className="show-mode"><Icon name="bolt" size={18} /><span className="lbl">Card Show Mode</span></NavLink>
        {NAV.map((g) => (
          <div className="side-group" key={g.h}>
            <h6>{g.h}</h6>
            {g.items.map(([to, label, icon, ct]) => (
              <NavLink key={to} to={`/admin/${to}`} end title={label}>
                <Icon name={icon} size={18} /><span className="lbl">{label}</span>
                {ct === 'orders' && awaiting > 0 && <span className="ct">{awaiting}</span>}
              </NavLink>
            ))}
          </div>
        ))}
        <div className="side-foot">
          <Link to="/" style={{ height: 32 }}><Icon name="store" size={16} /><span className="lbl">View storefront</span></Link>
          <a href="#" style={{ height: 32 }} onClick={(e) => { e.preventDefault(); try { sessionStorage.removeItem('daybreak-admin'); } catch { /* */ } setAuthed(false); }}><Icon name="logout" size={16} /><span className="lbl">Sign out</span></a>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <button className="icon-btn" onClick={() => (window.innerWidth <= 900 ? setMopen(true) : setCollapsed(!collapsed))} aria-label="Toggle navigation"><Icon name="panel" /></button>
          <form className="search" onSubmit={(e) => { e.preventDefault(); const q = new FormData(e.currentTarget).get('q'); nav(`/admin/inventory?q=${encodeURIComponent(q)}`); }}>
            <Icon name="search" size={16} /><input name="q" className="input" placeholder="Find stock by name, SKU or cert" />
          </form>
          <div className="row" style={{ marginLeft: 'auto' }}>
            {hasDemoData(s) && <Link to="/admin/settings" className="badge amber" title="Sample records are loaded">Sample data</Link>}
            <Link to="/admin/scan" className="btn sm"><Icon name="scan" size={16} /><span className="hide-sm">Scan</span></Link>
          </div>
        </div>
        {saveErr && <div className="notice danger" style={{ margin: '12px 22px 0' }}>Changes could not be saved on this device (storage full). Export a backup and remove large uploaded images.</div>}
        <div className="content">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="inventory/new" element={<AddInventory />} />
            <Route path="scan" element={<Scan />} />
            <Route path="psa" element={<PsaLookup />} />
            <Route path="pricing" element={<Pricing />} />
            <Route path="purchases" element={<Purchases />} />
            <Route path="buy-sheet" element={<BuySheet />} />
            <Route path="trade" element={<Trade />} />
            <Route path="customers" element={<Customers />} />
            <Route path="store-credit" element={<StoreCredit />} />
            <Route path="pos" element={<POS />} />
            <Route path="orders" element={<Orders />} />
            <Route path="fulfilment" element={<Orders fulfilment />} />
            <Route path="locations" element={<Locations />} />
            <Route path="labels" element={<Labels />} />
            <Route path="guards" element={<Guards />} />
            <Route path="reports" element={<Reports />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </div>
      </div>
      <nav className="mobile-tabbar" aria-label="Quick actions">
        <NavLink to="/admin" end><Icon name="grid" />Home</NavLink>
        <NavLink to="/admin/inventory"><Icon name="layers" />Stock</NavLink>
        <NavLink to="/admin/scan" className="scan"><span className="ic"><Icon name="scan" /></span></NavLink>
        <NavLink to="/admin/show"><Icon name="store" />Sell</NavLink>
        <NavLink to="/admin/trade"><Icon name="repeat" />Trade</NavLink>
      </nav>
    </div>
  );
}
