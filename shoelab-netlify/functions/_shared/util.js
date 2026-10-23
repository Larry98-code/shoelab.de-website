// Shared helpers for ShoeLab.de Cloudflare Pages Functions.
// Underscore-prefixed directory → excluded from routing, importable by routes.
import { ensureCore, requestLang } from './core.js';

export function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export function json(obj, status, extra) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, cors(), extra || {}),
  });
}

export function preflight() {
  return new Response('', { status: 204, headers: cors() });
}

// ---- input helpers --------------------------------------------------------
export function clean(s, max) {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, max || 500);
}

export function validEmail(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;
}

// ---- password hashing (PBKDF2 / WebCrypto) --------------------------------
const ITER = 100000;

function buf2hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function hex2buf(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

export async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const salt = saltHex ? hex2buf(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
    key,
    256
  );
  return { salt: buf2hex(salt), hash: buf2hex(bits) };
}

export async function verifyPassword(password, saltHex, hashHex) {
  const { hash } = await hashPassword(password, saltHex);
  // constant-ish time compare
  if (hash.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return diff === 0;
}

// ---- signed session cookies (HMAC-SHA256) ---------------------------------
function b64url(bytes) {
  let s = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlToBytes(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signSession(payload, secret) {
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return body + '.' + b64url(sig);
}

export async function verifySession(token, secret) {
  if (!token || token.indexOf('.') < 0) return null;
  const [body, sig] = token.split('.');
  try {
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      b64urlToBytes(sig),
      new TextEncoder().encode(body)
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(body)));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

export function sessionSecret(env) {
  // SESSION_SECRET should be set as an encrypted env var in Cloudflare.
  return env.SESSION_SECRET || env.ANTHROPIC_API_KEY || 'shoelab-dev-secret-change-me';
}

export function readCookie(request, name) {
  const h = request.headers.get('Cookie') || '';
  const m = h.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}

export function setCookie(name, value, maxAgeSec) {
  const parts = [
    name + '=' + encodeURIComponent(value),
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ];
  if (maxAgeSec === 0) parts.push('Max-Age=0');
  else parts.push('Max-Age=' + (maxAgeSec || 60 * 60 * 24 * 30));
  return parts.join('; ');
}

// The signed-in member, or null. Also remembers the language they are using,
// so emails written to them later (by someone else's action) match it.
export async function currentUser(request, env) {
  const token = readCookie(request, 'shoelab_session');
  if (!token) return null;
  const payload = await verifySession(token, sessionSecret(env));
  if (!payload || !payload.uid || !env.DB) return null;
  try {
    await ensureCore(env);
    const row = await env.DB.prepare(
      'SELECT id, name, email, created_at, lang, email_verified_at FROM users WHERE id = ?'
    ).bind(payload.uid).first();
    if (!row) return null;
    const lang = requestLang(request);
    if (row.lang !== lang) {
      await env.DB.prepare('UPDATE users SET lang = ? WHERE id = ?').bind(lang, row.id).run();
      row.lang = lang;
    }
    row.verified = !!row.email_verified_at;
    return row;
  } catch (e) {
    return null;
  }
}

// ---- transactional email via Resend (best-effort) -------------------------
// A send that does not go through is written down (and logged), so a missing
// or wrong key shows up in /api/health and the lab console instead of
// failing silently. Never lets the record itself break the request.
async function mailFailed(env, to, subject, reason) {
  try { console.error('Email not sent (' + reason + '): ' + subject); } catch (e) { /* no console */ }
  if (!env.DB) return;
  try {
    await ensureCore(env);
    await env.DB.prepare('INSERT INTO mail_failures (recipient, subject, reason, created_at) VALUES (?, ?, ?, ?)')
      .bind(String([].concat(to || []).join(', ')).slice(0, 300), String(subject || '').slice(0, 200),
        String(reason).slice(0, 300), new Date().toISOString()).run();
  } catch (e) { /* the send already failed; nothing more to do */ }
}

// ...and so is the last one that did go out, so the warning ends by itself
// as soon as email works again.
async function mailSent(env) {
  if (!env.DB) return;
  try {
    await ensureCore(env);
    await env.DB.prepare('INSERT INTO mail_ok (id, at) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET at = excluded.at')
      .bind(new Date().toISOString()).run();
  } catch (e) { /* the email went out; the note is only for the warning */ }
}

// Emails that failed in the last 7 days and have not been followed by one
// that went out: what the health check and the lab console warn about.
export async function mailTrouble(env) {
  await ensureCore(env);
  const ok = await env.DB.prepare('SELECT at FROM mail_ok WHERE id = 1').first();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const since = ok && ok.at > weekAgo ? ok.at : weekAgo;
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM mail_failures WHERE created_at > ?').bind(since).first();
  const failing = (n && n.n) || 0;
  const last = failing
    ? await env.DB.prepare('SELECT reason, created_at FROM mail_failures WHERE created_at > ? ORDER BY id DESC LIMIT 1').bind(since).first()
    : null;
  return { failing, last, lastSent: ok ? ok.at : null };
}

export async function sendEmail(env, { to, subject, text, html, replyTo }) {
  if (!env.RESEND_API_KEY) {
    await mailFailed(env, to, subject, 'RESEND_API_KEY is not set');
    return { skipped: 'no RESEND_API_KEY' };
  }
  const from = env.MAIL_FROM || 'ShoeLab <onboarding@resend.dev>';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        text,
        ...(html ? { html } : {}),
        // customers who hit reply reach the studio inbox, not the sending domain
        reply_to: replyTo || env.REPLY_TO || notifyAddress(env),
      }),
    });
    if (r.ok) { await mailSent(env); return { ok: true }; }
    const body = await r.json().catch(() => ({}));
    const reason = 'Resend ' + r.status + (body && (body.message || body.name) ? ': ' + (body.message || body.name) : '');
    await mailFailed(env, to, subject, reason);
    return { ok: false, error: reason };
  } catch (e) {
    await mailFailed(env, to, subject, 'network: ' + String(e).slice(0, 200));
    return { error: String(e) };
  }
}

