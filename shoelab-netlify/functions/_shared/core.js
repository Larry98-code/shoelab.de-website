// Things every function needs before it touches the database or writes to a
// person: the account tables brought up to date, and the language to use.
// No imports, so util.js, mail.js and vault.js can all build on it.

export const LANGS = ['en', 'de', 'pl', 'ru', 'uk', 'it', 'es', 'fr'];

export function siteUrl(env) {
  return String((env && env.SITE_URL) || 'https://shoelabonline.de').replace(/\/$/, '');
}

export function pickLang(v) {
  const l = String(v || '').trim().slice(0, 2).toLowerCase();
  return LANGS.indexOf(l) !== -1 ? l : null;
}

function cookie(request, name) {
  const h = request.headers.get('Cookie') || '';
  const m = h.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}

// The language a request comes in: what the visitor picked on the site
// (sl-geo.js keeps it in a cookie), otherwise their browser's own settings.
export function requestLang(request) {
  if (!request) return 'en';
  const picked = pickLang(cookie(request, 'shoelab_lang'));
  if (picked) return picked;
  const header = request.headers.get('Accept-Language') || '';
  const ranked = header.split(',').map((part) => {
    const [tag, q] = part.trim().split(';q=');
    return { lang: pickLang(tag), q: q ? parseFloat(q) : 1 };
  }).filter((x) => x.lang).sort((a, b) => b.q - a.q);
  return ranked.length ? ranked[0].lang : 'en';
}

// Columns added after launch. Missing ones are added on the first request,
// so an older database needs no manual migration.
const COLUMNS = [
  ['users', 'phone', 'TEXT'], ['users', 'address', 'TEXT'], ['users', 'city', 'TEXT'],
  ['users', 'postal', 'TEXT'], ['users', 'country', 'TEXT'], ['users', 'stripe_customer_id', 'TEXT'],
  ['users', 'lang', 'TEXT'], ['users', 'email_verified_at', 'TEXT'],
  ['bookings', 'lang', 'TEXT'],
];
const TABLES = [
  // one-time links: email confirmation (and anything like it later)
  `CREATE TABLE IF NOT EXISTS email_tokens (
    token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, kind TEXT NOT NULL,
    next TEXT, expires_at TEXT NOT NULL, created_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS email_tokens_user ON email_tokens(user_id, kind)',
  // every stored email, so its "read in another language" links can render it again
  `CREATE TABLE IF NOT EXISTS mail_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT NOT NULL, recipient TEXT,
    template TEXT NOT NULL, params TEXT NOT NULL, lang TEXT NOT NULL, created_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS mail_log_created ON mail_log(created_at)',
  // emails that did not go out (no key, a wrong key, Resend refusing), so a
  // broken setup shows in /api/health and the lab console, not nowhere
  `CREATE TABLE IF NOT EXISTS mail_failures (
    id INTEGER PRIMARY KEY AUTOINCREMENT, recipient TEXT, subject TEXT,
    reason TEXT NOT NULL, created_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS mail_failures_created ON mail_failures(created_at)',
  // when an email last went out: failures before it are history, not a warning
  'CREATE TABLE IF NOT EXISTS mail_ok (id INTEGER PRIMARY KEY CHECK (id = 1), at TEXT NOT NULL)',
];

export async function addMissingColumns(env, columns) {
  const byTable = {};
  columns.forEach(([t, c, type]) => { (byTable[t] = byTable[t] || []).push([c, type]); });
  for (const t of Object.keys(byTable)) {
    let have;
    try {
      const info = await env.DB.prepare('PRAGMA table_info(' + t + ')').all();
      have = new Set((info.results || []).map((r) => r.name));
    } catch (e) { continue; }
    if (!have.size) continue;              // table not created yet
    for (const [c, type] of byTable[t]) {
      if (have.has(c)) continue;
      try { await env.DB.prepare('ALTER TABLE ' + t + ' ADD COLUMN ' + c + ' ' + type).run(); }
      catch (e) { /* another isolate added it first */ }
    }
  }
}

let coreReady = false;
export async function ensureCore(env) {
  if (coreReady || !env.DB) return;
  await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));
  await addMissingColumns(env, COLUMNS);
  coreReady = true;
}
