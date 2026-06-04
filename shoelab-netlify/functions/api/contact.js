import {
  json, preflight, clean, validEmail, sendEmail, notifyAddress,
} from '../_shared/util.js';

export async function onRequestOptions() {
  return preflight();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Invalid JSON' }, 400); }

  // Honeypot — bots fill hidden fields; silently accept and drop.
  if (clean(body.company, 100)) return json({ ok: true }, 200);

  const name = clean(body.name, 80);
  const email = clean(body.email, 254).toLowerCase();
  const phone = clean(body.phone, 40);
  const message = clean(body.message, 2000);

  if (!name || !validEmail(email) || !message) {
    return json({ error: 'Name, a valid email and a message are required' }, 400);
  }

  if (env.DB) {
    await env.DB.prepare(
      'INSERT INTO messages (name, email, phone, body) VALUES (?, ?, ?, ?)'
    ).bind(name, email, phone, message).run();
  }

  await sendEmail(env, {
    to: notifyAddress(env),
    subject: `Contact form — ${name}`,
    text: `From: ${name} <${email}>\nPhone: ${phone}\n\n${message}`,
    replyTo: email,
  });

  return json({ ok: true }, 200);
}

export async function onRequest() {
  return json({ error: 'Method not allowed' }, 405);
}
