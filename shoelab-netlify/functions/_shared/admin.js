// ShoeLab Vault — the console's admin tools.
//
//   members   warn, restrict selling and/or buying, hide their listings,
//             suspend (for a time), ban, sign out everywhere, message,
//             delete (personal data anonymised; orders kept, as tax law asks)
//   listings  hide, show again, remove (ends an auction, bidders are told),
//             correct the details
//   orders    refund in full or in part (optionally taken back from the
//             seller's payout), cancel, hold or release the payout, notes
//   reports   members and visitors report a listing or a member; the
//             console decides and the reporter hears back
//   switches  pause new listings, all trading, or new accounts
//   log       every action above: who, what, why, when
//
// The EU Digital Services Act asks two things of a marketplace this size:
// a way for anyone to report a listing or a member (Art. 16, with a receipt
// and an answer), and a statement of reasons to anyone whose listing or
// account is restricted (Art. 17): what was done, for how long, why (the
// part of the terms), and how to object. The emails below carry all of it.
//
// Who may: specialists (VAULT_SPECIALISTS). VAULT_ADMINS, when set, narrows
// the admin tools to those addresses; otherwise every specialist has them.
import { clean, validEmail, stripeApi } from './util.js';
import { onHold } from './core.js';
import {
  nowIso, isoIn, listingTitle, tell, tellStudio, userById, logEvent, increment, isSpecialist, onSpecialistList, shortName,
  connectOn, releasePayout,
} from './vault.js';

export const REASONS = ['counterfeit', 'misleading', 'nonpayment', 'nonshipment', 'fraud', 'offplatform', 'abuse', 'prohibited', 'multiple', 'terms', 'request', 'other'];
export const REPORT_REASONS = ['counterfeit', 'misleading', 'prohibited', 'offplatform', 'fraud', 'abuse', 'other'];
export const DURATIONS = [1, 3, 7, 14, 30, 90, 0];          // days; 0 = until further notice
export const SETTING_KEYS = ['pause_listings', 'pause_trading', 'pause_signups'];
const FOREVER = '9999-12-31T00:00:00.000Z';
const OPEN_ORDER = "('awaiting_payment','paid','to_lab','in_lab','verified','shipped','disputed')";
const PAID_STEPS = ['paid', 'to_lab', 'in_lab', 'verified', 'shipped', 'delivered', 'disputed'];

// errors look like the route's own (status, message, code, extra)
export class AdminError extends Error {
  constructor(status, message, code, extra) { super(message); this.status = status; this.code = code; this.extra = extra; this.http = true; }
}
const fail = (status, message, code, extra) => { throw new AdminError(status, message, code, extra); };
const parse = (s, d) => { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } };
const until = (days) => (days > 0 ? isoIn(days * 86400000) : FOREVER);
const shownUntil = (iso) => (!iso || iso === FOREVER ? null : iso);

export function isAdmin(env, user) {
  if (!isSpecialist(env, user)) return false;
  const list = String(env.VAULT_ADMINS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return !list.length || list.indexOf(String(user.email).toLowerCase()) !== -1;
}

export async function emailHash(email) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('shoelab-blocked:' + String(email || '').trim().toLowerCase()));
  return Array.from(new Uint8Array(h), (x) => x.toString(16).padStart(2, '0')).join('');
}

/* ── the Vault's switches ──────────────────────────────────────────────── */
let setCache = null, setAt = 0;
export async function vaultSettings(env, fresh) {
  if (!fresh && setCache && Date.now() - setAt < 5000) return setCache;
  const out = { notice: '' };
  SETTING_KEYS.forEach((k) => { out[k] = false; });
  try {
    const rows = await env.DB.prepare('SELECT k, v FROM mk_settings').all();
    (rows.results || []).forEach((r) => {
      if (SETTING_KEYS.indexOf(r.k) !== -1) out[r.k] = r.v === '1';
      if (r.k === 'notice') out.notice = r.v || '';
    });
  } catch (e) { /* not created yet: nothing is paused */ }
  setCache = out; setAt = Date.now();
  return out;
}
export async function setSettings(env, actor, b) {
  const at = nowIso(), changed = [];
  const before = await vaultSettings(env, true);
  for (const k of SETTING_KEYS) {
    if (typeof b[k] !== 'boolean' || b[k] === before[k]) continue;
    await env.DB.prepare('INSERT INTO mk_settings (k, v, updated_at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at')
      .bind(k, b[k] ? '1' : '0', at).run();
    changed.push(k + (b[k] ? ' on' : ' off'));
  }
  if (typeof b.notice === 'string' && clean(b.notice, 300) !== before.notice) {
    await env.DB.prepare('INSERT INTO mk_settings (k, v, updated_at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at')
      .bind('notice', clean(b.notice, 300), at).run();
    changed.push('notice');
  }
  if (changed.length) await admLog(env, actor, 'setting', null, 'settings', null, changed.join(', '));
  return vaultSettings(env, true);
}

/* ── a member's standing ───────────────────────────────────────────────── */
export function standing(u) {
  const now = nowIso();
  const st = { status: 'active', until: null, reason: null, note: null, noSell: null, noBuy: null, hidden: !!(u && u.listings_hidden) };
  if (!u) return st;
  if (u.status === 'banned' || u.status === 'deleted') st.status = u.status;
  else if (u.status === 'suspended' && u.status_until && u.status_until > now) { st.status = 'suspended'; st.until = shownUntil(u.status_until); }
  if (st.status !== 'active') { st.reason = u.status_reason || null; st.note = u.status_note || null; }
  if (u.no_sell_until && u.no_sell_until > now) st.noSell = shownUntil(u.no_sell_until) || 'open';
  if (u.no_buy_until && u.no_buy_until > now) st.noBuy = shownUntil(u.no_buy_until) || 'open';
  return st;
}
// null when the member may; otherwise [status, message, code, extra] for the route's fail()
export async function tradeBlock(env, u, what) {
  if (onHold(env)) return [503, 'ShoeLab is taking a short pause, so this is not possible right now. We will be back soon.', 'on_hold'];
  const s = await vaultSettings(env);
  if (s.pause_trading) return [503, 'The Vault is paused for a moment — please try again later', 'paused_trading', { notice: s.notice || null }];
  if (what === 'sell' && s.pause_listings) return [503, 'New listings are paused for a moment — please try again later', 'paused_listings', { notice: s.notice || null }];
  const st = standing(u);
  if (st.status === 'suspended') return [403, 'Your account is suspended', 'acct_suspended', { until: st.until }];
  if (st.status !== 'active') return [403, 'This account is closed', 'acct_closed'];
  if (what === 'sell' && st.noSell) return [403, 'Selling is not available on your account right now', 'restricted_sell', { until: st.noSell === 'open' ? null : st.noSell }];
  if (what === 'buy' && st.noBuy) return [403, 'Buying is not available on your account right now', 'restricted_buy', { until: st.noBuy === 'open' ? null : st.noBuy }];
  return null;
}
// A listing anyone but its seller and the lab may see: not hidden on its own,
// and its seller's listings are not hidden or suspended. (SQL on "l")
export const VISIBLE = `l.hidden_at IS NULL AND NOT EXISTS (SELECT 1 FROM users su WHERE su.id = l.seller_id
  AND (su.listings_hidden = 1 OR su.status IN ('suspended','banned','deleted')))`;
export async function listingVisible(env, l) {
  if (!l || l.hidden_at) return false;
  const u = await env.DB.prepare('SELECT listings_hidden, status FROM users WHERE id = ?').bind(l.seller_id).first();
  return !(u && (u.listings_hidden === 1 || ['suspended', 'banned', 'deleted'].indexOf(u.status) !== -1));
}

