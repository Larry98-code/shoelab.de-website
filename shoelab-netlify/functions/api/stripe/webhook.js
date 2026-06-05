import { json, verifyStripeSignature } from '../../_shared/util.js';

// Stripe sends events here. Configure the endpoint URL + signing secret in the
// Stripe dashboard (Developers → Webhooks), and set STRIPE_WEBHOOK_SECRET.
export async function onRequestPost(context) {
  const { request, env } = context;

  const raw = await request.text();
  const sig = request.headers.get('Stripe-Signature');

  if (env.STRIPE_WEBHOOK_SECRET) {
    const ok = await verifyStripeSignature(raw, sig, env.STRIPE_WEBHOOK_SECRET);
    if (!ok) return json({ error: 'Invalid signature' }, 400);
  }

  let event;
  try { event = JSON.parse(raw); } catch (e) { return json({ error: 'Invalid payload' }, 400); }

  try {
    const obj = event.data && event.data.object ? event.data.object : {};
    const email = (obj.customer_email || (obj.customer_details && obj.customer_details.email) || '').toLowerCase();
    const customerId = obj.customer || null;

    if (env.DB && email) {
      // link the Stripe customer to the account
      if (customerId) {
        try {
          await env.DB.prepare('UPDATE users SET stripe_customer_id=? WHERE email=?')
            .bind(customerId, email).run();
        } catch (e) { /* column may not be migrated yet */ }
      }
      // mark the most recent pending booking for this email as paid
      if (event.type === 'checkout.session.completed' ||
          event.type === 'payment_intent.succeeded' ||
          event.type === 'invoice.paid') {
        await env.DB.prepare(
          `UPDATE bookings SET status='paid'
           WHERE id = (SELECT id FROM bookings WHERE email=? AND status!='paid' ORDER BY id DESC LIMIT 1)`
        ).bind(email).run();
      }
    }
  } catch (e) {
    // never fail the webhook hard — Stripe retries on non-2xx
  }

  return json({ received: true }, 200);
}

export async function onRequest() {
  return json({ received: true }, 200);
}
