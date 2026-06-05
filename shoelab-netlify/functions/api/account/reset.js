import {
  json, preflight, verifySession, sessionSecret, hashPassword,
} from '../../_shared/util.js';

export async function onRequestOptions() { return preflight(); }

// Complete a password reset using the emailed token.
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: 'Database not configured' }, 500);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Invalid JSON' }, 400); }

  const token = typeof body.token === 'string' ? body.token : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);

  const payload = await verifySession(token, sessionSecret(env));
  if (!payload || payload.purpose !== 'reset' || !payload.uid) {
    return json({ error: 'This reset link is invalid or has expired. Please request a new one.' }, 400);
  }

  const { salt, hash } = await hashPassword(password);
  await env.DB.prepare('UPDATE users SET pw_salt=?, pw_hash=? WHERE id=?')
    .bind(salt, hash, payload.uid).run();

  return json({ ok: true }, 200);
}

export async function onRequest() { return json({ error: 'Method not allowed' }, 405); }