/* ── the log ───────────────────────────────────────────────────────────── */
export async function admLog(env, actor, kind, id, action, reason, note, data) {
  await env.DB.prepare(
    'INSERT INTO mk_admin_log (actor_id, actor_name, target_kind, target_id, action, reason, note, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(actor ? actor.id : null, actor ? actor.name : 'system', kind, id == null ? null : id, action, reason || null,
    note ? String(note).slice(0, 2000) : null, data ? JSON.stringify(data) : null, nowIso()).run();
}
function logView(r) {
  return { id: r.id, at: r.created_at, by: r.actor_name, kind: r.target_kind, target: r.target_id, action: r.action, reason: r.reason, note: r.note, data: parse(r.data, null), label: r.label || null };
}
export async function logFeed(env, q) {
  const kind = q.get('kind'), id = parseInt(q.get('id'), 10);
  const page = Math.max(1, parseInt(q.get('page'), 10) || 1);
  const where = [], args = [];
  if (kind) { where.push('a.target_kind = ?'); args.push(kind); }
  if (id) { where.push('a.target_id = ?'); args.push(id); }
  const rows = await env.DB.prepare(
    `SELECT a.*, CASE a.target_kind WHEN 'user' THEN (SELECT name FROM users WHERE id = a.target_id)
       WHEN 'listing' THEN (SELECT brand || ' ' || model FROM mk_listings WHERE id = a.target_id) END AS label
     FROM mk_admin_log a` + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY a.id DESC LIMIT 50 OFFSET ?'
  ).bind(...args, (page - 1) * 50).all();
  return { entries: (rows.results || []).map(logView), page };
}

/* ── the statement of reasons (DSA Art. 17), as email params ───────────── */
function reasons(reason, details, rows) {
  return {
    reason: { k: 'rs_' + reason }, message: details || '',
    rows: [['rsWhy', { k: 'rs_' + reason }]].concat(rows || []),
    terms: { k: 'admTermsRef' }, appeal: { k: 'admAppeal' },
  };
}
function needReason(b) {
  const reason = REASONS.indexOf(b.reason) !== -1 ? b.reason : null;
  if (!reason) fail(400, 'Choose a reason', 'adm_reason');
  const details = clean(b.details || '', 1500);
  if (reason === 'other' && details.length < 10) fail(400, 'Describe what happened — the member is told', 'adm_details');
  return { reason, details };
}
function days(b) {
  const n = parseInt(b.days, 10);
  return DURATIONS.indexOf(n) !== -1 ? n : 7;
}

/* ── auctions: a member's bids taken out, the price worked out again ───── */
export async function removeBidder(env, listingId, userId) {
  const l = await env.DB.prepare("SELECT * FROM mk_listings WHERE id = ? AND status = 'live' AND format = 'auction'").bind(listingId).first();
  if (!l) return false;
  await env.DB.prepare('DELETE FROM mk_bids WHERE listing_id = ? AND bidder_id = ?').bind(listingId, userId).run();
  const tops = await env.DB.prepare(
    'SELECT bidder_id, MAX(max_amount) AS mx, MIN(id) AS first FROM mk_bids WHERE listing_id = ? GROUP BY bidder_id ORDER BY mx DESC, first ASC LIMIT 2'
  ).bind(listingId).all();
  const t = tops.results || [];
  const pub = await env.DB.prepare('SELECT COUNT(*) AS n FROM mk_bids WHERE listing_id = ? AND pub = 1').bind(listingId).first();
  let price = l.start_price, leader = null, max = null;
  if (t.length) {
    leader = t[0].bidder_id; max = t[0].mx;
    price = t.length > 1 ? Math.min(t[0].mx, t[1].mx + increment(t[1].mx)) : l.start_price;
  }
  await env.DB.prepare('UPDATE mk_listings SET price = ?, high_bidder = ?, high_max = ?, bids = ?, version = version + 1, updated_at = ? WHERE id = ?')
    .bind(price, leader, max, t.length ? (pub ? pub.n : 0) : 0, nowIso(), listingId).run();
  await logEvent(env, { listingId, kind: 'bids_removed', note: 'member #' + userId });
  return true;
}
// everything a member has running with others: bids out, offers closed, unpaid orders cancelled
async function windDown(env, u, reasonKey) {
  const at = nowIso();
  const bidOn = await env.DB.prepare(
    "SELECT DISTINCT b.listing_id FROM mk_bids b JOIN mk_listings l ON l.id = b.listing_id WHERE b.bidder_id = ? AND l.status = 'live'"
  ).bind(u.id).all();
  for (const r of bidOn.results || []) await removeBidder(env, r.listing_id, u.id);
  await env.DB.prepare("UPDATE mk_offers SET status = 'declined', updated_at = ? WHERE (buyer_id = ? OR seller_id = ?) AND status IN ('pending','countered')")
    .bind(at, u.id, u.id).run();
  const unpaid = await env.DB.prepare("SELECT * FROM mk_orders WHERE buyer_id = ? AND status = 'awaiting_payment'").bind(u.id).all();
  for (const o of unpaid.results || []) {
    const r = await env.DB.prepare("UPDATE mk_orders SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'awaiting_payment'").bind(at, o.id).run();
    if (!r.meta.changes) continue;
    await env.DB.prepare("UPDATE mk_listings SET status = 'ended', updated_at = ? WHERE id = ? AND status = 'sold'").bind(at, o.listing_id).run();
    await logEvent(env, { orderId: o.id, kind: 'cancelled', note: 'buyer account ' + reasonKey });
    const l = await env.DB.prepare('SELECT brand, model FROM mk_listings WHERE id = ?').bind(o.listing_id).first();
    await tell(env, await userById(env, o.seller_id), 'admOrderCancelled', {
      order: o.id, title: l ? listingTitle(l) : '#' + o.id, message: '', refund: '', relist: { k: 'admRelist' }, url: '/vault-me.html#selling',
    });
  }
  return (bidOn.results || []).length;
}
async function openOrders(env, userId) {
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM mk_orders WHERE (buyer_id = ? OR seller_id = ?) AND status IN ' + OPEN_ORDER).bind(userId, userId).first();
  return r ? r.n : 0;
}

/* ── listings: taken down, bidders told ────────────────────────────────── */
async function takeDown(env, l, status, note) {
  const at = nowIso();
  const r = await env.DB.prepare(
    "UPDATE mk_listings SET status = ?, review_note = ?, updated_at = ? WHERE id = ? AND status IN ('review','live','ended','cancelled','rejected')"
  ).bind(status, note || null, at, l.id).run();
  if (!r.meta.changes) return false;
  await env.DB.prepare("UPDATE mk_offers SET status = 'declined', updated_at = ? WHERE listing_id = ? AND status IN ('pending','countered')").bind(at, l.id).run();
  if (l.status === 'live' && l.bids) {
    const who = await env.DB.prepare('SELECT DISTINCT bidder_id FROM mk_bids WHERE listing_id = ?').bind(l.id).all();
    for (const b of who.results || []) {
      await tell(env, await userById(env, b.bidder_id), 'admAuctionEnded', { title: listingTitle(l) });
    }
  }
  await logEvent(env, { listingId: l.id, kind: 'removed', note });
  return true;
}

