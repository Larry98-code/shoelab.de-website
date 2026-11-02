// ShoeLab — reviews and the satisfaction survey, for everything ShoeLab does:
// the studio (cleaning bookings), the Vault (buying and selling), the Legit
// Check and the shop. Plus private ideas ("Help shape ShoeLab").
//
// A review is "verified" when it is tied to something its writer really did
// with ShoeLab: their own booking, Vault order or Legit Check. Reviews
// without that link are allowed and shown as not verified.
//
// Every review waits for a specialist, who publishes it, or rejects it only
// for a stated legal reason (insults, personal data, spam, nothing to do with
// ShoeLab, a duplicate). Positive and negative reviews are treated alike —
// the page says so, as German law expects (§ 5b UWG).
//
// Survey emails are advertising under German law unless the customer agreed:
// only bookings whose customer ticked "ask me for feedback" get an invitation,
// the day after the appointment. Everyone else finds the survey in My Vault,
// on the reviews page, or on the card handed back in the studio.
import { clean, validEmail, signSession, verifySession, sessionSecret } from './util.js';
import { nowIso, shortName, userById, tell, tellStudio, listingTitle, LAB } from './vault.js';

export const TOPICS = ['studio', 'vault_buy', 'vault_sell', 'legit', 'shop', 'other'];
// what each kind of service is rated on, beyond the overall score
export const ASPECTS = {
  studio: ['result', 'service', 'value', 'speed'],
  vault_buy: ['described', 'shipping', 'contact', 'ease'],
  vault_sell: ['review', 'payout', 'contact', 'ease'],
  legit: ['speed', 'clarity', 'value', 'ease'],
  shop: ['quality', 'shipping', 'value', 'ease'],
  other: [],
};
export const IDEA_TOPICS = ['studio', 'vault', 'legit', 'shop', 'website', 'other'];
export const REJECT_REASONS = ['spam', 'offensive', 'personal', 'offtopic', 'duplicate'];
const REF_TOPIC = { booking: 'studio', buy: 'vault_buy', sell: 'vault_sell', legit: 'legit' };
const PER_PAGE = 12;
const INVITE_DAYS = 14;              // invitations go out up to two weeks after the appointment

// a few reviews and ideas a day per person (or per network, for guests);
// only what was actually sent counts (count: true after it went through)
export async function allowed(env, request, me, what, limit, count) {
  let key = me ? 'u' + me.id : null;
  if (!key) {
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('shoelab-reviews:' + ip));
    key = 'ip' + Array.from(new Uint8Array(h).slice(0, 8), (x) => x.toString(16).padStart(2, '0')).join('');
  }
  key = what + ':' + key;
  const day = nowIso().slice(0, 10);
  if (count) {
    await env.DB.prepare('INSERT INTO support_usage (k, day, n) VALUES (?, ?, 1) ON CONFLICT(k, day) DO UPDATE SET n = n + 1').bind(key, day).run();
    return true;
  }
  const row = await env.DB.prepare('SELECT n FROM support_usage WHERE k = ? AND day = ?').bind(key, day).first();
  return !row || row.n < limit;
}

const parse = (s, d) => { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } };
const today = () => nowIso().slice(0, 10);

