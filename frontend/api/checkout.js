// Vercel serverless function: create a Stripe Checkout Session in AUD.
// Env: STRIPE_SECRET_KEY. Install: npm i stripe
// IMPORTANT: in production, prices must be re-read from the database here (never trust
// prices sent by the browser), and the order marked paid from a Stripe webhook
// (checkout.session.completed) that calls the same "record sale" logic as the POS.
import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!process.env.STRIPE_SECRET_KEY) return res.status(501).json({ error: 'Stripe is not configured' });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const { orderId, number, email, items, shipping, discount, creditApplied, successUrl, cancelUrl } = req.body || {};
  if (!orderId || !Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Invalid order' });
  try {
    const coupon = discount + creditApplied > 0 ? await stripe.coupons.create({ amount_off: Math.round((discount + creditApplied) * 100), currency: 'aud', duration: 'once', name: 'Discount / store credit' }) : null;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'aud',
      customer_email: email,
      client_reference_id: orderId,
      metadata: { orderId, number },
      line_items: items.map((i) => ({ quantity: i.qty, price_data: { currency: 'aud', unit_amount: Math.round(i.price * 100), product_data: { name: i.name, metadata: { sku: i.sku } } } })),
      shipping_options: [{ shipping_rate_data: { display_name: 'Shipping', type: 'fixed_amount', fixed_amount: { amount: Math.round((shipping || 0) * 100), currency: 'aud' } } }],
      discounts: coupon ? [{ coupon: coupon.id }] : undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
