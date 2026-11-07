// POST /api/account/delete { password } — a member deletes their own account.
// The app stores must offer this inside the app (Apple 5.1.1(v)), and GDPR
// gives everyone the right to it. The same steps as a deletion from the lab
// console (eraseAccount): personal data erased, listings and photos deleted,
// orders kept without personal details for the tax-law period. Open orders
// have to be finished first.
import { json, preflight, currentUser, verifyPassword, setCookie } from '../../_shared/util.js';
import { ensureSchema } from '../../_shared/vault.js';
import { eraseAccount } from '../../_shared/admin.js';

export async function onRequestOptions() {
  return preflight();
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'Database not configured' }, 500);
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Invalid JSON' }, 400); }
  const me = await currentUser(request, env);
  if (!me) return json({ error: 'Please sign in first', code: 'signin' }, 401);
  await ensureSchema(env);
  const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(me.id).first();
  if (!u || !(await verifyPassword(String(body.password || ''), u.pw_salt, u.pw_hash))) {
    return json({ error: 'That password is not right', code: 'bad_password' }, 403);
  }
  try {
    await eraseAccount(env, u, { reason: 'request', block: false, actor: null });
  } catch (e) {
    if (e && e.http) return json(Object.assign({ error: e.message }, e.code ? { code: e.code } : null, e.extra), e.status);
    throw e;
  }
  return json({ ok: true }, 200, { 'Set-Cookie': setCookie('shoelab_session', '', 0) });
}

export async function onRequest() {
  return json({ error: 'Method not allowed' }, 405);
}
