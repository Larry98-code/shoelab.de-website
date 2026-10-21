import { json, verifyStripeSignature } from '../../_shared/util.js';
import { sendMail, sendStudio } from '../../_shared/mail.js';
import { ensureSchema, markPaid } from '../../_shared/vault.js';

// Stripe sends events here. Configure the endpoint URL + signing secret in the
// Stripe dashboard (Developers -> Webhooks), and set STRIPE_WEBHOOK_SECRET.
//
// This is what turns a 'pending' booking into a 'paid' one, and it is the
// only place that can tell the studio the money actually landed — the
// customer's browser may never come back from Stripe.
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

  const PAID_EVENTS = ['checkout.session.completed', 'payment_intent.succeeded', 'invoice.paid'];

  try {
    const obj = (event.data && event.data.object) || {};
    const email = (obj.customer_email ||
                   (obj.customer_details && obj.customer_details.email) || '').toLowerCase();
    const customerId = obj.customer || null;

    // Vault orders are matched by their own id and handled entirely here.
    // Returning early matters: the booking fallback below would otherwise mark
    // this customer's latest unpaid booking as paid too.
    const vaultRef = (obj.metadata && obj.metadata.vault_order) ||
      (/^vault_(\d+)$/.exec(String(obj.client_reference_id || '')) || [])[1];
    if (vaultRef) {
      // Sellers get told to ship on this, so only a signed event from Stripe
      // for the full amount of that very order counts. Without the signing
      // secret anyone could post a fake event, so then nothing is marked.
      if (env.DB && env.STRIPE_WEBHOOK_SECRET && PAID_EVENTS.indexOf(event.type) !== -1) {
        await ensureSchema(env);
        const id = parseInt(vaultRef, 10);
        const order = await env.DB.prepare('SELECT total FROM mk_orders WHERE id = ?').bind(id).first();
        const amount = obj.amount_total != null ? obj.amount_total
          : obj.amount_received != null ? obj.amount_received : obj.amount_paid;
        const settled = event.type !== 'checkout.session.completed' || !obj.payment_status || obj.payment_status === 'paid';
        if (order && amount === order.total && String(obj.currency || '').toLowerCase() === 'eur' && settled) {
          // the payment intent is what the seller's payout and any refund hang on
          const pi = event.type === 'payment_intent.succeeded' ? obj.id : (typeof obj.payment_intent === 'string' ? obj.payment_intent : null);
          const fresh = await markPaid(env, id, 'stripe', pi);
          // a later event may carry the payment intent the first one lacked
          if (!fresh && pi) await env.DB.prepare('UPDATE mk_orders SET stripe_pi = ? WHERE id = ? AND stripe_pi IS NULL').bind(pi, id).run();
        }
      }
      return json({ received: true }, 200);
    }

    // checkout.html sends clientReferenceId as 'booking_<row id>', which beats
    // guessing by email when somebody books twice in a day.
    let bookingId = null;
    const ref = obj.client_reference_id || '';
    const m = /^booking_(\d+)$/.exec(String(ref));
    if (m) bookingId = parseInt(m[1], 10);

    if (env.DB && customerId && email) {
      try {
        await env.DB.prepare('UPDATE users SET stripe_customer_id=? WHERE email=?')
          .bind(customerId, email).run();
      } catch (e) { /* column may not be migrated yet */ }
    }

    if (env.DB && PAID_EVENTS.indexOf(event.type) !== -1) {
      let res;
      if (bookingId) {
        res = await env.DB.prepare(
          "UPDATE bookings SET status='paid' WHERE id=? AND status!='paid'"
        ).bind(bookingId).run();
      } else if (email) {
        res = await env.DB.prepare(
          "UPDATE bookings SET status='paid' " +
          "WHERE id = (SELECT id FROM bookings WHERE email=? AND status!='paid' ORDER BY id DESC LIMIT 1)"
        ).bind(email).run();
      }

      // Stripe retries, and one purchase can fire several of these events.
      // Only the update that actually flipped a row sends mail.
      const changed = res && res.meta && res.meta.changes > 0;
      if (changed) {
        let row = null;
        try {
          row = bookingId
            ? await env.DB.prepare('SELECT * FROM bookings WHERE id=?').bind(bookingId).first()
            : await env.DB.prepare(
                'SELECT * FROM bookings WHERE email=? ORDER BY id DESC LIMIT 1'
              ).bind(email).first();
        } catch (e) { /* reporting only */ }

        await notifyPaid(env, row, obj, event.type, email);
      }
    }
  } catch (e) {
    // never fail the webhook hard — Stripe retries on non-2xx
  }

  return json({ received: true }, 200);
}

async function notifyPaid(env, row, obj, eventType, fallbackEmail) {
  const cents = obj.amount_total != null ? obj.amount_total : obj.amount_paid != null ? obj.amount_paid
    : obj.amount != null ? obj.amount : row && row.amount ? Math.round(parseFloat(row.amount) * 100) : null;
  const money = cents != null && Number.isFinite(cents) ? { m: cents } : 'see Stripe';
  const ref = row && row.id ? 'SL-' + String(row.id).padStart(5, '0') : '(unmatched)';
  const name = row ? ((row.first_name || '') + ' ' + (row.last_name || '')).trim() : '';
  const email = (row && row.email) || fallbackEmail || '';
  const service = (row && (row.service || row.plan)) || '—';
  const base = { ref, date: { d: (row && row.date) || '' }, time: (row && row.time_slot) || '?', when: { k: 'whenAt' }, service, amount: money };

  await sendStudio(env, 'sBookingPaid', Object.assign({}, base, {
    customer: name || email, message: (row && row.notes) || '',
    rows: [['paid', money], ['when', { k: 'whenAt' }], ['service', service],
      ['plan', { k: row && row.type === 'subscription' ? 'monthly' : 'oneTime' }],
      ['name', name || '—'], ['email', email || '—'], ['phone', (row && row.phone) || '—'], ['ref', ref]],
  }), email || undefined, false);

  if (email) {
    await sendMail(env, {
      to: email, lang: (row && row.lang) || 'en', key: 'bookingPaid',
      params: Object.assign({}, base, {
        name: (row && row.first_name) || '', dropoff: String(env.DROPOFF_ADDRESS || '').trim(),
        rows: [['ref', ref], ['when', { k: 'whenAt' }], ['service', service], ['paid', money]],
      }),
    });
  }
}

export async function onRequest() {
  return json({ received: true }, 200);
}
