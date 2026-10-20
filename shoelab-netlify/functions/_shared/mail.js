// Every email the site sends, in the recipient's language.
//
// Templates live in mail-i18n/<lang>.js (English is the reference; anything a
// language leaves out falls back to English). An email is sent as branded
// HTML with a plain-text twin, and kept in mail_log with its parameters, so
// its footer can offer the same email in the other seven languages: each link
// renders it again on /api/mail in the language chosen.
import { LANGS, pickLang, ensureCore, siteUrl } from './core.js';
import { sendEmail, notifyAddress } from './util.js';
import en from './mail-i18n/en.js';
import de from './mail-i18n/de.js';
import pl from './mail-i18n/pl.js';
import ru from './mail-i18n/ru.js';
import uk from './mail-i18n/uk.js';
import it from './mail-i18n/it.js';
import es from './mail-i18n/es.js';
import fr from './mail-i18n/fr.js';

const DICTS = { en, de, pl, ru, uk, it, es, fr };
const LOCALE = { en: 'en-IE', de: 'de-DE', pl: 'pl-PL', ru: 'ru-RU', uk: 'uk-UA', it: 'it-IT', es: 'es-ES', fr: 'fr-FR' };
export const LANG_NAMES = { en: 'English', de: 'Deutsch', pl: 'Polski', ru: 'Русский', uk: 'Українська', it: 'Italiano', es: 'Español', fr: 'Français' };
// emails holding a one-time secret are never stored or re-rendered
const PRIVATE = { verifyEmail: 1, passwordReset: 1 };

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function money(cents, lang) {
  try { return new Intl.NumberFormat(LOCALE[lang], { style: 'currency', currency: 'EUR' }).format(cents / 100); }
  catch (e) { return '€' + (cents / 100).toFixed(2); }
}
function day(iso, lang) {
  try { return new Intl.DateTimeFormat(LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso)); }
  catch (e) { return String(iso).slice(0, 10); }
}

function shared(lang) { return Object.assign({}, en._, (DICTS[lang] || {})._); }
function template(lang, key) {
  const E = en[key];
  if (!E) throw new Error('Unknown email template ' + key);
  const L = (DICTS[lang] || {})[key] || {};
  return { s: L.s || E.s, b: L.b || E.b, c: L.c || E.c };
}

// A parameter is a plain string, cents ({m}), a date ({d}) or a shared
// sentence ({k}) that may itself use the email's parameters.
function value(v, lang, words, params, depth) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.m != null) return money(v.m, lang);
    if (v.d) return day(v.d, lang);
    if (v.k) return fill(words[v.k] != null ? words[v.k] : v.k, lang, words, params, depth + 1);
  }
  return String(v);
}
function fill(str, lang, words, params, depth) {
  if (depth > 3) return str;
  return String(str).replace(/\{(\w+)\}/g, (m, k) => {
    if (params[k] !== undefined) return value(params[k], lang, words, params, depth);
    if (words[k] !== undefined) return fill(words[k], lang, words, params, depth + 1);
    return m;
  });
}

