import {
  json, preflight, clean, validEmail, currentUser, sendEmail, notifyAddress,
} from '../_shared/util.js';

export async function onRequestOptions() {
  return preflight();
}

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
       (user_id, first_name, last_name, email, phone, type, service, plan, amount, date, time_slot, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      user ? user.id : null, first, last, email, phone, type, service, plan, amount, date, time, notes
    ).run();
    bookingId = res.meta.last_row_id;
  }

  const summary =
    `New booking request\n\n` +
    `Name:    ${first} ${last}\n` +
    `Email:   ${email}\n` +
    `Phone:   ${phone}\n` +
    `Type:    ${type}${plan ? ' (' + plan + ')' : ''}\n` +
    `Service: ${service}\n` +
    `Amount:  ${amount}\n` +
    `Date:    ${date} ${time}\n` +
    `Notes:   ${notes}\n`;

  // Notify the studio, and confirm to the customer (best-effort).
  await sendEmail(env, {
    to: notifyAddress(env),
    subject: `New booking — ${first} ${last} (${date} ${time})`,
    text: summary,
    replyTo: email,
  });
  await sendEmail(env, {
    to: email,
    subject: 'Your ShoeLab booking request',
    text:
      `Hi ${first},\n\nThanks for booking with ShoeLab! We've received your request ` +
      `for ${date} at ${time}. We'll confirm your slot shortly.\n\n` +
      `Service: ${service || plan}\nAmount: ${amount}\n\n` +
      `ShoeLab · Wallerheerstr, 28217 Bremen · +49 177 2258878`,
  });

  return json({ ok: true, id: bookingId }, 200);
}

export async function onRequest() {
  return json({ error: 'Method not allowed' }, 405);
}