/* ── members ───────────────────────────────────────────────────────────── */
const MEMBER_COLS = `u.id, u.name, u.email, u.created_at, u.email_verified_at, u.status, u.status_until, u.status_reason, u.status_note,
  u.no_sell_until, u.no_buy_until, u.listings_hidden, u.last_seen, u.lang,
  (SELECT COUNT(*) FROM mk_listings WHERE seller_id = u.id AND status = 'live') AS live,
  (SELECT COUNT(*) FROM mk_orders WHERE seller_id = u.id AND status = 'delivered') AS sold,
  (SELECT COUNT(*) FROM mk_orders WHERE buyer_id = u.id AND status NOT IN ('cancelled','awaiting_payment')) AS bought,
  (SELECT COUNT(*) FROM mk_orders WHERE (buyer_id = u.id OR seller_id = u.id) AND status = 'disputed') AS disputes,
  (SELECT COUNT(*) FROM mk_reports r WHERE r.status = 'open' AND ((r.kind = 'user' AND r.target_id = u.id)
     OR (r.kind = 'listing' AND r.target_id IN (SELECT id FROM mk_listings WHERE seller_id = u.id)))) AS reports,
  (SELECT ROUND(AVG(rating), 1) FROM mk_feedback WHERE seller_id = u.id) AS rating,
  (SELECT COUNT(*) FROM mk_feedback WHERE seller_id = u.id) AS ratings,
  (SELECT COUNT(*) FROM mk_admin_log WHERE target_kind = 'user' AND target_id = u.id AND action = 'warn') AS warnings`;
