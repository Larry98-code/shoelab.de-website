// Email confirmation: a one-time link sent on sign-up (and on request), so
// only real, reachable addresses can bid, buy and sell in the Vault.
import { ensureCore, siteUrl } from './core.js';
import { sendMail } from './mail.js';

const TTL = 7 * 24 * 3600 * 1000;

// only paths on this site, so a link can never send anyone elsewhere
export function safeNext(v) {
  const s = String(v || '');
  return /^\/[A-Za-z0-9\-._~/?=&%#]*$/.test(s) && s.indexOf('//') === -1 ? s.slice(0, 200) : '/vault-me.html';
}

export async function sendVerification(env, user, lang, next) {
  await ensureCore(env);
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
  const now = new Date();
  await env.DB.prepare('INSERT INTO email_tokens (token, user_id, kind, next, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(token, user.id, 'verify', safeNext(next), new Date(now.getTime() + TTL).toISOString(), now.toISOString()).run();
  await sendMail(env, {
    to: user.email, lang, key: 'verifyEmail', keep: false,
    params: { name: String(user.name || '').trim().split(/\s+/)[0] || '', url: siteUrl(env) + '/api/account/verify?t=' + token },
  });
}
