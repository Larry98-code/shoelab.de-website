// Shared helpers for ShoeLab.de Cloudflare Pages Functions.
// Underscore-prefixed directory → excluded from routing, importable by routes.

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

export async function currentUser(request, env) {
  const token = readCookie(request, 'shoelab_session');
  if (!token) return null;
  const payload = await verifySession(token, sessionSecret(env));
  if (!payload || !payload.uid || !env.DB) return null;
  try {
    const row = await env.DB.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?')
      .bind(payload.uid)
      .first();
    return row || null;
  } catch (e) {
    return null;
  }
}

// ---- transactional email via Resend (best-effort) -------------------------
export async function sendEmail(env, { to, subject, text, replyTo }) {
  if (!env.RESEND_API_KEY) return { skipped: 'no RESEND_API_KEY' };
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
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    return { ok: r.ok };
  } catch (e) {
    return { error: String(e) };
  }
}

export function notifyAddress(env) {
  return env.NOTIFY_EMAIL || 'Shoelab.de@gmail.com';
}