// → { subject, text, html }
export function renderMail(lang, key, params, opts) {
  lang = pickLang(lang) || 'en';
  params = params || {};
  opts = opts || {};
  const words = shared(lang), tpl = template(lang, key);
  const f = (s) => fill(s, lang, words, params, 0);
  const site = opts.site || 'https://shoelabonline.de';
  const abs = (u) => !u ? '' : /^https?:/.test(u) ? u : site + (u.charAt(0) === '/' ? '' : '/') + u;
  const text = [], html = [];
  const para = (t) => {
    if (!t) return;
    text.push(t);
    html.push('<p style="margin:0 0 16px;">' + esc(t).replace(/\n/g, '<br>') + '</p>');
  };
  const quote = (t) => {
    if (!t) return;
    text.push(String(t).split('\n').map((l) => '  > ' + l).join('\n'));
    html.push('<div style="margin:0 0 16px;padding:12px 14px;border-left:3px solid #d4af37;background:#fafaf7;border-radius:8px;color:#3f3f46;">' +
      esc(t).replace(/\n/g, '<br>') + '</div>');
  };
  for (const item of tpl.b) {
    if (item === '%rows') {
      const rows = (params.rows || []).filter((r) => r && r[1] != null && r[1] !== '');
      if (!rows.length) continue;
      const pairs = rows.map(([label, v]) => [words[label] != null ? f(words[label]) : label, value(v, lang, words, params, 0)]);
      const w = Math.max.apply(null, pairs.map((p) => p[0].length)) + 2;
      text.push(pairs.map(([a, b]) => '  ' + (a + ':').padEnd(w) + b).join('\n'));
      html.push('<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;border-collapse:collapse;font-size:14px;">' +
        pairs.map(([a, b], i) => '<tr><td style="padding:8px 0;color:#71717a;border-bottom:1px solid #f0f0f0;">' + esc(a) +
          '</td><td style="padding:8px 0;text-align:right;color:#18181b;border-bottom:1px solid #f0f0f0;' +
          (i === pairs.length - 1 && (rows[i][0] === 'total' || rows[i][0] === 'payout') ? 'font-weight:700;' : '') + '">' + esc(b) + '</td></tr>').join('') +
        '</table>');
    } else if (item === '%message') {
      quote(value(params.message, lang, words, params, 0));
    } else if (item === '%address') {
      // an address, or a shared sentence ({k}) when there is none yet
      if (params.address) quote(value(params.address, lang, words, params, 0));
    } else if (item === '%transcript') {
      const tr = params.transcript || [];
      if (tr.length) quote(tr.map((m) => (m.role === 'user' ? '» ' : 'Wesley: ') + m.text).join('\n\n'));
    } else if (item === '%dropoff') {
      if (params.dropoff) { para(words.dropoffTitle); quote(params.dropoff); }
      else para(words.dropoffLater);
    } else {
      para(f(item));
    }
  }
  const subject = f(tpl.s);
  const url = abs(params.url);
  let button = '';
  if (tpl.c && url) {
    const label = f(tpl.c);
    text.push(label + ': ' + url);
    button = '<p style="margin:6px 0 22px;"><a href="' + esc(url) + '" style="display:inline-block;background:#CC1111;color:#ffffff;' +
      'text-decoration:none;font-weight:700;letter-spacing:.04em;padding:13px 22px;border-radius:10px;">' + esc(label) + '</a></p>';
  }
  const links = opts.links || [];
  const footerLine = opts.vault ? words.footerVault : words.footer;
  text.push('--');
  if (links.length) text.push(words.readIn + '\n' + links.map((x) => LANG_NAMES[x.l] + ': ' + x.url).join('\n'));
  text.push(footerLine + '\n' + site);

  const brand = '<span style="font-family:Impact,\'Arial Black\',sans-serif;font-size:22px;letter-spacing:.08em;color:#ffffff;">SHOE<span style="color:#CC1111;">LAB</span>' +
    (opts.vault ? ' <span style="color:#d4af37;">VAULT</span>' : '') + '</span>';
  const langBar = links.length
    ? '<p style="margin:0 0 6px;color:#71717a;">' + esc(words.readIn) + '</p><p style="margin:0 0 14px;">' +
      links.map((x) => '<a href="' + esc(x.url) + '" style="color:#a16207;text-decoration:none;white-space:nowrap;">' + esc(LANG_NAMES[x.l]) + '</a>').join(' &nbsp;·&nbsp; ') + '</p>'
    : '';
  const doc = '<!doctype html><html lang="' + lang + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(subject) + '</title></head><body style="margin:0;padding:0;background:#f4f4f5;">' +
    (opts.top || '') +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;"><tr><td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">' +
    '<tr><td style="background:#080808;padding:20px 28px;">' + brand + '</td></tr>' +
    '<tr><td style="padding:28px 28px 8px;color:#18181b;font-size:15px;line-height:1.6;">' + html.join('') + button + '</td></tr>' +
    '<tr><td style="padding:18px 28px 22px;background:#fafafa;border-top:1px solid #f0f0f0;color:#71717a;font-size:12px;line-height:1.6;">' +
      langBar + esc(footerLine) + '<br><a href="' + esc(site) + '" style="color:#71717a;">' + esc(site.replace(/^https?:\/\//, '')) + '</a>' +
      ' &nbsp;·&nbsp; <a href="' + esc(site) + '/impressum.html" style="color:#71717a;">Impressum</a>' +
      ' &nbsp;·&nbsp; <a href="' + esc(site) + '/datenschutz.html" style="color:#71717a;">Datenschutz</a></td></tr>' +
    '</table></td></tr></table></body></html>';
  return { subject, text: text.join('\n\n'), html: doc };
}

function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Sends one email. `lang` is the recipient's language; keep=false for emails
// that must not be stored (one-time links).
export async function sendMail(env, { to, lang, key, params, replyTo, vault, keep }) {
  if (!to) return { skipped: 'no recipient' };
  lang = pickLang(lang) || 'en';
  params = params || {};
  const site = siteUrl(env);
  let links = [];
  if (keep !== false && !PRIVATE[key] && env.DB) {
    try {
      await ensureCore(env);
      const token = randomToken();
      const r = await env.DB.prepare(
        'INSERT INTO mail_log (token, recipient, template, params, lang, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(token, String(to).toLowerCase(), key, JSON.stringify({ p: params, v: vault ? 1 : 0 }), lang, new Date().toISOString()).run();
      const id = r.meta.last_row_id;
      links = LANGS.filter((l) => l !== lang).map((l) => ({ l, url: site + '/api/mail?m=' + id + '&k=' + token + '&lang=' + l }));
    } catch (e) { links = []; }
  }
  const out = renderMail(lang, key, params, { site, vault, links });
  return sendEmail(env, { to, subject: out.subject, text: out.text, html: out.html, replyTo });
}

// The studio reads its emails in its own language: STUDIO_LANG if set,
// otherwise the language of the account behind the notify address.
let studioCache = null;
export async function studioLang(env) {
  const fixed = pickLang(env.STUDIO_LANG);
  if (fixed) return fixed;
  if (studioCache && Date.now() - studioCache.at < 300000) return studioCache.lang;
  let lang = 'en';
  try {
    const u = env.DB && await env.DB.prepare('SELECT lang FROM users WHERE LOWER(email) = LOWER(?)').bind(notifyAddress(env)).first();
    if (u && pickLang(u.lang)) lang = u.lang;
  } catch (e) { /* default */ }
  studioCache = { lang, at: Date.now() };
  return lang;
}

export async function sendStudio(env, key, params, replyTo, vault) {
  return sendMail(env, { to: notifyAddress(env), lang: await studioLang(env), key, params, replyTo, vault: vault !== false });
}
