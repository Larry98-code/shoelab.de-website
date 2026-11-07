// Push notifications for the ShoeLab app (iPhone and Android, through Expo).
//
// The app registers the phone's push token after the member allows
// notifications (POST /api/market/push/register). Every email a member gets
// about the Vault (tell() in vault.js) also goes to their phones: the email's
// subject is the title, its first sentence the text, and a tap opens the page
// the email links to. Tokens a phone no longer accepts are forgotten.
//
// Sent through Expo's push service (exp.host), which hands it to Apple and
// Google. EXPO_ACCESS_TOKEN, when set, signs the requests ("enhanced push
// security" in the Expo account).
import { renderMail } from './mail.js';

const ENDPOINT = 'https://exp.host/--/api/v2/push/send';
export const TOKEN_RE = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,}\]$/;

// "Hi Anna," is not news: the title is the subject, the text the first real sentence.
function preview(text) {
  const paras = String(text || '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  let body = paras.find((x, i) => !(i === 0 && x.length < 40 && /[,!]$/.test(x)) && !/^\s*>/.test(x)) || '';
  body = body.replace(/\s+/g, ' ');
  return body.length > 178 ? body.slice(0, 175).replace(/\s+\S*$/, '') + '…' : body;
}

export async function pushTo(env, user, key, params) {
  if (!user || !user.id || !env.DB) return 0;
  let rows;
  try {
    rows = (await env.DB.prepare('SELECT token FROM mk_push WHERE user_id = ?').bind(user.id).all()).results || [];
  } catch (e) { return 0; }
  if (!rows.length) return 0;
  let mail;
  try { mail = renderMail(user.lang, key, params || {}, { site: '' }); } catch (e) { return 0; }
  const url = params && typeof params.url === 'string' ? params.url : null;
  const messages = rows.map((r) => ({
    to: r.token, title: mail.subject.replace(/^\[[A-Z]+\]\s*/, ''), body: preview(mail.text), sound: 'default',
    data: url ? { url } : {}, channelId: 'default',
  }));
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 5000) : null;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST', signal: ctrl ? ctrl.signal : undefined,
      headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' },
        env.EXPO_ACCESS_TOKEN ? { Authorization: 'Bearer ' + env.EXPO_ACCESS_TOKEN } : {}),
      body: JSON.stringify(messages),
    });
    const out = await res.json().catch(() => null);
    const tickets = (out && out.data) || [];
    // a phone that uninstalled the app, or turned notifications off: forget it
    for (let i = 0; i < tickets.length; i++) {
      const tk = tickets[i];
      if (tk && tk.status === 'error' && tk.details && tk.details.error === 'DeviceNotRegistered' && messages[i]) {
        await env.DB.prepare('DELETE FROM mk_push WHERE token = ?').bind(messages[i].to).run();
      }
    }
    return messages.length;
  } catch (e) {
    try { console.error('push failed: ' + e); } catch (x) { /* no console */ }
    return 0;
  } finally { if (timer) clearTimeout(timer); }
}