function memberRow(env, r) {
  return {
    id: r.id, name: r.name, email: r.email, joined: r.created_at, verified: !!r.email_verified_at, lastSeen: r.last_seen || null, lang: r.lang || null,
    standing: standing(r), staff: isSpecialist(env, { email: r.email, verified: !!r.email_verified_at }),
    live: r.live || 0, sold: r.sold || 0, bought: r.bought || 0, disputes: r.disputes || 0, reports: r.reports || 0,
    rating: r.rating, ratings: r.ratings || 0, warnings: r.warnings || 0,
  };
}
const FILTERS = {
  all: "COALESCE(u.status, '') != 'deleted'",
  sellers: "COALESCE(u.status, '') != 'deleted' AND EXISTS (SELECT 1 FROM mk_listings WHERE seller_id = u.id)",
  buyers: "COALESCE(u.status, '') != 'deleted' AND EXISTS (SELECT 1 FROM mk_orders WHERE buyer_id = u.id)",
  flagged: `COALESCE(u.status, '') != 'deleted' AND (EXISTS (SELECT 1 FROM mk_reports r WHERE r.status = 'open' AND ((r.kind = 'user' AND r.target_id = u.id)
     OR (r.kind = 'listing' AND r.target_id IN (SELECT id FROM mk_listings WHERE seller_id = u.id))))
     OR EXISTS (SELECT 1 FROM mk_orders WHERE (buyer_id = u.id OR seller_id = u.id) AND status = 'disputed'))`,
  limited: "COALESCE(u.status, '') = '' AND (u.no_sell_until > :now OR u.no_buy_until > :now OR u.listings_hidden = 1)",
  suspended: "u.status = 'suspended' AND u.status_until > :now",
  banned: "u.status = 'banned'",
  new: "COALESCE(u.status, '') != 'deleted' AND u.created_at > :week",
  unverified: "COALESCE(u.status, '') != 'deleted' AND u.email_verified_at IS NULL",
  deleted: "u.status = 'deleted'",
};
export async function memberList(env, q) {
  const now = nowIso(), week = new Date(Date.now() - 7 * 86400000).toISOString();
  const sub = (s) => s.replace(/:now/g, "'" + now + "'").replace(/:week/g, "'" + week + "'");   // our own timestamps
  const f = FILTERS[q.get('f')] ? q.get('f') : 'all';
  const where = [sub(FILTERS[f])], args = [];
  const text = clean(q.get('q') || '', 80);
  if (text) {
    const like = '%' + text.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
    where.push("(u.name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\' OR u.id = ?)");
    args.push(like, like, parseInt(text.replace(/^#/, ''), 10) || 0);
  }
  const page = Math.max(1, parseInt(q.get('page'), 10) || 1), per = 25;
  const w = where.join(' AND ');
  const total = (await env.DB.prepare('SELECT COUNT(*) AS n FROM users u WHERE ' + w).bind(...args).first()).n;
  const rows = await env.DB.prepare('SELECT ' + MEMBER_COLS + ' FROM users u WHERE ' + w + ' ORDER BY u.id DESC LIMIT ? OFFSET ?').bind(...args, per, (page - 1) * per).all();
  const counts = {};
  for (const k of Object.keys(FILTERS)) counts[k] = (await env.DB.prepare('SELECT COUNT(*) AS n FROM users u WHERE ' + sub(FILTERS[k])).first()).n;
  return { members: (rows.results || []).map((r) => memberRow(env, r)), total, page, pages: Math.max(1, Math.ceil(total / per)), counts, filter: f };
}
export async function memberView(env, id) {
  const r = await env.DB.prepare('SELECT ' + MEMBER_COLS + ', u.phone, u.address, u.city, u.postal, u.country FROM users u WHERE u.id = ?').bind(id).first();
  if (!r) fail(404, 'No member with that number', 'adm_gone');
  const m = memberRow(env, r);
  m.contact = { phone: r.phone || null, address: [r.address, [r.postal, r.city].filter(Boolean).join(' '), r.country].filter(Boolean).join(', ') || null };
  const acct = await env.DB.prepare('SELECT stripe_account, details_submitted, payouts_enabled FROM mk_sellers WHERE user_id = ?').bind(id).first();
  m.stripe = acct ? { account: acct.stripe_account, verified: !!acct.details_submitted, payouts: !!acct.payouts_enabled } : null;
  const ls = await env.DB.prepare(
    `SELECT l.id, l.brand, l.model, l.size, l.status, l.format, l.tier, l.price, l.bids, l.hidden_at, l.created_at, l.live_at,
       (SELECT id FROM mk_photos p WHERE p.listing_id = l.id AND COALESCE(p.kind, '') != 'extra' ORDER BY idx LIMIT 1) AS photo_id
     FROM mk_listings l WHERE l.seller_id = ? ORDER BY l.id DESC LIMIT 60`
  ).bind(id).all();
  m.listings = (ls.results || []).map((l) => ({ id: l.id, title: listingTitle(l), size: l.size, status: l.status, format: l.format, tier: l.tier, price: l.price, bids: l.bids,
    hidden: !!l.hidden_at, at: l.live_at || l.created_at, photo: l.photo_id ? '/api/market/photo?id=' + l.photo_id + '&s=t' : null }));
  const os = await env.DB.prepare(
    `SELECT o.id, o.status, o.total, o.payout, o.buyer_id, o.seller_id, o.created_at, o.refunded, l.brand, l.model, l.size
     FROM mk_orders o LEFT JOIN mk_listings l ON l.id = o.listing_id WHERE o.buyer_id = ? OR o.seller_id = ? ORDER BY o.id DESC LIMIT 60`
  ).bind(id, id).all();
  m.orders = (os.results || []).map((o) => ({ id: o.id, role: o.seller_id === id ? 'seller' : 'buyer', status: o.status, total: o.total, payout: o.payout,
    refunded: o.refunded || 0, at: o.created_at, title: o.brand ? listingTitle(o) : '#' + o.id, size: o.size }));
  const rp = await env.DB.prepare(
    `SELECT r.*, CASE r.kind WHEN 'listing' THEN (SELECT brand || ' ' || model FROM mk_listings WHERE id = r.target_id) END AS label FROM mk_reports r
     WHERE (r.kind = 'user' AND r.target_id = ?) OR (r.kind = 'listing' AND r.target_id IN (SELECT id FROM mk_listings WHERE seller_id = ?)) OR r.reporter_id = ?
     ORDER BY r.id DESC LIMIT 40`
  ).bind(id, id, id).all();
  m.reportList = (rp.results || []).map((x) => Object.assign(reportRow(x), { mine: x.reporter_id === id }));
  const tk = await env.DB.prepare('SELECT id, topic, summary, status, created_at FROM mk_tickets WHERE user_id = ? OR LOWER(email) = LOWER(?) ORDER BY id DESC LIMIT 20').bind(id, r.email).all();
  m.tickets = (tk.results || []).map((x) => ({ id: x.id, topic: x.topic, summary: x.summary, status: x.status, at: x.created_at }));
  const fb = await env.DB.prepare('SELECT order_id, rating, comment, created_at FROM mk_feedback WHERE seller_id = ? ORDER BY created_at DESC LIMIT 10').bind(id).all();
  m.feedback = (fb.results || []).map((x) => ({ order: x.order_id, rating: x.rating, comment: x.comment, at: x.created_at }));
  const act = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM mk_bids WHERE bidder_id = ?) AS bids, (SELECT COUNT(*) FROM mk_offers WHERE buyer_id = ?) AS offers,
       (SELECT COUNT(*) FROM mk_watch WHERE user_id = ?) AS watching,
       (SELECT COALESCE(SUM(item_price), 0) FROM mk_orders WHERE seller_id = ? AND status = 'delivered') AS sold_value,
       (SELECT COALESCE(SUM(total), 0) FROM mk_orders WHERE buyer_id = ? AND status NOT IN ('cancelled','awaiting_payment','refunded')) AS bought_value`
  ).bind(id, id, id, id, id).first();
  m.activity = act;
  m.openOrders = await openOrders(env, id);
  const log = await env.DB.prepare(
    `SELECT a.* FROM mk_admin_log a WHERE (a.target_kind = 'user' AND a.target_id = ?)
       OR (a.target_kind = 'listing' AND a.target_id IN (SELECT id FROM mk_listings WHERE seller_id = ?)) ORDER BY a.id DESC LIMIT 60`
  ).bind(id, id).all();
  m.log = (log.results || []).map(logView);
  return m;
}

export async function memberAction(env, actor, id, b) {
  const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!u || u.status === 'deleted') fail(404, 'No member with that number', 'adm_gone');
  const staff = isSpecialist(env, { email: u.email, verified: true }) || onSpecialistList(env, u.email);
  const a = String(b.action || '');
  if (staff && ['restrict', 'hide', 'suspend', 'ban', 'delete', 'logout'].indexOf(a) !== -1) fail(403, 'Team members are managed in the settings, not here', 'adm_staff');
  const at = nowIso(), st = standing(u);
  const user = { id: u.id, name: u.name, email: u.email, lang: u.lang };
  switch (a) {
    case 'note': {
      const note = clean(b.note || '', 1500);
      if (!note) fail(400, 'Write the note first', 'adm_note');
      await admLog(env, actor, 'user', id, 'note', null, note);
      return { ok: true };
    }
    case 'message': {
      const message = clean(b.message || '', 3000);
      if (message.length < 5) fail(400, 'Write the message first', 'adm_note');
      await tell(env, user, 'admMessage', { message });
      await admLog(env, actor, 'user', id, 'message', null, message);
      return { ok: true };
    }
    case 'warn': {
      const { reason, details } = needReason(b);
      await tell(env, user, 'admWarning', reasons(reason, details));
      await admLog(env, actor, 'user', id, 'warn', reason, details);
      return { ok: true };
    }
    case 'restrict': {
      const { reason, details } = needReason(b);
      const sell = b.sell === true, buy = b.buy === true;
      if (!sell && !buy) fail(400, 'Choose selling, buying or both', 'adm_scope');
      const d = days(b), end = until(d);
      await env.DB.prepare('UPDATE users SET no_sell_until = CASE WHEN ? THEN ? ELSE no_sell_until END, no_buy_until = CASE WHEN ? THEN ? ELSE no_buy_until END WHERE id = ?')
        .bind(sell ? 1 : 0, end, buy ? 1 : 0, end, id).run();
      if (buy) await windDown(env, u, 'limited');
      await tell(env, user, 'admRestricted', Object.assign(reasons(reason, details, [
        ['admScope', { k: sell && buy ? 'scopeBoth' : sell ? 'scopeSell' : 'scopeBuy' }], ['admUntil', d ? { d: end } : { k: 'untilNotice' }],
      ]), { scope: { k: sell && buy ? 'scopeBoth' : sell ? 'scopeSell' : 'scopeBuy' } }));
      await admLog(env, actor, 'user', id, 'restrict', reason, details, { sell, buy, days: d });
      return { ok: true };
    }
    case 'unrestrict': {
      await env.DB.prepare('UPDATE users SET no_sell_until = NULL, no_buy_until = NULL WHERE id = ?').bind(id).run();
      if (st.noSell || st.noBuy) await tell(env, user, 'admLifted', { what: { k: 'liftRestrict' } });
      await admLog(env, actor, 'user', id, 'unrestrict', null, clean(b.note || '', 500));
      return { ok: true };
    }
    case 'hide': {
      const { reason, details } = needReason(b);
      await env.DB.prepare('UPDATE users SET listings_hidden = 1 WHERE id = ?').bind(id).run();
      await tell(env, user, 'admHidden', reasons(reason, details));
      await admLog(env, actor, 'user', id, 'hide', reason, details);
      return { ok: true };
    }
    case 'unhide': {
      await env.DB.prepare('UPDATE users SET listings_hidden = 0 WHERE id = ?').bind(id).run();
      if (st.hidden) await tell(env, user, 'admLifted', { what: { k: 'liftHide' } });
      await admLog(env, actor, 'user', id, 'unhide', null, clean(b.note || '', 500));
      return { ok: true };
    }
    case 'suspend': {
      const { reason, details } = needReason(b);
      const d = days(b), end = until(d);
      await env.DB.prepare("UPDATE users SET status = 'suspended', status_until = ?, status_reason = ?, status_note = ? WHERE id = ?").bind(end, reason, details || null, id).run();
      const bids = await windDown(env, u, 'suspended');
      await tell(env, user, 'admSuspended', Object.assign(reasons(reason, details, [['admUntil', d ? { d: end } : { k: 'untilNotice' }]]),
        { until: d ? { d: end } : { k: 'untilNotice' }, open: (await openOrders(env, id)) ? { k: 'admOpenOrders' } : '' }));
      await admLog(env, actor, 'user', id, 'suspend', reason, details, { days: d, bidsRemoved: bids });
      return { ok: true, openOrders: await openOrders(env, id) };
    }
    case 'ban': {
      const { reason, details } = needReason(b);
      await env.DB.prepare("UPDATE users SET status = 'banned', status_until = NULL, status_reason = ?, status_note = ?, sessions_after = ? WHERE id = ?")
        .bind(reason, details || null, at, id).run();
      const ls = await env.DB.prepare("SELECT * FROM mk_listings WHERE seller_id = ? AND status IN ('review','live','ended','cancelled','rejected')").bind(id).all();
      let removed = 0;
      for (const l of ls.results || []) if (await takeDown(env, l, 'removed', 'account closed')) removed++;
      const bids = await windDown(env, u, 'closed');
      if (b.block) await env.DB.prepare('INSERT OR IGNORE INTO mk_blocked (hash, reason, created_at) VALUES (?, ?, ?)').bind(await emailHash(u.email), reason, at).run();
      await tell(env, user, 'admBanned', Object.assign(reasons(reason, details), { open: (await openOrders(env, id)) ? { k: 'admOpenOrdersBan' } : '' }));
      await admLog(env, actor, 'user', id, 'ban', reason, details, { listingsRemoved: removed, bidsRemoved: bids, blocked: !!b.block });
      return { ok: true, openOrders: await openOrders(env, id), removed };
    }
    case 'reinstate': {
      if (st.status === 'active') fail(409, 'This account is active already', 'adm_active');
      await env.DB.prepare('UPDATE users SET status = NULL, status_until = NULL, status_reason = NULL, status_note = NULL WHERE id = ?').bind(id).run();
      await env.DB.prepare('DELETE FROM mk_blocked WHERE hash = ?').bind(await emailHash(u.email)).run();
      await tell(env, user, 'admLifted', { what: { k: 'liftAccount' } });
      await admLog(env, actor, 'user', id, 'reinstate', null, clean(b.note || '', 500));
      return { ok: true };
    }
    case 'logout': {
      await env.DB.prepare('UPDATE users SET sessions_after = ? WHERE id = ?').bind(at, id).run();
      await admLog(env, actor, 'user', id, 'logout', null, clean(b.note || '', 500));
      return { ok: true };
    }
    case 'delete': {
      if (String(b.confirm || '').trim().toLowerCase() !== String(u.email).toLowerCase()) fail(400, 'Type the member\'s email address to confirm', 'adm_confirm');
      const reason = REASONS.indexOf(b.reason) !== -1 ? b.reason : 'request';
      const open = await openOrders(env, id);
      if (open) fail(409, 'This member still has ' + open + ' open order(s) — finish or cancel them first', 'adm_open_orders', { n: open });
      // the goodbye goes out while we still know where to send it
      await tell(env, user, 'admDeleted', { message: reason === 'request' ? '' : clean(b.details || '', 1500), why: { k: reason === 'request' ? 'delByRequest' : 'delByUs' } });
      const ls = await env.DB.prepare("SELECT * FROM mk_listings WHERE seller_id = ? AND status NOT IN ('sold','relisted')").bind(id).all();
      for (const l of ls.results || []) {
        await takeDown(env, l, 'removed', 'account deleted');
        await deletePhotos(env, 'listing_id', l.id);
      }
      await windDown(env, u, 'deleted');
      await env.DB.prepare('DELETE FROM mk_watch WHERE user_id = ?').bind(id).run();
      await env.DB.prepare('DELETE FROM mk_ticket_msgs WHERE ticket_id IN (SELECT id FROM mk_tickets WHERE user_id = ? OR LOWER(email) = LOWER(?))').bind(id, u.email).run();
      await env.DB.prepare('DELETE FROM mk_tickets WHERE user_id = ? OR LOWER(email) = LOWER(?)').bind(id, u.email).run();
      // published reviews stay, without a name or address; the rest goes
      const rv = await env.DB.prepare("SELECT id FROM fb_reviews WHERE (user_id = ? OR LOWER(email) = LOWER(?)) AND status != 'published'").bind(id, u.email).all();
      for (const x of rv.results || []) { await deletePhotos(env, 'review_id', x.id); await env.DB.prepare('DELETE FROM fb_reviews WHERE id = ?').bind(x.id).run(); }
      await env.DB.prepare("UPDATE fb_reviews SET name = 'Former customer', email = '', user_id = NULL, private_note = NULL WHERE user_id = ? OR LOWER(email) = LOWER(?)").bind(id, u.email).run();
      await env.DB.prepare('DELETE FROM email_tokens WHERE user_id = ?').bind(id).run();
      await env.DB.prepare(
        `UPDATE users SET name = 'Deleted member', email = ?, pw_salt = '', pw_hash = '', phone = NULL, address = NULL, city = NULL, postal = NULL,
           country = NULL, stripe_customer_id = NULL, email_verified_at = NULL, status = 'deleted', status_until = NULL, status_reason = ?,
           status_note = NULL, sessions_after = ?, listings_hidden = 1 WHERE id = ?`
      ).bind('deleted-' + id + '@deleted.invalid', reason, at, id).run();
      if (b.block) await env.DB.prepare('INSERT OR IGNORE INTO mk_blocked (hash, reason, created_at) VALUES (?, ?, ?)').bind(await emailHash(u.email), reason, at).run();
      await admLog(env, actor, 'user', id, 'delete', reason, reason === 'request' ? null : clean(b.details || '', 1500), { blocked: !!b.block });
      return { ok: true };
    }
    default: fail(400, 'Unknown action', 'bad_action');
  }
}
async function deletePhotos(env, col, id) {
  const ph = await env.DB.prepare('SELECT data, thumb FROM mk_photos WHERE ' + col + ' = ?').bind(id).all();
  if (env.VAULT_PHOTOS) {
    for (const p of ph.results || []) {
      for (const v of [p.data, p.thumb]) if (v && String(v).indexOf('r2:') === 0) { try { await env.VAULT_PHOTOS.delete(String(v).slice(3)); } catch (e) { /* gone already */ } }
    }
  }
  await env.DB.prepare('DELETE FROM mk_photos WHERE ' + col + ' = ?').bind(id).run();
}

/* ── listings ──────────────────────────────────────────────────────────── */
const L_FILTERS = {
  live: "l.status = 'live'", review: "l.status = 'review'", hidden: 'l.hidden_at IS NOT NULL', sold: "l.status = 'sold'",
  ended: "l.status IN ('ended','cancelled','rejected','relisted')", removed: "l.status = 'removed'", all: '1 = 1',
  reported: "EXISTS (SELECT 1 FROM mk_reports r WHERE r.kind = 'listing' AND r.target_id = l.id AND r.status = 'open')",
};
export async function listingList(env, q) {
  const f = L_FILTERS[q.get('f')] ? q.get('f') : 'live';
  const where = [L_FILTERS[f]], args = [];
  const text = clean(q.get('q') || '', 80);
  if (text) {
    const like = '%' + text.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
    where.push("((l.brand || ' ' || l.model) LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\' OR l.id = ?)");
    args.push(like, like, like, parseInt(text.replace(/^#/, ''), 10) || 0);
  }
  const page = Math.max(1, parseInt(q.get('page'), 10) || 1), per = 30;
  const w = where.join(' AND ');
  const total = (await env.DB.prepare('SELECT COUNT(*) AS n FROM mk_listings l LEFT JOIN users u ON u.id = l.seller_id WHERE ' + w).bind(...args).first()).n;
  const rows = await env.DB.prepare(
    `SELECT l.*, u.name AS seller_name, u.email AS seller_email, u.status AS seller_status, u.listings_hidden AS seller_hidden,
       (SELECT id FROM mk_photos p WHERE p.listing_id = l.id AND COALESCE(p.kind, '') != 'extra' ORDER BY idx LIMIT 1) AS photo_id,
       (SELECT COUNT(*) FROM mk_watch w WHERE w.listing_id = l.id) AS watchers,
       (SELECT COUNT(*) FROM mk_reports r WHERE r.kind = 'listing' AND r.target_id = l.id AND r.status = 'open') AS reports
     FROM mk_listings l LEFT JOIN users u ON u.id = l.seller_id WHERE ` + w + ' ORDER BY l.id DESC LIMIT ? OFFSET ?'
  ).bind(...args, per, (page - 1) * per).all();
  const counts = {};
  for (const k of Object.keys(L_FILTERS)) counts[k] = (await env.DB.prepare('SELECT COUNT(*) AS n FROM mk_listings l WHERE ' + L_FILTERS[k]).first()).n;
  return {
    listings: (rows.results || []).map((l) => ({
      id: l.id, title: listingTitle(l), brand: l.brand, model: l.model, size: l.size, cond: l.cond, description: l.description || '',
      status: l.status, format: l.format, tier: l.tier, price: l.price, bids: l.bids, watchers: l.watchers || 0, reports: l.reports || 0,
      hidden: !!l.hidden_at, hiddenReason: l.hidden_reason || null, sellerHidden: l.seller_hidden === 1 || ['suspended', 'banned'].indexOf(l.seller_status) !== -1,
      note: l.review_note || null, endsAt: l.ends_at, at: l.live_at || l.created_at, featured: !!(l.featured_until && l.featured_until > nowIso()),
      photo: l.photo_id ? '/api/market/photo?id=' + l.photo_id + '&s=t' : null,
      seller: { id: l.seller_id, name: l.seller_name, email: l.seller_email, status: l.seller_status || null },
    })),
    total, page, pages: Math.max(1, Math.ceil(total / per)), counts, filter: f,
  };
}
export async function listingAction(env, actor, id, b) {
  const l = await env.DB.prepare('SELECT * FROM mk_listings WHERE id = ?').bind(id).first();
  if (!l) fail(404, 'Listing not found', 'gone');
  const seller = await userById(env, l.seller_id);
  const title = listingTitle(l), at = nowIso();
  switch (String(b.action || '')) {
    case 'hide': {
      const { reason, details } = needReason(b);
      await env.DB.prepare('UPDATE mk_listings SET hidden_at = ?, hidden_reason = ?, updated_at = ? WHERE id = ?').bind(at, reason, at, id).run();
      await tell(env, seller, 'admListingHidden', Object.assign(reasons(reason, details), { title, url: '/vault-item.html?id=' + id }));
      await admLog(env, actor, 'listing', id, 'hide', reason, details);
      return { ok: true };
    }
    case 'unhide': {
      await env.DB.prepare('UPDATE mk_listings SET hidden_at = NULL, hidden_reason = NULL, updated_at = ? WHERE id = ?').bind(at, id).run();
      if (l.hidden_at) await tell(env, seller, 'admLifted', { what: { k: 'liftListing' }, title, url: '/vault-item.html?id=' + id });
      await admLog(env, actor, 'listing', id, 'unhide', null, clean(b.note || '', 500));
      return { ok: true };
    }
    case 'remove': {
      const { reason, details } = needReason(b);
      if (l.status === 'sold') fail(409, 'This pair is sold — handle it through its order', 'adm_sold');
      if (!(await takeDown(env, l, 'removed', details || reason))) fail(409, 'This listing cannot be removed any more', 'adm_sold');
      await tell(env, seller, 'admListingRemoved', Object.assign(reasons(reason, details), { title }));
      await admLog(env, actor, 'listing', id, 'remove', reason, details, { status: l.status, bids: l.bids });
      return { ok: true };
    }
    case 'edit': {
      const next = {
        brand: clean(b.brand || l.brand, 40), model: clean(b.model || l.model, 80), size: clean(b.size || l.size, 8),
        description: typeof b.description === 'string' ? clean(b.description, 2000) : l.description,
      };
      if (!next.brand || !next.model || !next.size) fail(400, 'Brand, model and size are needed', 'adm_edit');
      const changed = Object.keys(next).filter((k) => (next[k] || '') !== (l[k] || ''));
      if (!changed.length) return { ok: true, changed: 0 };
      await env.DB.prepare('UPDATE mk_listings SET brand = ?, model = ?, size = ?, description = ?, updated_at = ? WHERE id = ?')
        .bind(next.brand, next.model, next.size, next.description || null, at, id).run();
      const was = {}; changed.forEach((k) => { was[k] = l[k]; });
      await admLog(env, actor, 'listing', id, 'edit', null, changed.join(', '), { was });
      return { ok: true, changed: changed.length };
    }
    case 'note': {
      const note = clean(b.note || '', 1500);
      if (!note) fail(400, 'Write the note first', 'adm_note');
      await admLog(env, actor, 'listing', id, 'note', null, note);
      return { ok: true };
    }
    default: fail(400, 'Unknown action', 'bad_action');
  }
}

/* ── orders: refunds (in full or in part), cancelling, the payout ──────── */
// Refunds the buyer `amount`; with fromSeller, the same comes off the
// seller's payout (or back from it, when it has gone out already).
async function refundBuyer(env, o, amount, note, fromSeller) {
  const out = { how: 'manual', reversal: null };
  if (o.stripe_pi && env.STRIPE_SECRET_KEY) {
    const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM mk_events WHERE order_id = ? AND kind IN ('refund_sent','refund_part')").bind(o.id).first()).n;
    const r = await stripeApi(env, 'refunds', { payment_intent: o.stripe_pi, amount, 'metadata[vault_order]': String(o.id) }, { idem: 'vault-refund-' + o.id + '-' + n + '-' + amount });
    if (!r || !r.id) fail(502, (r && r.error && r.error.message) || 'Stripe did not accept the refund', 'adm_stripe');
    out.how = 'stripe';
    await env.DB.prepare('UPDATE mk_orders SET refund_ref = ? WHERE id = ?').bind(r.id, o.id).run();
    await logEvent(env, { orderId: o.id, kind: amount >= o.total - (o.refunded || 0) ? 'refund_sent' : 'refund_part', note: euroText(amount) + ' · ' + r.id });
  } else {
    await tellStudio(env, 'sRefund', { order: o.id, amount: { m: amount }, buyerEmail: ((await userById(env, o.buyer_id)) || {}).email || '#' + o.buyer_id, message: note || '' });
    await logEvent(env, { orderId: o.id, kind: 'refund_manual', note: euroText(amount) });
  }
  if (fromSeller) {
    const take = Math.min(amount, o.payout - (o.payout_reversed || 0));
    if (take > 0 && o.payout_status === 'sent' && o.payout_ref && connectOn(env)) {
      const rv = await stripeApi(env, 'transfers/' + encodeURIComponent(o.payout_ref) + '/reversals', { amount: take, 'metadata[vault_order]': String(o.id) },
        { idem: 'vault-reversal-' + o.id + '-' + (o.payout_reversed || 0) + '-' + take });
      if (rv && rv.id) {
        out.reversal = take;
        await env.DB.prepare('UPDATE mk_orders SET payout_reversed = COALESCE(payout_reversed, 0) + ? WHERE id = ?').bind(take, o.id).run();
        await logEvent(env, { orderId: o.id, kind: 'payout_reversed', note: euroText(take) + ' · ' + rv.id });
      } else {
        await logEvent(env, { orderId: o.id, kind: 'reversal_failed', note: (rv && rv.error && rv.error.message) || 'Stripe refused' });
      }
    } else if (take > 0 && o.payout_status !== 'sent') {
      // not paid out yet: the seller simply receives less
      await env.DB.prepare('UPDATE mk_orders SET payout = payout - ? WHERE id = ?').bind(take, o.id).run();
      out.reversal = take;
    }
  }
  await env.DB.prepare('UPDATE mk_orders SET refunded = COALESCE(refunded, 0) + ?, updated_at = ? WHERE id = ?').bind(amount, nowIso(), o.id).run();
  return out;
}
const euroText = (c) => '€' + (c / 100).toFixed(2);

export async function orderAction(env, actor, o, b) {
  const at = nowIso();
  const l = await env.DB.prepare('SELECT * FROM mk_listings WHERE id = ?').bind(o.listing_id).first();
  const title = l ? listingTitle(l) : '#' + o.id;
  const buyer = await userById(env, o.buyer_id), seller = await userById(env, o.seller_id);
  const note = clean(b.note || '', 1500);
  switch (String(b.action || '')) {
    case 'refund': {
      if (PAID_STEPS.indexOf(o.status) === -1) fail(409, 'Only paid orders can be refunded', 'adm_unpaid');
      const left = o.total - (o.refunded || 0);
      const amount = b.full ? left : Math.round(Number(b.amount) * 100);
      if (!(amount > 0) || amount > left) fail(400, 'Refund between €0.01 and ' + euroText(left), 'adm_amount', { max: left });
      if (note.length < 5) fail(400, 'Write the reason — the buyer reads it', 'note_needed');
      const full = amount === left;
      const res = await refundBuyer(env, o, amount, note, !!b.fromSeller);
      if (full) {
        const before = ['paid', 'to_lab', 'in_lab', 'verified'].indexOf(o.status) !== -1;
        await env.DB.prepare("UPDATE mk_orders SET status = 'refunded', payout_status = CASE WHEN payout_status = 'sent' THEN payout_status ELSE 'cancelled' END, updated_at = ? WHERE id = ?").bind(at, o.id).run();
        await logEvent(env, { orderId: o.id, kind: 'refunded', note });
        // the pair never left the seller: they may put it on sale again
        if (before) await env.DB.prepare("UPDATE mk_listings SET status = 'ended', updated_at = ? WHERE id = ? AND status = 'sold'").bind(at, o.listing_id).run();
      }
      await tell(env, buyer, 'admRefund', { order: o.id, title, amount: { m: amount }, message: note,
        how: { k: res.how === 'stripe' ? 'refundStripe' : 'refundBank' }, which: { k: full ? 'refundFull' : 'refundPart' } });
      if (res.reversal || full) {
        await tell(env, seller, 'admRefundSeller', { order: o.id, title, amount: { m: amount }, message: note,
          cut: res.reversal ? { k: 'refundCut' } : '', cutAmount: res.reversal ? { m: res.reversal } : '' });
      }
      await admLog(env, actor, 'order', o.id, 'refund', null, note, { amount, full, how: res.how, fromSeller: !!b.fromSeller, reversal: res.reversal });
      return { ok: true, how: res.how, reversal: res.reversal };
    }
    case 'cancel': {
      if (['awaiting_payment', 'paid', 'to_lab', 'in_lab', 'verified'].indexOf(o.status) === -1) fail(409, 'Orders that have shipped cannot be cancelled — refund them instead', 'adm_shipped');
      if (note.length < 5) fail(400, 'Write the reason — both sides read it', 'note_needed');
      const paid = o.status !== 'awaiting_payment';
      const left = o.total - (o.refunded || 0);
      let how = null;
      if (paid && left > 0) how = (await refundBuyer(env, o, left, note, false)).how;
      const r = await env.DB.prepare("UPDATE mk_orders SET status = 'cancelled', payout_status = 'cancelled', updated_at = ? WHERE id = ? AND status = ?").bind(at, o.id, o.status).run();
      if (!r.meta.changes) fail(409, 'The order changed meanwhile — reload and try again', 'wrong_step');
      await env.DB.prepare("UPDATE mk_listings SET status = 'ended', updated_at = ? WHERE id = ? AND status = 'sold'").bind(at, o.listing_id).run();
      await logEvent(env, { orderId: o.id, kind: 'cancelled', note });
      const refund = how ? { k: how === 'stripe' ? 'cancelRefundStripe' : 'cancelRefundBank' } : '';
      await tell(env, buyer, 'admOrderCancelled', { order: o.id, title, message: note, refund, refundAmount: how ? { m: left } : '', relist: '', url: '/vault-me.html#buying' });
      await tell(env, seller, 'admOrderCancelled', { order: o.id, title, message: note, refund: '', refundAmount: '', relist: { k: 'admRelist' }, url: '/vault-me.html#selling' });
      await admLog(env, actor, 'order', o.id, 'cancel', null, note, { refunded: how ? left : 0, how });
      return { ok: true, how };
    }
    case 'hold': {
      if (o.payout_status === 'sent') fail(409, 'The payout has gone out already', 'adm_paid_out');
      if (note.length < 5) fail(400, 'Write why the payout waits', 'note_needed');
      await env.DB.prepare('UPDATE mk_orders SET payout_hold = 1, updated_at = ? WHERE id = ?').bind(at, o.id).run();
      await logEvent(env, { orderId: o.id, kind: 'payout_held', note });
      await admLog(env, actor, 'order', o.id, 'hold', null, note);
      return { ok: true };
    }
    case 'unhold': {
      await env.DB.prepare('UPDATE mk_orders SET payout_hold = 0, updated_at = ? WHERE id = ?').bind(at, o.id).run();
      await logEvent(env, { orderId: o.id, kind: 'payout_unheld', note: note || null });
      let payout = null;
      if (o.status === 'delivered' && o.payout_status === 'held') {
        await env.DB.prepare("UPDATE mk_orders SET payout_status = NULL WHERE id = ? AND payout_status = 'held'").bind(o.id).run();
        const fresh = await env.DB.prepare('SELECT * FROM mk_orders WHERE id = ?').bind(o.id).first();
        payout = await releasePayout(env, fresh, 'retry');
      }
      await admLog(env, actor, 'order', o.id, 'unhold', null, note, { payout });
      return { ok: true, payout };
    }
    case 'note': {
      if (!note) fail(400, 'Write the note first', 'adm_note');
      await logEvent(env, { orderId: o.id, kind: 'note', note });
      await admLog(env, actor, 'order', o.id, 'note', null, note);
      return { ok: true };
    }
    default: fail(400, 'Unknown action', 'bad_action');
  }
}

/* ── reports (DSA Art. 16) ─────────────────────────────────────────────── */
function reportRow(r) {
  return { id: r.id, kind: r.kind, target: r.target_id, reason: r.reason, details: r.details, status: r.status, decision: r.decision || null,
    answer: r.answer || null, reporter: { id: r.reporter_id, name: r.reporter_name, email: r.reporter_email }, orderId: r.order_id || null,
    at: r.created_at, handledAt: r.handled_at || null, handledBy: r.handled_by || null, label: r.label || null };
}
export async function createReport(env, me, b) {
  const kind = b.kind === 'user' ? 'user' : b.kind === 'listing' ? 'listing' : null;
  const id = parseInt(b.id, 10);
  if (!kind || !id) fail(400, 'What are you reporting?', 'rp_target');
  const reason = REPORT_REASONS.indexOf(b.reason) !== -1 ? b.reason : null;
  if (!reason) fail(400, 'Choose a reason', 'rp_reason');
  const details = clean(b.details || '', 2000);
  if (details.length < 15) fail(400, 'Tell us a little more — at least a sentence', 'rp_details');
  // the terms (§ 13) ask the reporter to confirm it is true to the best of their knowledge (DSA Art. 16)
  if (b.accurate !== true) fail(400, 'Confirm that your report is accurate', 'rp_accurate');
  let label, orderId = null;
  if (kind === 'listing') {
    const l = await env.DB.prepare('SELECT * FROM mk_listings WHERE id = ?').bind(id).first();
    if (!l || ['review', 'rejected'].indexOf(l.status) !== -1) fail(404, 'This listing does not exist', 'gone');
    if (me && l.seller_id === me.id) fail(400, 'This is your own listing', 'own');
    label = listingTitle(l);
  } else {
    // a member is reported from an order the two of you share
    orderId = parseInt(b.orderId, 10);
    const o = orderId && await env.DB.prepare('SELECT * FROM mk_orders WHERE id = ?').bind(orderId).first();
    if (!me || !o || (o.buyer_id !== me.id && o.seller_id !== me.id) || [o.buyer_id, o.seller_id].indexOf(id) === -1 || id === me.id) fail(404, 'This member cannot be reported from here', 'gone');
    const u = await userById(env, id);
    label = u ? shortName(u.name) : '#' + id;
  }
  let name, email;
  if (me) { name = me.name; email = me.email; }
  else {
    name = clean(b.name || '', 80); email = clean(b.email || '', 254).toLowerCase();
    if (!name) fail(400, 'Add your name', 'rv_name');
    if (!validEmail(email)) fail(400, 'Add a valid email address', 'rv_email');
  }
  const dup = await env.DB.prepare("SELECT id FROM mk_reports WHERE kind = ? AND target_id = ? AND LOWER(reporter_email) = LOWER(?) AND status = 'open'").bind(kind, id, email).first();
  if (dup) return { id: dup.id, again: true };
  const res = await env.DB.prepare(
    "INSERT INTO mk_reports (kind, target_id, order_id, reason, details, reporter_id, reporter_name, reporter_email, lang, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)"
  ).bind(kind, id, orderId, reason, details, me ? me.id : null, name, email, (me && me.lang) || clean(b.lang || '', 5) || 'en', nowIso()).run();
  const rid = res.meta.last_row_id;
  const reporter = me || { id: null, name, email, lang: clean(b.lang || '', 5) || 'en' };
  await tell(env, reporter, 'reportReceived', { report: rid, what: label, reason: { k: 'rp_' + reason } });
  await tellStudio(env, 'sReport', { report: rid, kind: { k: kind === 'listing' ? 'rpListing' : 'rpMember' }, what: label, reason: { k: 'rp_' + reason },
    url: '/vault-lab.html#reports', message: details, rows: [['rpWhat', label], ['rpWhy', { k: 'rp_' + reason }], ['customer', name + ' <' + email + '>']] }, email);
  return { id: rid };
}
export async function reportList(env, q) {
  const f = q.get('f') === 'done' ? 'done' : 'open';
  const rows = await env.DB.prepare(
    `SELECT r.*,
       CASE r.kind WHEN 'listing' THEN (SELECT brand || ' ' || model FROM mk_listings WHERE id = r.target_id) ELSE (SELECT name FROM users WHERE id = r.target_id) END AS label
     FROM mk_reports r WHERE ` + (f === 'open' ? "r.status = 'open' ORDER BY r.id ASC" : "r.status != 'open' ORDER BY r.handled_at DESC") + ' LIMIT 60'
  ).all();
  const out = [];
  for (const r of rows.results || []) {
    const v = reportRow(r);
    if (r.kind === 'listing') {
      const l = await env.DB.prepare(
        `SELECT l.id, l.brand, l.model, l.size, l.status, l.price, l.hidden_at, l.seller_id, u.name AS seller_name, u.email AS seller_email,
           (SELECT id FROM mk_photos p WHERE p.listing_id = l.id AND COALESCE(p.kind, '') != 'extra' ORDER BY idx LIMIT 1) AS photo_id
         FROM mk_listings l LEFT JOIN users u ON u.id = l.seller_id WHERE l.id = ?`
      ).bind(r.target_id).first();
      if (l) v.listing = { id: l.id, title: listingTitle(l), size: l.size, status: l.status, price: l.price, hidden: !!l.hidden_at,
        photo: l.photo_id ? '/api/market/photo?id=' + l.photo_id + '&s=t' : null, seller: { id: l.seller_id, name: l.seller_name, email: l.seller_email } };
    } else {
      const u = await env.DB.prepare('SELECT id, name, email, status FROM users WHERE id = ?').bind(r.target_id).first();
      if (u) v.member = { id: u.id, name: u.name, email: u.email, status: u.status || null };
    }
    const others = await env.DB.prepare("SELECT COUNT(*) AS n FROM mk_reports WHERE kind = ? AND target_id = ? AND id != ?").bind(r.kind, r.target_id, r.id).first();
    v.others = others ? others.n : 0;
    out.push(v);
  }
  const open = (await env.DB.prepare("SELECT COUNT(*) AS n FROM mk_reports WHERE status = 'open'").first()).n;
  return { reports: out, open, filter: f };
}
export async function decideReport(env, actor, id, b) {
  const r = await env.DB.prepare('SELECT * FROM mk_reports WHERE id = ?').bind(id).first();
  if (!r) fail(404, 'Report not found', 'gone');
  if (r.status !== 'open') fail(409, 'This report has been answered already', 'rp_done');
  const decision = b.decision === 'actioned' ? 'actioned' : b.decision === 'dismissed' ? 'dismissed' : null;
  if (!decision) fail(400, 'Choose a decision', 'bad_action');
  const answer = clean(b.answer || '', 1500);
  const at = nowIso();
  await env.DB.prepare('UPDATE mk_reports SET status = ?, decision = ?, answer = ?, handled_at = ?, handled_by = ? WHERE id = ?')
    .bind(decision, decision, answer || null, at, actor.name, id).run();
  let label = '#' + r.target_id;
  if (r.kind === 'listing') { const l = await env.DB.prepare('SELECT brand, model FROM mk_listings WHERE id = ?').bind(r.target_id).first(); if (l) label = listingTitle(l); }
  else { const u = await userById(env, r.target_id); if (u) label = shortName(u.name); }
  await tell(env, { id: r.reporter_id, name: r.reporter_name, email: r.reporter_email, lang: r.lang }, 'reportDecided', {
    report: r.id, what: label, outcome: { k: decision === 'actioned' ? 'rpActioned' : 'rpDismissed' }, message: answer,
  });
  await admLog(env, actor, 'report', id, decision, r.reason, answer, { kind: r.kind, target: r.target_id });
  return { ok: true };
}

/* ── the overview at the top of the Members tab ────────────────────────── */
export async function adminOverview(env) {
  const now = nowIso(), week = new Date(Date.now() - 7 * 86400000).toISOString(), month = new Date(Date.now() - 30 * 86400000).toISOString();
  return env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM users WHERE COALESCE(status, '') != 'deleted') AS members,
            (SELECT COUNT(*) FROM users WHERE created_at > ?) AS new_week,
            (SELECT COUNT(DISTINCT seller_id) FROM mk_listings WHERE status = 'live') AS active_sellers,
            (SELECT COUNT(*) FROM users WHERE status = 'suspended' AND status_until > ?) AS suspended,
            (SELECT COUNT(*) FROM users WHERE status = 'banned') AS banned,
            (SELECT COUNT(*) FROM mk_reports WHERE status = 'open') AS reports,
            (SELECT COALESCE(SUM(total), 0) FROM mk_orders WHERE created_at > ? AND status NOT IN ('awaiting_payment','cancelled')) AS gmv_month,
            (SELECT COALESCE(SUM(refunded), 0) FROM mk_orders WHERE updated_at > ?) AS refunded_month`
  ).bind(week, now, month, month).first();
}

/* ── housekeeping: suspensions that have run out end by themselves ─────── */
let lastLift = 0;
export async function adminHousekeeping(env) {
  if (Date.now() - lastLift < 60000) return;
  lastLift = Date.now();
  const now = nowIso();
  const due = await env.DB.prepare("SELECT id, name, email, lang FROM users WHERE status = 'suspended' AND status_until <= ? LIMIT 20").bind(now).all();
  for (const u of due.results || []) {
    const r = await env.DB.prepare("UPDATE users SET status = NULL, status_until = NULL, status_reason = NULL, status_note = NULL WHERE id = ? AND status = 'suspended'").bind(u.id).run();
    if (!r.meta.changes) continue;
    await tell(env, u, 'admLifted', { what: { k: 'liftAccount' } });
    await admLog(env, null, 'user', u.id, 'suspension_ended');
  }
}
