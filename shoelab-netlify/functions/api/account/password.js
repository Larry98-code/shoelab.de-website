import { json, preflight, currentUser, verifyPassword, hashPassword } from '../../_shared/util.js';

export async function onRequestOptions() { return preflight(); }

// Change password (requires current password). Requires login.
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: 'Database not configured' }, 500);

  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Not signed in' }, 401);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Invalid JSON' }, 400); }

  const current = typeof body.current === 'string' ? body.current : '';
  const next = typeof body.next === 'string' ? body.next : '';
  if (next.length < 8) return json({ error: 'New password must be at least 8 characters' }, 400);

  const row = await env.DB.prepare('SELECT pw_salt, pw_hash FROM users WHERE id=?').bind(user.id).first();
  if (!row || !(await verifyPassword(current, row.pw_salt, row.pw_hash))) {
    return json({ error: 'Current password is incorrect' }, 401);
  }

  const { salt, hash } = await hashPassword(next);
  await env.DB.prepare('UPDATE users SET pw_salt=?, pw_hash=? WHERE id=?').bind(salt, hash, user.id).run();

  return json({ ok: true }, 200);
}

export async function onRequest() { return json({ error: 'Method not allowed' }, 405); }
