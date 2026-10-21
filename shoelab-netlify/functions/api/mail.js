// GET /api/mail?m=<id>&k=<token>&lang=<xx>
// The "read this email in another language" links in every email land here:
// the stored email is rendered again, in the language picked, as a web page.
import { pickLang, siteUrl, LANGS } from '../_shared/core.js';
import { renderMail, LANG_NAMES } from '../_shared/mail.js';

function page(status, body) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const id = parseInt(q.get('m'), 10), token = String(q.get('k') || '');
  const lang = pickLang(q.get('lang')) || 'en';
  if (!env.DB || !id || !/^[0-9a-f]{32}$/.test(token)) return page(404, '<p>Not found.</p>');
  let row = null;
  try { row = await env.DB.prepare('SELECT * FROM mail_log WHERE id = ? AND token = ?').bind(id, token).first(); }
  catch (e) { row = null; }
  if (!row) return page(404, '<!doctype html><meta charset="utf-8"><p style="font-family:sans-serif;padding:2rem">This email is no longer available.</p>');
  let stored = {};
  try { stored = JSON.parse(row.params || '{}'); } catch (e) { stored = {}; }
  const site = siteUrl(env);
  const base = site + '/api/mail?m=' + id + '&k=' + token + '&lang=';
  const links = LANGS.filter((l) => l !== lang).map((l) => ({ l, url: base + l }));
  // a bar across the top to hop between languages
  const top = '<div style="background:#080808;padding:10px 12px;text-align:center;font:13px -apple-system,Segoe UI,Helvetica,Arial,sans-serif;">' +
    LANGS.map((l) => l === lang
      ? '<span style="color:#d4af37;font-weight:700;margin:0 8px;white-space:nowrap;">' + LANG_NAMES[l] + '</span>'
      : '<a href="' + base + l + '" style="color:#cfcfcf;text-decoration:none;margin:0 8px;white-space:nowrap;">' + LANG_NAMES[l] + '</a>').join('') +
    '</div>';
  let out;
  try { out = renderMail(lang, row.template, stored.p || {}, { site, vault: !!stored.v, links, top }); }
  catch (e) { return page(404, '<p>Not found.</p>'); }
  return page(200, out.html);
}
