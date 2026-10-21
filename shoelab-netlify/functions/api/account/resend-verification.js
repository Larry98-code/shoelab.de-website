// POST /api/account/resend-verification — another confirmation link, at most
// one a minute.
import { json, preflight, currentUser } from '../../_shared/util.js';
import { sendVerification } from '../../_shared/verify.js';

export async function onRequestOptions() { return preflight(); }

export async function onRequestPost({ request, env }) {
  const me = await currentUser(request, env);
  if (!me) return json({ error: 'Please sign in first', code: 'signin' }, 401);
  if (me.verified) return json({ ok: true, already: true });
  const last = await env.DB.prepare("SELECT created_at FROM email_tokens WHERE user_id = ? AND kind = 'verify' ORDER BY created_at DESC LIMIT 1")
    .bind(me.id).first();
  if (last && Date.now() - new Date(last.created_at).getTime() < 60000) {
    return json({ error: 'A link is already on its way — wait a minute', code: 'verify_wait' }, 429);
  }
  let next = '/vault-me.html';
  try { next = (await request.json()).next || next; } catch (e) { /* no body */ }
  await sendVerification(env, me, me.lang, next);
  return json({ ok: true });
}

export async function onRequest() { return json({ error: 'Method not allowed' }, 405); }
