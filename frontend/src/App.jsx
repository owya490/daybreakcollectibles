import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { ShopProvider } from './store/shop.jsx';
import StoreLayout from './store/StoreLayout.jsx';
import Home from './store/Home.jsx';
import Catalog from './store/Catalog.jsx';
import ProductPage from './store/ProductPage.jsx';
import Sets from './store/Sets.jsx';
import Checkout from './store/Checkout.jsx';
import OrderPage from './store/OrderPage.jsx';
import Account from './store/Account.jsx';
import { About, Contact, ShippingReturns, Terms, Privacy, NotFound } from './store/InfoPages.jsx';
import AdminApp from './admin/AdminApp.jsx';

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <ShopProvider>
      <ScrollTop />
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route element={<StoreLayout />}>
          <Route index element={<Home />} />
          <Route path="psa-slabs" element={<Catalog type="slab" />} />
          <Route path="singles" element={<Catalog type="single" />} />
          <Route path="sealed" element={<Catalog type="sealed" />} />
          <Route path="extended-art-guards" element={<Catalog type="guard" />} />
          <Route path="new-arrivals" element={<Catalog mode="new" />} />
          <Route path="featured" element={<Catalog mode="featured" />} />
          <Route path="recently-sold" element={<Catalog mode="sold" />} />
          <Route path="shop" element={<Catalog />} />
          <Route path="search" element={<Catalog mode="search" />} />
          <Route path="wishlist" element={<Catalog mode="wishlist" />} />
          <Route path="sets" element={<Sets />} />
          <Route path="item/:unitId" element={<ProductPage />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="order/:orderId" element={<OrderPage />} />
          <Route path="account" element={<Account />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="shipping-returns" element={<ShippingReturns />} />
          <Route path="terms" element={<Terms />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="cart" element={<Navigate to="/checkout" replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </ShopProvider>
  );
}
