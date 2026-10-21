import { json, preflight, clean, validEmail, signSession, sessionSecret } from '../../_shared/util.js';
import { ensureCore, requestLang, pickLang, siteUrl } from '../../_shared/core.js';
import { sendMail } from '../../_shared/mail.js';

export async function onRequestOptions() { return preflight(); }

// Request a password reset link. Always returns ok (no account enumeration).
export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Invalid JSON' }, 400); }

  const email = clean(body.email, 254).toLowerCase();
  if (!validEmail(email)) return json({ error: 'A valid email is required' }, 400);

  if (env.DB) {
    await ensureCore(env);
    const user = await env.DB.prepare('SELECT id, name, lang FROM users WHERE email = ?').bind(email).first();
    if (user) {
      const token = await signSession(
        { uid: user.id, purpose: 'reset', exp: Date.now() + 1000 * 60 * 60 }, // 1 hour
        sessionSecret(env)
      );
      const link = siteUrl(env) + '/reset.html?token=' + encodeURIComponent(token);
      // in the language of the page the request came from
      await sendMail(env, {
        to: email, lang: requestLang(request) || pickLang(user.lang), key: 'passwordReset', keep: false,
        params: { name: String(user.name || '').split(' ')[0], url: link },
      });
    }
  }

  return json({ ok: true }, 200);
}

export async function onRequest() { return json({ error: 'Method not allowed' }, 405); }
