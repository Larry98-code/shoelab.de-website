// POST /api/newsletter/subscribe — step 1 of double opt-in.
// Sends a confirmation link; the address joins the list only after the click
// (see confirm.js). Nothing about the address is stored before that.
import {
  json, preflight, clean, validEmail, sendEmail, signSession, sessionSecret, siteOrigin,
} from '../../_shared/util.js';

const COPY = {
  de: {
    subject: 'Bitte bestätige deine Newsletter-Anmeldung',
    hello: 'Hallo,',
    body: 'du (oder jemand mit deiner Adresse) hast dich für den ShoeLab.de Newsletter angemeldet. Bitte bestätige die Anmeldung mit diesem Link:',
    ignore: 'Wenn du dich nicht angemeldet hast, ignoriere diese E-Mail einfach. Ohne Bestätigung erhältst du nichts von uns.',
    button: 'Anmeldung bestätigen',
  },
  en: {
    subject: 'Please confirm your newsletter sign-up',
    hello: 'Hi,',
    body: 'you (or someone using your address) signed up for the ShoeLab.de newsletter. Please confirm with this link:',
    ignore: "If this wasn't you, just ignore this email. Without confirmation you won't hear from us.",
    button: 'Confirm sign-up',
  },
};

export async function onRequestOptions() {
  return preflight();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Invalid JSON' }, 400); }

  // Honeypot — bots fill hidden fields; silently accept and drop.
  if (clean(body.company, 100)) return json({ ok: true }, 200);

  const email = clean(body.email, 254).toLowerCase();
  if (!validEmail(email)) return json({ error: 'A valid email is required' }, 400);
  if (body.consent !== true) return json({ error: 'Consent is required' }, 400);

  const lang = clean(body.lang, 5) === 'de' ? 'de' : 'en';
  const c = COPY[lang];

  const token = await signSession(
    { k: 'nl', e: email, l: lang, exp: Date.now() + 1000 * 60 * 60 * 72 },
    sessionSecret(env)
  );
  const link = siteOrigin(request, env) + '/api/newsletter/confirm?t=' + encodeURIComponent(token);

  const text = `${c.hello}\n\n${c.body}\n\n${link}\n\n${c.ignore}\n\nShoeLab.de · Bremen`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:520px">
<p>${c.hello}</p><p>${c.body}</p>
<p><a href="${link}" style="display:inline-block;background:#cc1111;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">${c.button}</a></p>
<p style="color:#666;font-size:13px">${c.ignore}</p>
<p style="color:#666;font-size:13px">ShoeLab.de · Bremen</p></div>`;

  const r = await sendEmail(env, { to: email, subject: c.subject, text, html });
  if (r.skipped || r.error || r.ok === false) {
    return json({ error: 'Could not send the confirmation email. Please try again later.' }, 502);
  }
  return json({ ok: true }, 200);
}

export async function onRequest() {
  return json({ error: 'Method not allowed' }, 405);
}
