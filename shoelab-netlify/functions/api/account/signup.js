import {
  json, preflight, clean, validEmail, hashPassword,
  signSession, sessionSecret, setCookie,
} from '../../_shared/util.js';
import { ensureCore, requestLang } from '../../_shared/core.js';
import { sendVerification } from '../../_shared/verify.js';

export async function onRequestOptions() {
  return preflight();
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: 'Database not configured' }, 500);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Invalid JSON' }, 400); }

  const name = clean(body.name, 80);
  const email = clean(body.email, 254).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (!name) return json({ error: 'Name is required' }, 400);
  if (!validEmail(email)) return json({ error: 'A valid email is required' }, 400);
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);

  await ensureCore(env);
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return json({ error: 'An account with this email already exists' }, 409);

  const { salt, hash } = await hashPassword(password);
  const lang = requestLang(request);
  const res = await env.DB.prepare(
    'INSERT INTO users (name, email, pw_salt, pw_hash, lang) VALUES (?, ?, ?, ?, ?)'
  ).bind(name, email, salt, hash, lang).run();

  const uid = res.meta.last_row_id;
  // the confirmation link brings them back to where they signed up
  await sendVerification(env, { id: uid, name, email }, lang, body.next);
  const token = await signSession(
    { uid, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 },
    sessionSecret(env)
  );

  return json(
    { user: { id: uid, name, email, verified: false } },
    200,
    { 'Set-Cookie': setCookie('shoelab_session', token) }
  );
}

export async function onRequest() {
  return json({ error: 'Method not allowed' }, 405);
}
