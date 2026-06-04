import {
  json, preflight, clean, currentUser, sendEmail, notifyAddress,
} from '../_shared/util.js';

export async function onRequestOptions() {
  return preflight();
}

// Public: list approved reviews (newest first).
export async function onRequestGet(context) {
  const { env } = context;
  if (!env.DB) return json({ reviews: [] }, 200);
  const rows = await env.DB.prepare(
    'SELECT name, rating, body, created_at FROM reviews WHERE approved = 1 ORDER BY id DESC LIMIT 50'
  ).all();
  return json({ reviews: (rows && rows.results) || [] }, 200);
}

// Submit a review (held for moderation: approved = 0).
export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Invalid JSON' }, 400); }

  const user = await currentUser(request, env);
  const name = clean(body.name, 80) || (user ? user.name : '');
  const text = clean(body.body, 2000);
  let rating = parseInt(body.rating, 10);
  if (!(rating >= 1 && rating <= 5)) rating = 5;

  if (!name || !text) return json({ error: 'Name and review text are required' }, 400);

  if (env.DB) {
    await env.DB.prepare(
      'INSERT INTO reviews (name, rating, body, approved) VALUES (?, ?, ?, 0)'
    ).bind(name, rating, text).run();
  }

  await sendEmail(env, {
    to: notifyAddress(env),
    subject: `New review pending approval — ${name} (${rating}★)`,
    text: `${name} left a ${rating}-star review:\n\n${text}`,
  });

  return json({ ok: true, pending: true }, 200);
}

export async function onRequest() {
  return json({ error: 'Method not allowed' }, 405);
}
