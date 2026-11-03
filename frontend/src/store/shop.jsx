import { createContext, useContext, useMemo, useState } from 'react';
import { useDB, unitById, productById, availableQty } from '../data/db.js';
import { useLocalState } from '../components/ui.jsx';
import { uid } from '../lib/util.js';

const Ctx = createContext(null);

/** Per-browser shopping state. Stock truth always comes from the shared DB. */
export function ShopProvider({ children }) {
  const s = useDB();
  const [cart, setCart] = useLocalState('daybreak-cart', []);
  const [wish, setWish] = useLocalState('daybreak-wish', []);
  const [session, setSession] = useLocalState('daybreak-session', null); // { email, name }
  const [holder] = useLocalState('daybreak-holder', 'h-' + uid());
  const [cartOpen, setCartOpen] = useState(false);

  const lines = useMemo(() => cart.map((c) => {
    const u = unitById(s, c.unitId);
    const p = u && productById(s, u.productId);
    if (!u || !p) return { ...c, missing: true };
    const avail = availableQty(u, holder);
    return { ...c, unit: u, product: p, price: u.ask, available: avail, problem: avail <= 0 ? 'Sold out' : avail < c.qty ? `Only ${avail} left` : u.published ? null : 'No longer listed' };
  }).filter((l) => !l.missing), [cart, s, holder]);

  const api = {
    cart, lines, holder, wish, session, setSession, cartOpen, setCartOpen,
    count: lines.reduce((a, l) => a + l.qty, 0),
    subtotal: lines.reduce((a, l) => a + (l.problem === 'Sold out' ? 0 : l.price * Math.min(l.qty, l.available || 0)), 0),
    add(unitId, qty = 1) {
      setCart((c) => {
        const ex = c.find((x) => x.unitId === unitId);
        return ex ? c.map((x) => (x.unitId === unitId ? { ...x, qty: x.qty + qty } : x)) : [...c, { unitId, qty }];
      });
      setCartOpen(true);
    },
    setQty(unitId, qty) { setCart((c) => (qty <= 0 ? c.filter((x) => x.unitId !== unitId) : c.map((x) => (x.unitId === unitId ? { ...x, qty } : x)))); },
    remove(unitId) { setCart((c) => c.filter((x) => x.unitId !== unitId)); },
    clear() { setCart([]); },
    toggleWish(unitId) { setWish((w) => (w.includes(unitId) ? w.filter((x) => x !== unitId) : [...w, unitId])); },
    inCart: (unitId) => cart.some((c) => c.unitId === unitId),
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
export const useShop = () => useContext(Ctx);
