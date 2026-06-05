import {
  json, preflight, clean, validEmail, signSession, sessionSecret, sendEmail,
} from '../../_shared/util.js';

export async function onRequestOptions() { return preflight(); }

// Request a password reset link. Always returns ok (no account enumeration).
export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Invalid JSON' }, 400); }

  const email = clean(body.email, 254).toLowerCase();
  if (!validEmail(email)) return json({ error: 'A valid email is required' }, 400);

  if (env.DB) {
    const user = await env.DB.prepare('SELECT id, name FROM users WHERE email = ?').bind(email).first();
    if (user) {
      const token = await signSession(
        { uid: user.id, purpose: 'reset', exp: Date.now() + 1000 * 60 * 60 }, // 1 hour
        sessionSecret(env)
      );
      const origin = new URL(request.url).origin;
      const link = origin + '/reset.html?token=' + encodeURIComponent(token);
      await sendEmail(env, {
        to: email,
        subject: 'Reset your ShoeLab password',
        text:
          `Hi ${user.name || ''},\n\n` +
          `We received a request to reset your ShoeLab password. ` +
          `Click the link below within 1 hour to choose a new one:\n\n${link}\n\n` +
          `If you didn't request this, you can safely ignore this email.\n\n— ShoeLab, Bremen`,
      });
    }
  }

  return json({ ok: true }, 200);
}

export async function onRequest() { return json({ error: 'Method not allowed' }, 405); }
