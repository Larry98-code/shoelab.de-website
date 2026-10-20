// GET /api/account/verify?t=<token> — the link in the confirmation email.
import { ensureCore } from '../../_shared/core.js';
import { safeNext } from '../../_shared/verify.js';

function go(url) { return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store' } }); }
function withFlag(path, flag) {
  const [p, hash] = path.split('#');
  return p + (p.indexOf('?') === -1 ? '?' : '&') + 'verified=' + flag + (hash ? '#' + hash : '');
}

export async function onRequestGet({ request, env }) {
  const t = String(new URL(request.url).searchParams.get('t') || '');
  if (!env.DB || !/^[0-9a-f]{48}$/.test(t)) return go('/vault-me.html?verified=0');
  await ensureCore(env);
  const row = await env.DB.prepare("SELECT * FROM email_tokens WHERE token = ? AND kind = 'verify'").bind(t).first();
  if (!row || row.expires_at < new Date().toISOString()) return go(withFlag(row ? safeNext(row.next) : '/vault-me.html', '0'));
  await env.DB.prepare('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?')
    .bind(new Date().toISOString(), row.user_id).run();
  await env.DB.prepare("DELETE FROM email_tokens WHERE user_id = ? AND kind = 'verify'").bind(row.user_id).run();
  return go(withFlag(safeNext(row.next), '1'));
}
