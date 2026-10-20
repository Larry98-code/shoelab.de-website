import {
  json, verifyStripeSignature, sendEmail, notifyAddress, dropoffInstructions,
} from '../../_shared/util.js';
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
          await markPaid(env, id, 'stripe');
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
  const amount = obj.amount_total != null ? (obj.amount_total / 100).toFixed(2)
               : obj.amount_paid != null ? (obj.amount_paid / 100).toFixed(2)
               : obj.amount != null ? (obj.amount / 100).toFixed(2)
               : (row && row.amount) || '';
  const cur = (obj.currency || 'eur').toUpperCase();
  const money = amount ? amount + ' ' + cur : 'see Stripe';

  const ref = row && row.id ? 'SL-' + String(row.id).padStart(5, '0') : '(unmatched)';
  const name = row ? ((row.first_name || '') + ' ' + (row.last_name || '')).trim() : '';
  const when = row ? (row.date || '?') + ' at ' + (row.time_slot || '?') : 'see booking';
  const email = (row && row.email) || fallbackEmail || '';

  const studioText =
    '[PAID] ' + (name || email) + ' — ' + ref + '\n' +
    '======================================\n\n' +
    'PAID     ' + money + '\n' +
    'WHEN     ' + when + '\n' +
    'SERVICE  ' + ((row && (row.service || row.plan)) || '—') + '\n' +
    'TYPE     ' + ((row && row.type === 'subscription') ? 'Monthly subscription' : 'One-time') + '\n\n' +
    'CUSTOMER\n' +
    '  Name   ' + (name || '—') + '\n' +
    '  Email  ' + (email || '—') + '\n' +
    '  Phone  ' + ((row && row.phone) || '—') + '\n\n' +
    'NOTES\n  ' + ((row && row.notes) || '—') + '\n\n' +
    'Stripe event: ' + eventType + '\n' +
    (obj.id ? 'Stripe id:    ' + obj.id + '\n' : '') +
    '--\nThe appointment is confirmed. Reply to reach the customer.\n';

  await sendEmail(env, {
    to: notifyAddress(env),
    subject: '[PAID] ' + (name || email) + ' — ' + when + ' — ' + money,
    text: studioText,
    replyTo: email || undefined,
  });

  if (email) {
    await sendEmail(env, {
      to: email,
      subject: 'Payment confirmed — your ShoeLab appointment ' + ref,
      text:
        'Hi' + (row && row.first_name ? ' ' + row.first_name : '') + ',\n\n' +
        'Your payment went through and your appointment is confirmed.\n\n' +
        '  Reference  ' + ref + '\n' +
        '  When       ' + when + '\n' +
        '  Service    ' + ((row && (row.service || row.plan)) || '—') + '\n' +
        '  Paid       ' + money + '\n\n' +
        dropoffInstructions(env) + '\n' +
        'Most treatments are done within 48 hours.\n\n' +
        'Questions? Reply here or WhatsApp +49 177 2258878.\n\n' +
        'See you soon,\nShoeLab\n',
    });
  }
}

export async function onRequest() {
  return json({ received: true }, 200);
}