/* ── what a person can review, verified ──────────────────────────────────── */
// ref: "booking-12", "buy-5", "sell-5", "legit-3"
export function parseRef(v) {
  const m = /^(booking|buy|sell|legit)-(\d{1,9})$/.exec(String(v || ''));
  return m ? { kind: m[1], id: +m[2] } : null;
}
// The things this person did with ShoeLab that they have not reviewed yet.
export async function eligible(env, me) {
  if (!me) return [];
  const out = [];
  const done = new Set(((await env.DB.prepare("SELECT ref_kind, ref_id FROM fb_reviews WHERE kind = 'review' AND ref_kind IS NOT NULL AND user_id = ?").bind(me.id).all()).results || [])
    .map((r) => r.ref_kind + '-' + r.ref_id));
  const bk = await env.DB.prepare(
    "SELECT id, service, date FROM bookings WHERE LOWER(email) = LOWER(?) AND COALESCE(status, '') != 'cancelled' AND date <= ? ORDER BY date DESC LIMIT 10"
  ).bind(me.email, today()).all();
  for (const b of bk.results || []) out.push({ ref: 'booking-' + b.id, topic: 'studio', label: b.service || 'ShoeLab', date: b.date });
  const ord = await env.DB.prepare(
    `SELECT o.id, o.buyer_id, o.seller_id, o.status, o.updated_at, l.brand, l.model FROM mk_orders o JOIN mk_listings l ON l.id = o.listing_id
     WHERE (o.buyer_id = ? AND o.status IN ('shipped','delivered')) OR (o.seller_id = ? AND o.status = 'delivered') ORDER BY o.id DESC LIMIT 10`
  ).bind(me.id, me.id).all();
  for (const o of ord.results || []) {
    const side = o.buyer_id === me.id ? 'buy' : 'sell';
    out.push({ ref: side + '-' + o.id, topic: side === 'buy' ? 'vault_buy' : 'vault_sell', label: listingTitle(o) + ' · #' + o.id, date: (o.updated_at || '').slice(0, 10) });
  }
  const lg = await env.DB.prepare("SELECT id, brand, model, decided_at FROM mk_legit WHERE user_id = ? AND status = 'done' ORDER BY id DESC LIMIT 10").bind(me.id).all();
  for (const g of lg.results || []) out.push({ ref: 'legit-' + g.id, topic: 'legit', label: listingTitle(g) + ' · LC-' + g.id, date: (g.decided_at || '').slice(0, 10) });
  return out.filter((x) => !done.has(x.ref));
}

// Is this booking/order/check theirs? → { topic, label } or null
async function ownRef(env, ref, me, invite) {
  if (ref.kind === 'booking') {
    const b = await env.DB.prepare('SELECT id, email, service, date, first_name, last_name FROM bookings WHERE id = ?').bind(ref.id).first();
    if (!b || (b.date || '') > today()) return null;
    const mine = (me && b.email && b.email.toLowerCase() === String(me.email).toLowerCase()) ||
      (invite && invite.r === 'booking' && invite.id === b.id && String(invite.e || '').toLowerCase() === String(b.email || '').toLowerCase());
    return mine ? { topic: 'studio', label: b.service || 'ShoeLab', booking: b } : null;
  }
  if (!me) return null;
  if (ref.kind === 'buy' || ref.kind === 'sell') {
    const o = await env.DB.prepare('SELECT o.*, l.brand, l.model FROM mk_orders o JOIN mk_listings l ON l.id = o.listing_id WHERE o.id = ?').bind(ref.id).first();
    if (!o) return null;
    if (ref.kind === 'buy' && o.buyer_id === me.id && ['shipped', 'delivered'].indexOf(o.status) !== -1) return { topic: 'vault_buy', label: listingTitle(o) + ' · #' + o.id };
    if (ref.kind === 'sell' && o.seller_id === me.id && o.status === 'delivered') return { topic: 'vault_sell', label: listingTitle(o) + ' · #' + o.id };
    return null;
  }
  const g = await env.DB.prepare('SELECT id, user_id, status, brand, model FROM mk_legit WHERE id = ?').bind(ref.id).first();
  return g && g.user_id === me.id && g.status === 'done' ? { topic: 'legit', label: listingTitle(g) + ' · LC-' + g.id } : null;
}

// A booking customer who agreed to be asked can review without an account,
// with the signed link from their invitation.
export async function inviteToken(env, b) {
  return signSession({ r: 'booking', id: b.id, e: String(b.email || '').toLowerCase(), exp: Date.now() + 60 * 86400000 }, sessionSecret(env));
}
export async function readInvite(env, k) {
  if (!k) return null;
  const p = await verifySession(String(k), sessionSecret(env));
  return p && p.r === 'booking' ? p : null;
}