// Where a booked customer brings their shoes. The studio runs from home, so
// the full address lives only in the DROPOFF_ADDRESS secret and only ever
// appears in the private confirmation sent to someone who has booked — the
// public site shows just the street and postcode.
export function dropoffInstructions(env) {
  const addr = String(env.DROPOFF_ADDRESS || '').trim();
  return addr
    ? 'Drop-off address:\n  ' + addr.replace(/\s*\n\s*/g, '\n  ') + '\n'
    : 'We will send you the exact drop-off address on WhatsApp before your appointment.\n';
}

export function notifyAddress(env) {
  return env.NOTIFY_EMAIL || 'Shoelab.de@gmail.com';
}

// ---- Stripe helpers -------------------------------------------------------
// Form-encode a flat object for Stripe's API.
export function stripeForm(obj) {
  return Object.keys(obj)
    .filter((k) => obj[k] != null)
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]))
    .join('&');
}

// opts.idem sets an Idempotency-Key, so a retried call (a payout, a refund)
// can never happen twice.
export async function stripeApi(env, path, body, opts) {
  const headers = {
    Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (opts && opts.idem) headers['Idempotency-Key'] = opts.idem;
  const res = await fetch('https://api.stripe.com/v1/' + path, {
    method: 'POST', headers, body: stripeForm(body || {}),
  });
  return res.json();
}

export async function stripeGet(env, path) {
  const res = await fetch('https://api.stripe.com/v1/' + path, {
    headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY },
  });
  return res.json();
}

// Verify a Stripe webhook signature (t=...,v1=...) against the raw body.
export async function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = {};
  sigHeader.split(',').forEach((kv) => {
    const i = kv.indexOf('=');
    if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  });
  if (!parts.t || !parts.v1) return false;
  const signed = parts.t + '.' + rawBody;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed));
  const expected = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (expected.length !== parts.v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  return diff === 0;
}
