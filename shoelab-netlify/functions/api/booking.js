import { json, preflight, clean, validEmail, currentUser } from '../_shared/util.js';
import { pickLang, requestLang, ensureCore } from '../_shared/core.js';
import { sendMail, sendStudio, LANG_NAMES } from '../_shared/mail.js';

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
  // the language the booking page was in, else the browser's own setting
  const lang = pickLang(body.lang) || requestLang(request);

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
    await ensureCore(env);
    const user = await currentUser(request, env);
    const res = await env.DB.prepare(
      `INSERT INTO bookings
       (user_id, first_name, last_name, email, phone, type, service, plan, amount, date, time_slot, notes, status, lang)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      user ? user.id : null, first, last, email, phone, type, service, plan,
      amount, date, time, notes, status, lang
    ).run();
    bookingId = res.meta.last_row_id;
  }

  const ref = bookingId ? 'SL-' + String(bookingId).padStart(5, '0') : '(no id)';
  const cents = Math.round(parseFloat(amount) * 100);
  const money = Number.isFinite(cents) && cents > 0 ? { m: cents } : 'n/a';
  const base = { ref, date: { d: date }, time, when: { k: 'whenAt' }, service: service || plan || '—' };

  // ── to the studio, in the studio's language ─────────────────────────────
  await sendStudio(env, 'sBookingNew', Object.assign({}, base, {
    tag: payMode === 'studio' ? '[UNPAID]' : '[AWAITING PAYMENT]', customer: first + ' ' + last, message: notes,
    rows: [['when', { k: 'whenAt' }], ['service', service || plan || '—'], ['plan', { k: type === 'subscription' ? 'monthly' : 'oneTime' }],
      ['amount', money], ['payment', { k: payMode === 'studio' ? 'atStudio' : 'online' }],
      ['name', first + ' ' + last], ['email', email], ['phone', phone || '—'], ['language', LANG_NAMES[lang] || lang]],
  }), email, false);

  // ── to the customer, in theirs ──────────────────────────────────────────
  await sendMail(env, {
    to: email, lang, key: payMode === 'studio' ? 'bookingReserved' : 'bookingRequested',
    params: Object.assign({}, base, {
      name: first, dropoff: String(env.DROPOFF_ADDRESS || '').trim(),
      rows: [['ref', ref], ['when', { k: 'whenAt' }], ['service', service || plan || '—'], [payMode === 'studio' ? 'toPay' : 'amount', money]],
    }),
  });

  return json({ ok: true, id: bookingId, ref: ref, status: status }, 200);
}

export async function onRequest() {
  return json({ error: 'Method not allowed' }, 405);
}