/* ── writing ─────────────────────────────────────────────────────────────── */
// → { id } or { error, code, status }
export async function submitReview(env, me, b, photosSaver) {
  const err = (status, error, code, extra) => Object.assign({ error, code, status }, extra || {});
  const ref = b.ref ? parseRef(b.ref) : null;
  if (b.ref && !ref) return err(400, 'That link is not valid', 'rv_ref');
  const invite = await readInvite(env, b.k);
  let topic = TOPICS.indexOf(b.topic) !== -1 ? b.topic : null, label = null, verified = 0, booking = null;
  if (ref) {
    const own = await ownRef(env, ref, me, invite);
    if (!own) return err(403, 'This is not yours to review', 'rv_not_yours');
    topic = own.topic; label = own.label; verified = 1; booking = own.booking || null;
    const dup = await env.DB.prepare("SELECT id FROM fb_reviews WHERE kind = 'review' AND ref_kind = ? AND ref_id = ?").bind(ref.kind, ref.id).first();
    if (dup) return err(409, 'You have reviewed this already', 'rv_done');
  }
  if (!topic) return err(400, 'Choose what you are reviewing', 'rv_topic');
  const rating = parseInt(b.rating, 10);
  if (!(rating >= 1 && rating <= 5)) return err(400, 'Choose a rating', 'rv_rating');
  const aspects = {};
  (ASPECTS[topic] || []).forEach((a) => { const v = parseInt(b.aspects && b.aspects[a], 10); if (v >= 1 && v <= 5) aspects[a] = v; });
  let nps = b.nps === '' || b.nps == null ? null : parseInt(b.nps, 10);
  if (nps != null && !(nps >= 0 && nps <= 10)) nps = null;
  const publish = b.publish === false ? 0 : 1;
  const title = clean(b.title || '', 90), body = clean(b.body || '', 2000), note = clean(b.note || '', 1000);
  if (publish && body.length < 20) return err(400, 'Write at least a couple of sentences', 'rv_body');
  if (!publish && !body && !note) return err(400, 'Tell us a little more', 'rv_body');
  // who is writing
  let name, email, userId = me ? me.id : null, lang = (me && me.lang) || clean(b.lang || '', 5) || 'en';
  if (me) { name = shortName(me.name); email = me.email; }
  else if (booking) { name = shortName((booking.first_name || '') + ' ' + (booking.last_name || '')); email = booking.email; }
  else {
    name = shortName(clean(b.name || '', 60));
    email = clean(b.email || '', 254).toLowerCase();
    if (!name || name === 'Member') return err(400, 'Add your name', 'rv_name');
    if (!validEmail(email)) return err(400, 'Add a valid email address', 'rv_email');
  }
  const at = nowIso();
  let res;
  try {
    res = await env.DB.prepare(
      `INSERT INTO fb_reviews (kind, topic, ref_kind, ref_id, ref_label, verified, user_id, name, email, lang, rating, aspects, nps, title, body, private_note, publish, status, created_at, updated_at)
       VALUES ('review', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    ).bind(topic, ref ? ref.kind : null, ref ? ref.id : null, label, verified, userId, name, email, lang, rating,
      JSON.stringify(aspects), nps, title || null, body || null, note || null, publish, at, at).run();
  } catch (e) {
    return err(409, 'You have reviewed this already', 'rv_done');
  }
  const id = res.meta.last_row_id;
  const photos = publish && photosSaver ? await photosSaver(id) : 0;
  await tellStudio(env, 'sReviewNew', {
    stars: '★'.repeat(rating) + '☆'.repeat(5 - rating), topic: { k: 't_' + topic }, url: LAB + '#reviews',
    message: [title, body].filter(Boolean).join('\n\n') || note,
    rows: [['topic', { k: 't_' + topic }], ['rated', rating + '/5'], ['nps', nps == null ? '' : nps + '/10'],
      ['verifiedRow', { k: verified ? 'yes' : 'no' }], ['customer', name + ' <' + email + '>'],
      ['publicRow', { k: publish ? 'yes' : 'no' }], ['photosRow', photos ? String(photos) : ''], ['privateNote', note || '']],
  }, email);
  return { id, verified: !!verified, photos };
}

export async function submitIdea(env, me, b) {
  const topic = IDEA_TOPICS.indexOf(b.topic) !== -1 ? b.topic : 'other';
  const body = clean(b.body || '', 2000);
  if (body.length < 10) return { error: 'Tell us a little more', code: 'idea_body', status: 400 };
  let email = me ? me.email : clean(b.email || '', 254).toLowerCase();
  if (email && !validEmail(email)) return { error: 'Add a valid email address', code: 'rv_email', status: 400 };
  const name = me ? shortName(me.name) : (clean(b.name || '', 60) || null);
  const at = nowIso();
  const r = await env.DB.prepare(
    "INSERT INTO fb_reviews (kind, topic, user_id, name, email, lang, body, status, publish, created_at, updated_at) VALUES ('idea', ?, ?, ?, ?, ?, ?, 'new', 0, ?, ?)"
  ).bind(topic, me ? me.id : null, name, email || null, (me && me.lang) || clean(b.lang || '', 5) || 'en', body, at, at).run();
  await tellStudio(env, 'sIdea', {
    topic: { k: 'it_' + topic }, url: LAB + '#reviews', message: body,
    rows: [['topic', { k: 'it_' + topic }], ['customer', (name || '—') + (email ? ' <' + email + '>' : '')]],
  }, email || undefined);
  return { id: r.meta.last_row_id };
}

/* ── reading ─────────────────────────────────────────────────────────────── */
async function photosOf(env, ids) {
  if (!ids.length) return {};
  const r = await env.DB.prepare('SELECT id, review_id FROM mk_photos WHERE review_id IN (' + ids.map(() => '?').join(',') + ') ORDER BY idx, id').bind(...ids).all();
  const by = {};
  (r.results || []).forEach((p) => { (by[p.review_id] = by[p.review_id] || []).push({ id: p.id, url: '/api/market/photo?id=' + p.id, kind: 'other' }); });
  return by;
}
function publicView(r, photos) {
  return {
    id: r.id, topic: r.topic, name: r.name, verified: !!r.verified, refLabel: r.verified ? r.ref_label : null, refKind: r.verified ? r.ref_kind : null,
    rating: r.rating, aspects: parse(r.aspects, {}), recommend: r.nps != null ? r.nps >= 9 : null,
    title: r.title, body: r.body, photos: photos || [], reply: r.reply, replyAt: r.reply_at, at: r.published_at || r.created_at,
  };
}
// The public wall: published reviews, with the summary of all of them.
export async function listReviews(env, q) {
  const where = ["kind = 'review'", "status = 'published'", 'publish = 1'], args = [];
  const topic = q.get('topic');
  if (topic === 'vault') where.push("topic IN ('vault_buy','vault_sell')");
  else if (TOPICS.indexOf(topic) !== -1) { where.push('topic = ?'); args.push(topic); }
  const stars = parseInt(q.get('stars'), 10);
  if (stars >= 1 && stars <= 5) { where.push('rating = ?'); args.push(stars); }
  if (q.get('photos') === '1') where.push('EXISTS (SELECT 1 FROM mk_photos p WHERE p.review_id = fb_reviews.id)');
  if (q.get('verified') === '1') where.push('verified = 1');
  const ORDER = { new: 'published_at DESC, id DESC', high: 'rating DESC, published_at DESC', low: 'rating ASC, published_at DESC' };
  const sort = ORDER[q.get('sort')] ? q.get('sort') : 'new';
  const page = Math.max(1, parseInt(q.get('page'), 10) || 1);
  const w = where.join(' AND ');
  const total = (await env.DB.prepare('SELECT COUNT(*) AS n FROM fb_reviews WHERE ' + w).bind(...args).first()).n;
  const rows = ((await env.DB.prepare('SELECT * FROM fb_reviews WHERE ' + w + ' ORDER BY ' + ORDER[sort] + ' LIMIT ? OFFSET ?')
    .bind(...args, PER_PAGE, (page - 1) * PER_PAGE).all()).results || []);
  const ph = await photosOf(env, rows.map((r) => r.id));
  return { items: rows.map((r) => publicView(r, ph[r.id])), total, page, per: PER_PAGE, summary: await summary(env) };
}
async function summary(env) {
  const all = ((await env.DB.prepare("SELECT topic, rating, aspects, nps, verified FROM fb_reviews WHERE kind = 'review' AND status = 'published' AND publish = 1").all()).results || []);
  const dist = [0, 0, 0, 0, 0], topics = {}, aspects = {};
  let sum = 0, rec = 0, recN = 0, verified = 0;
  all.forEach((r) => {
    dist[r.rating - 1]++; sum += r.rating;
    if (r.verified) verified++;
    if (r.nps != null) { recN++; if (r.nps >= 9) rec++; }
    const t = r.topic === 'vault_buy' || r.topic === 'vault_sell' ? 'vault' : r.topic;
    topics[t] = topics[t] || { n: 0, sum: 0 }; topics[t].n++; topics[t].sum += r.rating;
    const a = parse(r.aspects, {});
    Object.keys(a).forEach((k) => { aspects[k] = aspects[k] || { n: 0, sum: 0 }; aspects[k].n++; aspects[k].sum += a[k]; });
  });
  const avg = (x) => (x.n ? Math.round((x.sum / x.n) * 10) / 10 : null);
  const tt = {}; Object.keys(topics).forEach((k) => { tt[k] = { n: topics[k].n, avg: avg(topics[k]) }; });
  const aa = {}; Object.keys(aspects).forEach((k) => { aa[k] = avg(aspects[k]); });
  return {
    count: all.length, avg: all.length ? Math.round((sum / all.length) * 10) / 10 : null, dist,
    recommend: recN ? Math.round((rec / recN) * 100) : null, verified, topics: tt, aspects: aa,
  };
}

/* ── the studio's side ───────────────────────────────────────────────────── */
export async function reviewQueue(env) {
  const pend = ((await env.DB.prepare("SELECT * FROM fb_reviews WHERE kind = 'review' AND status = 'pending' ORDER BY id ASC LIMIT 60").all()).results || []);
  const recent = ((await env.DB.prepare("SELECT * FROM fb_reviews WHERE kind = 'review' AND status != 'pending' ORDER BY COALESCE(published_at, updated_at) DESC LIMIT 20").all()).results || []);
  const ideas = ((await env.DB.prepare("SELECT * FROM fb_reviews WHERE kind = 'idea' ORDER BY CASE status WHEN 'new' THEN 0 ELSE 1 END, id DESC LIMIT 50").all()).results || []);
  const ph = await photosOf(env, pend.concat(recent).map((r) => r.id));
  const full = (r) => Object.assign(publicView(r, ph[r.id]), {
    status: r.status, publish: !!r.publish, email: r.email, nps: r.nps, note: r.private_note, rejectReason: r.reject_reason,
    createdAt: r.created_at, refKindAny: r.ref_kind, refLabelAny: r.ref_label,
  });
  // satisfaction over the last 90 days, from every answer (published or not)
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  const rows = ((await env.DB.prepare("SELECT topic, rating, nps FROM fb_reviews WHERE kind = 'review' AND status != 'rejected' AND created_at > ?").bind(since).all()).results || []);
  const by = {}; let promoters = 0, detractors = 0, npsN = 0, sum = 0;
  rows.forEach((r) => {
    sum += r.rating; by[r.topic] = by[r.topic] || { n: 0, sum: 0 }; by[r.topic].n++; by[r.topic].sum += r.rating;
    if (r.nps != null) { npsN++; if (r.nps >= 9) promoters++; else if (r.nps <= 6) detractors++; }
  });
  const topics = {}; Object.keys(by).forEach((k) => { topics[k] = { n: by[k].n, avg: Math.round((by[k].sum / by[k].n) * 10) / 10 }; });
  return {
    pending: pend.map(full), recent: recent.map(full),
    ideas: ideas.map((r) => ({ id: r.id, topic: r.topic, name: r.name, email: r.email, body: r.body, status: r.status, at: r.created_at })),
    stats: {
      n: rows.length, avg: rows.length ? Math.round((sum / rows.length) * 10) / 10 : null,
      nps: npsN ? Math.round(((promoters - detractors) / npsN) * 100) : null, npsN, topics,
      newIdeas: ideas.filter((i) => i.status === 'new').length,
    },
  };
}
// publish | reject (with a reason) | unpublish; an optional public reply
export async function moderate(env, id, action, reason, reply) {
  const r = await env.DB.prepare("SELECT * FROM fb_reviews WHERE id = ? AND kind = 'review'").bind(id).first();
  if (!r) return { error: 'Review not found', code: 'not_found', status: 404 };
  const at = nowIso(), rep = clean(reply || '', 1500) || null;
  if (action === 'publish') {
    if (!r.publish) return { error: 'The customer asked us not to publish this one', code: 'rv_private', status: 409 };
    await env.DB.prepare("UPDATE fb_reviews SET status = 'published', published_at = COALESCE(published_at, ?), reject_reason = NULL, reply = COALESCE(?, reply), reply_at = CASE WHEN ? IS NOT NULL THEN ? ELSE reply_at END, updated_at = ? WHERE id = ?")
      .bind(at, rep, rep, at, at, id).run();
    if (r.status !== 'published' && r.email) {
      await tell(env, { email: r.email, lang: r.lang, name: r.name }, 'reviewLive', { url: '/reviews.html#r' + id, message: rep || r.reply || '' });
    }
    return { ok: true };
  }
  if (action === 'reject') {
    if (REJECT_REASONS.indexOf(reason) === -1) return { error: 'Choose a reason', code: 'rv_reason', status: 400 };
    await env.DB.prepare("UPDATE fb_reviews SET status = 'rejected', reject_reason = ?, updated_at = ? WHERE id = ?").bind(reason, at, id).run();
    return { ok: true };
  }
  if (action === 'archive') {               // private feedback, read and filed
    await env.DB.prepare("UPDATE fb_reviews SET status = 'archived', updated_at = ? WHERE id = ?").bind(at, id).run();
    return { ok: true };
  }
  if (action === 'unpublish') {
    await env.DB.prepare("UPDATE fb_reviews SET status = 'pending', updated_at = ? WHERE id = ?").bind(at, id).run();
    return { ok: true };
  }
  if (action === 'reply') {
    if (!rep) return { error: 'Write a reply', code: 'rv_reply', status: 400 };
    const fresh = !r.reply;
    await env.DB.prepare('UPDATE fb_reviews SET reply = ?, reply_at = ?, updated_at = ? WHERE id = ?').bind(rep, at, at, id).run();
    if (r.status === 'published' && r.email && fresh) {
      await tell(env, { email: r.email, lang: r.lang, name: r.name }, 'reviewReply', { url: '/reviews.html#r' + id, message: rep });
    }
    return { ok: true };
  }
  return { error: 'Unknown action', code: 'rv_action', status: 400 };
}
export async function ideaStatus(env, id, status) {
  if (['new', 'read', 'done'].indexOf(status) === -1) return { error: 'Unknown status', status: 400 };
  await env.DB.prepare("UPDATE fb_reviews SET status = ?, updated_at = ? WHERE id = ? AND kind = 'idea'").bind(status, nowIso(), id).run();
  return { ok: true };
}

/* ── invitations (only with consent) ─────────────────────────────────────── */
let lastInvites = 0, lastTidy = 0;
export async function sendInvites(env) {
  if (Date.now() - lastInvites < 10 * 60 * 1000) return;
  lastInvites = Date.now();
  // what the privacy policy promises: unpublished feedback and ideas go after three years
  if (Date.now() - lastTidy > 86400000) {
    lastTidy = Date.now();
    const old = new Date(Date.now() - 3 * 365 * 86400000).toISOString();
    try {
      await env.DB.prepare("DELETE FROM mk_photos WHERE review_id IN (SELECT id FROM fb_reviews WHERE status != 'published' AND created_at < ?)").bind(old).run();
      await env.DB.prepare("DELETE FROM fb_reviews WHERE status != 'published' AND created_at < ?").bind(old).run();
    } catch (e) { /* tables not there yet */ }
  }
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const oldest = new Date(Date.now() - INVITE_DAYS * 86400000).toISOString().slice(0, 10);
  let due;
  try {
    due = await env.DB.prepare(
      "SELECT id, first_name, last_name, email, lang, service, date FROM bookings WHERE feedback_ok = 1 AND review_invited IS NULL AND COALESCE(status, '') IN ('paid','unpaid') AND date <= ? AND date >= ? LIMIT 20"
    ).bind(yesterday, oldest).all();
  } catch (e) { return; }                   // columns not there yet
  for (const b of due.results || []) {
    const r = await env.DB.prepare('UPDATE bookings SET review_invited = ? WHERE id = ? AND review_invited IS NULL').bind(nowIso(), b.id).run();
    if (!r.meta.changes || !b.email) continue;
    const k = await inviteToken(env, b);
    await tell(env, { email: b.email, lang: b.lang, name: b.first_name || '' }, 'reviewInvite', {
      service: b.service || 'ShoeLab', url: '/reviews.html?ref=booking-' + b.id + '&k=' + encodeURIComponent(k) + '#write',
    });
  }
}

