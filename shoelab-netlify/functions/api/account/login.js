import {
  json, preflight, clean, validEmail, verifyPassword,
  signSession, sessionSecret, setCookie,
} from '../../_shared/util.js';

export async function onRequestOptions() {
  return preflight();
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: 'Database not configured' }, 500);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Invalid JSON' }, 400); }

  const email = clean(body.email, 254).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  if (!validEmail(email) || !password) return json({ error: 'Email and password are required' }, 400);

  const user = await env.DB.prepare(
    'SELECT id, name, email, pw_salt, pw_hash FROM users WHERE email = ?'
  ).bind(email).first();

  // Same response whether or not the account exists, to avoid user enumeration.
  if (!user || !(await verifyPassword(password, user.pw_salt, user.pw_hash))) {
    return json({ error: 'Incorrect email or password' }, 401);
  }

  const token = await signSession(
    { uid: user.id, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 },
    sessionSecret(env)
  );

  return json(
    { user: { id: user.id, name: user.name, email: user.email } },
    200,
    { 'Set-Cookie': setCookie('shoelab_session', token) }
  );
}

export async function onRequest() {
  return json({ error: 'Method not allowed' }, 405);
}
