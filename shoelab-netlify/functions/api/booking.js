import {
  json, preflight, clean, validEmail, currentUser, sendEmail, notifyAddress,
  dropoffInstructions,
} from '../_shared/util.js';

export async function onRequestOptions() {
  return preflight();
}

// Appointments arrive here whether or not the customer is paying online.
//   payMode 'online' -> they are being sent to Stripe next; status 'pending'
//                       until the webhook confirms the money landed.
//   payMode 'studio' -> they are paying on drop-off; status 'unpaid'.
// Either way the studio gets an email immediately, so a booking is never
// lost just because someone abandoned the card form.
export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Invalid JSON' }, 400); }

  const first = clean(body.firstName, 80);
  const last = clean(body.lastName, 80);
  const email = clean(body.email, 254).toLowerCase();
  const phone = clean(body.phone, 40);
  const type = clean(body.type, 20) || 'onetime';
  const service = clean(body.service, 80);
  const plan = clean(body.plan, 80);
  const amount = clean(body.amount, 20);
  const date = clean(body.date, 20);
  const time = clean(body.time, 40);
  const notes = clean(body.notes, 1000);
  const lang = clean(body.lang, 5) || 'en';

  const payMode = clean(body.payMode, 10) === 'studio' ? 'studio' : 'online';
  const status = payMode === 'studio' ? 'unpaid' : 'pending';

  if (!first || !validEmail(email)) {
    return json({ error: 'Name and a valid email are required' }, 400);
  }
  if (!date || !time) {
    return json({ error: 'Please choose a date and time slot' }, 400);
  }

  let bookingId = null;
  if (env.DB) {
    const user = await currentUser(request, env);
    const res = await env.DB.prepare(
      `INSERT INTO bookings
       (user_id, first_name, last_name, email, phone, type, service, plan, amount, date, time_slot, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      user ? user.id : null, first, last, email, phone, type, service, plan,
      amount, date, time, notes, status
    ).run();
    bookingId = res.meta.last_row_id;
  }

  const ref = bookingId ? 'SL-' + String(bookingId).padStart(5, '0') : '(no id)';
  const when = date + ' at ' + time;
  const money = amount ? '€' + amount : 'n/a';
  const payLine = payMode === 'studio'
    ? 'PAY AT THE STUDIO  — nothing has been charged yet'
    : 'ONLINE  — sent to Stripe; a second email confirms when it clears';

  // ── to the studio ───────────────────────────────────────────────────────
  const tag = payMode === 'studio' ? '[UNPAID]' : '[AWAITING PAYMENT]';
  const studioText =
    tag + ' New booking — ' + ref + '\n' +
    '======================================\n\n' +
    'WHEN     ' + when + '\n' +
    'SERVICE  ' + (service || plan || '—') + '\n' +
    'PLAN     ' + (type === 'subscription' ? 'Monthly subscription' : 'One-time') + '\n' +
    'AMOUNT   ' + money + '\n' +
    'PAYMENT  ' + payLine + '\n\n' +
    'CUSTOMER\n' +
    '  Name   ' + first + ' ' + last + '\n' +
    '  Email  ' + email + '\n' +
    '  Phone  ' + (phone || '—') + '\n' +
    '  Lang   ' + lang + '\n\n' +
    'NOTES\n  ' + (notes || '—') + '\n\n' +
    '--\nReply to this email to reach the customer directly.\n';

  await sendEmail(env, {
    to: notifyAddress(env),
    subject: tag + ' ' + first + ' ' + last + ' — ' + when + ' — ' + (service || plan || 'Booking'),
    text: studioText,
    replyTo: email,
  });

  // ── to the customer ─────────────────────────────────────────────────────
  const customerText = payMode === 'studio'
    ? 'Hi ' + first + ',\n\n' +
      'Your slot at ShoeLab is reserved.\n\n' +
      '  Reference  ' + ref + '\n' +
      '  When       ' + when + '\n' +
      '  Service    ' + (service || plan) + '\n' +
      '  To pay     ' + money + ' when you drop your shoes off\n\n' +
      dropoffInstructions(env) + '\n' +
      'Need to change anything? Just reply to this email or message us on ' +
      'WhatsApp at +49 177 2258878.\n\n' +
      'See you soon,\nShoeLab\n'
    : 'Hi ' + first + ',\n\n' +
      'Thanks for booking with ShoeLab. We have your request:\n\n' +
      '  Reference  ' + ref + '\n' +
      '  When       ' + when + '\n' +
      '  Service    ' + (service || plan) + '\n' +
      '  Amount     ' + money + '\n\n' +
      'You will get a separate confirmation once your payment clears. If you ' +
      'closed the payment page before finishing, reply to this email and we ' +
      'will hold the slot for you anyway.\n\n' +
      'ShoeLab · Wallerheerstraße, 28217 Bremen · +49 177 2258878\n';

  await sendEmail(env, {
    to: email,
    subject: payMode === 'studio'
      ? 'Your ShoeLab booking is reserved — ' + ref
      : 'Your ShoeLab booking request — ' + ref,
    text: customerText,
  });

  return json({ ok: true, id: bookingId, ref: ref, status: status }, 200);
}

export async function onRequest() {
  return json({ error: 'Method not allowed' }, 405);
}
