// ShoeLab Vault API — every /api/market/* route.
//
//   GET  config | listings | listing?id= | photo?id= | me | queue | payouts/status
//   POST listings | bid | buy | offer | offer/respond | watch | listing/cancel
//        listing/relist | order/pay | order/ship | order/received | order/problem
//        order/feedback | payouts/setup | payouts/dashboard | support/chat
//        support/ticket | support/answer | review | lab | lab/photos-to-r2
import { json, preflight, clean, currentUser, stripeApi, sessionSecret } from '../../_shared/util.js';
import {
  VAULT, CONDITIONS, TIERS, PHOTO_KINDS, REQUIRED_KINDS, increment, nowIso, isoIn, euro,
  siteUrl, isSpecialist, shortName, maskName, fees, ensureSchema, logEvent, userById,
  listingTitle, tell, tellStudio, createOrder, markPaid, shipTo, housekeeping, settleAuction,
  orderDelivered, releasePayout, releaseWaiting, refundOrder, connectOn, sellerRow, refreshSeller, LAB,
} from '../../_shared/vault.js';
import { supportChat, supportTicket, supportAnswer, ticketsForQueue } from '../../_shared/support.js';

// Errors carry a stable code next to the English message, so the pages can
// show them in the visitor's language; extra fields (an amount) fill the gaps.
class HttpError extends Error {
  constructor(status, message, code, extra) { super(message); this.status = status; this.code = code; this.extra = extra; }
}
const fail = (status, message, code, extra) => { throw new HttpError(status, message, code, extra); };

async function body(request) {
  try { return await request.json(); } catch (e) { fail(400, 'Invalid request body'); }
}
async function needUser(request, env) {
  const u = await currentUser(request, env);
  if (!u) fail(401, 'Please sign in first', 'signin');
  return u;
}
async function needSpecialist(request, env) {
  const u = await needUser(request, env);
  if (!isSpecialist(env, u)) fail(403, 'Specialists only', 'specialists');
  return u;
}
// Bidding, buying, offering and selling need a confirmed email address.
async function needVerified(request, env) {
  const u = await needUser(request, env);
  if (!u.verified) fail(403, 'Please confirm your email address first', 'verify_email', { email: u.email });
  return u;
}
// With Stripe Connect on, a seller verifies with Stripe before listing, so
// there is somewhere for the money to go once a pair sells.
async function needSellerReady(env, u) {
  if (!connectOn(env)) return;
  let row = await sellerRow(env, u.id);
  // they may have finished on Stripe's pages without coming back here: ask Stripe
  if (row && !row.details_submitted) row = await refreshSeller(env, u.id);
  if (!row || !row.details_submitted) fail(403, 'Verify your seller account first', 'seller_unverified');
}
async function sellerState(env, userId) {
  if (!connectOn(env)) return null;
  const row = await sellerRow(env, userId);
  return { connected: !!row, ready: !!(row && row.details_submitted), payouts: !!(row && row.payouts_enabled), due: row ? row.due : 0 };
}
// prices arrive in euros from the form, live in cents everywhere else
function cents(v) {
  const n = Math.round(Number(v) * 100);
  return Number.isFinite(n) ? n : NaN;
}
function intParam(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; }

const CARD_COLS = `l.*,
  (SELECT id FROM mk_photos p WHERE p.listing_id = l.id ORDER BY idx LIMIT 1) AS photo_id,
  (SELECT COUNT(*) FROM mk_watch w WHERE w.listing_id = l.id) AS watchers`;

function card(l) {
  return {
    id: l.id, title: listingTitle(l), brand: l.brand, model: l.model, size: l.size, cond: l.cond,
    format: l.format, tier: l.tier, price: l.price, buyNow: l.buy_now, bids: l.bids,
    endsAt: l.ends_at, status: l.status, acceptOffers: !!l.accept_offers,
    // cards load the small version; the item page asks for the full photo
    photo: l.photo_id ? '/api/market/photo?id=' + l.photo_id + '&s=t' : null,
    watchers: l.watchers || 0, createdAt: l.created_at, liveAt: l.live_at, updatedAt: l.updated_at,
  };
}
async function loadListing(env, id) {
  return env.DB.prepare('SELECT ' + CARD_COLS + ' FROM mk_listings l WHERE l.id = ?').bind(id).first();
}
// an auction that ran out but nobody has touched since is settled on sight
async function freshListing(env, id) {
  let l = await loadListing(env, id);
  if (l && l.status === 'live' && l.format === 'auction' && l.ends_at && l.ends_at <= nowIso()) {
    await settleAuction(env, l);
    l = await loadListing(env, id);
  }
  return l;
}

// ── GET config ─────────────────────────────────────────────────────────────
// Every Vault page loads this first: the rules of the market plus who is
// looking, so the header knows whether to offer the lab console.
async function getConfig({ request, env }) {
  const me = await currentUser(request, env);
  return json({
    commission: VAULT.commission, fees: VAULT.fees, shipping: VAULT.shipping,
    minPrice: VAULT.minPrice, maxPrice: VAULT.maxPrice, durations: VAULT.durations,
    conditions: CONDITIONS, tiers: TIERS, photoKinds: PHOTO_KINDS, required: REQUIRED_KINDS,
    maxPhotos: VAULT.maxPhotos, maxPhotoBytes: VAULT.maxPhotoBytes, onlinePayment: !!env.STRIPE_SECRET_KEY,
    connect: connectOn(env), support: !!env.ANTHROPIC_API_KEY,
    me: me ? {
      id: me.id, name: me.name, email: me.email, specialist: isSpecialist(env, me), verified: !!me.verified,
      seller: await sellerState(env, me.id),
    } : null,
  }, 200, { 'Cache-Control': 'no-store' });
}

// ── GET listings ───────────────────────────────────────────────────────────
async function getListings({ request, env }) {
  const q = new URL(request.url).searchParams;
  const view = q.get('view') === 'sold' ? 'sold' : 'live';
  const where = [view === 'sold' ? "l.status = 'sold'" : "l.status = 'live'"];
  const args = [];
  const text = clean(q.get('q') || '', 80);
  if (text) {
    where.push("(l.brand || ' ' || l.model || ' ' || COALESCE(l.description,'')) LIKE ? ESCAPE '\\'");
    args.push('%' + text.replace(/[\\%_]/g, (c) => '\\' + c) + '%');
  }
  const brand = clean(q.get('brand') || '', 40);
  if (brand) { where.push('LOWER(l.brand) = LOWER(?)'); args.push(brand); }
  const size = clean(q.get('size') || '', 8);
  if (size) { where.push('l.size = ?'); args.push(size); }
  const cond = q.get('cond');
  if (CONDITIONS.indexOf(cond) !== -1) { where.push('l.cond = ?'); args.push(cond); }
  const format = q.get('format');
  if (format === 'auction' || format === 'fixed') { where.push('l.format = ?'); args.push(format); }
  const tier = q.get('tier');
  if (TIERS.indexOf(tier) !== -1) { where.push('l.tier = ?'); args.push(tier); }
  const min = cents(q.get('min')); if (q.get('min') && min > 0) { where.push('l.price >= ?'); args.push(min); }
  const max = cents(q.get('max')); if (q.get('max') && max > 0) { where.push('l.price <= ?'); args.push(max); }

  const SORTS = {
    ending: "CASE WHEN l.ends_at IS NULL THEN 1 ELSE 0 END, l.ends_at ASC, l.id DESC",
    new: 'COALESCE(l.live_at, l.created_at) DESC',
    price_asc: 'l.price ASC', price_desc: 'l.price DESC',
    popular: 'watchers DESC, l.bids DESC, l.id DESC',
    sold: 'l.updated_at DESC',
  };
  const sort = SORTS[q.get('sort')] ? q.get('sort') : (view === 'sold' ? 'sold' : 'new');
  const per = Math.min(48, Math.max(6, intParam(q.get('per')) || 24));
  const page = Math.max(1, intParam(q.get('page')) || 1);

  const w = where.join(' AND ');
  const total = (await env.DB.prepare('SELECT COUNT(*) AS n FROM mk_listings l WHERE ' + w).bind(...args).first()).n;
  const rows = await env.DB.prepare(
    'SELECT ' + CARD_COLS + ' FROM mk_listings l WHERE ' + w + ' ORDER BY ' + SORTS[sort] + ' LIMIT ? OFFSET ?'
  ).bind(...args, per, (page - 1) * per).all();

  // facets for the filter bar, from everything currently live
  const brands = await env.DB.prepare(
    "SELECT brand, COUNT(*) AS n FROM mk_listings WHERE status = 'live' GROUP BY LOWER(brand) ORDER BY n DESC LIMIT 20"
  ).all();
  const sizes = await env.DB.prepare(
    "SELECT size, COUNT(*) AS n FROM mk_listings WHERE status = 'live' GROUP BY size ORDER BY CAST(size AS REAL)"
  ).all();
  // a signed-in visitor sees which of these pairs they already watch
  const items = (rows.results || []).map(card);
  const me = await currentUser(request, env);
  if (me && items.length) {
    const ids = items.map((i) => i.id);
    const watched = await env.DB.prepare(
      'SELECT listing_id FROM mk_watch WHERE user_id = ? AND listing_id IN (' + ids.map(() => '?').join(',') + ')'
    ).bind(me.id, ...ids).all();
    const mine = new Set((watched.results || []).map((r) => r.listing_id));
    items.forEach((i) => { i.watching = mine.has(i.id); });
  }
  return json({
    items, total, page, per,
    facets: { brands: brands.results || [], sizes: sizes.results || [] },
  }, 200, { 'Cache-Control': 'no-store' });
}

// ── GET listing ────────────────────────────────────────────────────────────
async function getListing({ request, env }) {
  const id = intParam(new URL(request.url).searchParams.get('id'));
  if (!id) fail(400, 'Missing listing id', 'gone');
  const me = await currentUser(request, env);
  const l = await freshListing(env, id);
  const isOwner = me && l && l.seller_id === me.id;
  const spec = isSpecialist(env, me);
  // listings still in review (or turned down) are private to the seller and the lab
  if (!l || (['review', 'rejected', 'cancelled', 'relisted'].indexOf(l.status) !== -1 && !isOwner && !spec)) {
    fail(404, 'This listing does not exist or is no longer available', 'gone');
  }

  const photos = await env.DB.prepare('SELECT id, kind FROM mk_photos WHERE listing_id = ? ORDER BY idx').bind(id).all();
  const seller = await env.DB.prepare('SELECT name, created_at FROM users WHERE id = ?').bind(l.seller_id).first();
  const sales = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM mk_orders WHERE seller_id = ? AND status IN ('delivered','shipped','verified')"
  ).bind(l.seller_id).first();
  const rep = await reputation(env, l.seller_id);
  const hist = await env.DB.prepare(
    `SELECT b.amount, b.auto, b.created_at, u.name FROM mk_bids b LEFT JOIN users u ON u.id = b.bidder_id
     WHERE b.listing_id = ? AND b.pub = 1 ORDER BY b.id DESC LIMIT 30`
  ).bind(id).all();

  const sellerAcct = connectOn(env) ? await sellerRow(env, l.seller_id) : null;
  const out = card(l);
  Object.assign(out, {
    description: l.description || '', startPrice: l.start_price, minOffer: null,
    photos: (photos.results || []).map((p) => ({ url: '/api/market/photo?id=' + p.id, kind: p.kind })),
    seller: Object.assign({
      name: shortName(seller && seller.name), since: seller && seller.created_at, sales: sales ? sales.n : 0,
      verified: !!(sellerAcct && sellerAcct.details_submitted),
    }, rep),
    bidHistory: (hist.results || []).map((h) => ({ who: maskName(h.name), amount: h.amount, auto: !!h.auto, at: h.created_at })),
    increment: l.format === 'auction' ? increment(l.price) : null,
    minNext: l.format === 'auction' ? (l.bids ? l.price + increment(l.price) : l.start_price) : null,
    binAvailable: !!l.buy_now && l.status === 'live' && (l.format === 'fixed' || l.bids === 0),
    reviewNote: (isOwner || spec) ? l.review_note : null,
    fees: { auth: VAULT.fees[l.tier], shipping: VAULT.shipping },
    viewer: null,
  });
  if (me) {
    const watch = await env.DB.prepare('SELECT 1 AS w FROM mk_watch WHERE user_id = ? AND listing_id = ?').bind(me.id, id).first();
    const myBid = await env.DB.prepare('SELECT MAX(max_amount) AS m FROM mk_bids WHERE listing_id = ? AND bidder_id = ?').bind(id, me.id).first();
    const myOffer = await env.DB.prepare(
      'SELECT id, amount, counter, status, expires_at FROM mk_offers WHERE listing_id = ? AND buyer_id = ? ORDER BY id DESC LIMIT 1'
    ).bind(id, me.id).first();
    const order = await env.DB.prepare(
      'SELECT id, status FROM mk_orders WHERE listing_id = ? AND (buyer_id = ? OR seller_id = ?) ORDER BY id DESC LIMIT 1'
    ).bind(id, me.id, me.id).first();
    out.viewer = {
      role: isOwner ? 'seller' : 'buyer', specialist: spec, watching: !!watch,
      highBidder: l.high_bidder === me.id,
      myMax: l.high_bidder === me.id ? l.high_max : (myBid && myBid.m) || null,
      offer: myOffer || null, order: order || null,
    };
  }
  return json({ listing: out }, 200, { 'Cache-Control': 'no-store' });
}

// Feedback buyers left the seller: counts, a positive share, the latest notes.
async function reputation(env, sellerId) {
  const c = await env.DB.prepare(
    `SELECT SUM(rating = 1) AS pos, SUM(rating = 0) AS neu, SUM(rating = -1) AS neg FROM mk_feedback WHERE seller_id = ?`
  ).bind(sellerId).first();
  const pos = (c && c.pos) || 0, neu = (c && c.neu) || 0, neg = (c && c.neg) || 0;
  const recent = await env.DB.prepare(
    `SELECT f.rating, f.comment, f.created_at, u.name FROM mk_feedback f LEFT JOIN users u ON u.id = f.buyer_id
     WHERE f.seller_id = ? ORDER BY f.created_at DESC LIMIT 5`
  ).bind(sellerId).all();
  return {
    rating: { pos, neu, neg, score: pos + neg ? Math.round((pos / (pos + neg)) * 100) : null },
    feedback: (recent.results || []).map((f) => ({ rating: f.rating, comment: f.comment, at: f.created_at, who: maskName(f.name) })),
  };
}

// ── photos ─────────────────────────────────────────────────────────────────
// Each photo is stored twice: the full picture (about 1600 px) for the item
// page and a small one (about 480 px) for grids, both made on the seller's
// phone before upload. With an R2 bucket bound as VAULT_PHOTOS they live in
// R2 (the row holds "r2:<key>"); without it, in D1 as base64.
function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
async function putR2(env, listingId, name, mime, b64) {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => x.toString(16).padStart(2, '0')).join('');
  const key = 'vault/' + listingId + '/' + name + '-' + rand + '.' + mime.split('/')[1];
  await env.VAULT_PHOTOS.put(key, b64ToBytes(b64), { httpMetadata: { contentType: mime } });
  return 'r2:' + key;
}
async function storePhoto(env, listingId, idx, p) {
  if (!env.VAULT_PHOTOS) return { data: p.data, thumb: p.thumb || null };
  return {
    data: await putR2(env, listingId, String(idx), p.mime, p.data),
    thumb: p.thumb ? await putR2(env, listingId, idx + 't', 'image/jpeg', p.thumb) : null,
  };
}

async function getPhoto({ request, env }) {
  const q = new URL(request.url).searchParams;
  const id = intParam(q.get('id'));
  const p = id && await env.DB.prepare('SELECT mime, data, thumb FROM mk_photos WHERE id = ?').bind(id).first();
  if (!p) return new Response('Not found', { status: 404 });
  const small = q.get('s') === 't' && p.thumb;
  const src = small ? p.thumb : p.data;
  const headers = {
    'Content-Type': small ? 'image/jpeg' : p.mime,
    'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff',
  };
  if (String(src).slice(0, 3) === 'r2:') {
    const obj = env.VAULT_PHOTOS && await env.VAULT_PHOTOS.get(src.slice(3));
    if (!obj) return new Response('Not found', { status: 404 });
    return new Response(obj.body, { headers });
  }
  return new Response(b64ToBytes(src), { headers });
}

// Moves photos kept in D1 into the R2 bucket, a batch at a time.
async function photosToR2({ request, env }) {
  await needSpecialist(request, env);
  if (!env.VAULT_PHOTOS) fail(409, 'Bind an R2 bucket as VAULT_PHOTOS first', 'no_r2');
  const rows = await env.DB.prepare("SELECT id, listing_id, idx, mime, data, thumb FROM mk_photos WHERE data NOT LIKE 'r2:%' LIMIT 15").all();
  let moved = 0;
  for (const p of rows.results || []) {
    const data = await putR2(env, p.listing_id, String(p.idx), p.mime, p.data);
    const thumb = p.thumb && String(p.thumb).slice(0, 3) !== 'r2:' ? await putR2(env, p.listing_id, p.idx + 't', 'image/jpeg', p.thumb) : p.thumb;
    const r = await env.DB.prepare("UPDATE mk_photos SET data = ?, thumb = ? WHERE id = ? AND data NOT LIKE 'r2:%'").bind(data, thumb, p.id).run();
    if (r.meta.changes) moved++;
  }
  const left = await env.DB.prepare("SELECT COUNT(*) AS n FROM mk_photos WHERE data NOT LIKE 'r2:%'").first();
  return json({ ok: true, moved, left: left.n });
}

// How a pair is sold: an auction (start price, length, optional Buy Now) or a
// fixed price (optionally open to offers, with an automatic floor).
function parseTerms(b) {
  const format = b.format === 'auction' ? 'auction' : 'fixed';
  const given = (v) => v !== undefined && v !== null && v !== '';
  const inRange = (c) => c >= VAULT.minPrice && c <= VAULT.maxPrice;
  const range = { min: VAULT.minPrice, max: VAULT.maxPrice };
  let start = null, buyNow = null, minOffer = null, duration = null, acceptOffers = 0;
  if (format === 'auction') {
    start = cents(b.startPrice);
    duration = intParam(b.duration);
    if (!inRange(start)) fail(400, 'Start price must be between ' + euro(VAULT.minPrice) + ' and ' + euro(VAULT.maxPrice), 'start_range', range);
    if (VAULT.durations.indexOf(duration) === -1) fail(400, 'Choose how long the auction runs', 'duration');
    if (given(b.buyNow)) {
      buyNow = cents(b.buyNow);
      if (!inRange(buyNow) || buyNow <= start) fail(400, 'Buy Now must be higher than the start price', 'bin_low');
    }
  } else {
    buyNow = cents(b.buyNow);
    if (!inRange(buyNow)) fail(400, 'Price must be between ' + euro(VAULT.minPrice) + ' and ' + euro(VAULT.maxPrice), 'price_range', range);
    acceptOffers = b.acceptOffers ? 1 : 0;
    if (acceptOffers && given(b.minOffer)) {
      minOffer = cents(b.minOffer);
      if (!(minOffer > 0 && minOffer < buyNow)) fail(400, 'The lowest offer you accept must be below your price', 'min_offer');
    }
  }
  return { format, start, buyNow, minOffer, duration, acceptOffers };
}

// ── POST listings (create) ─────────────────────────────────────────────────
async function createListing({ request, env }) {
  const me = await needVerified(request, env);
  await needSellerReady(env, me);
  const b = await body(request);
  const brand = clean(b.brand, 40), model = clean(b.model, 90), size = clean(String(b.size || ''), 8);
  const description = clean(b.description || '', 2000);
  if (!brand || !model) fail(400, 'Add the brand and the model', 'brand_model');
  if (!/^\d{2}(\.5| 1\/3| 2\/3)?$/.test(size)) fail(400, 'Enter an EU size such as 42, 42.5 or 42 2/3', 'size');
  if (CONDITIONS.indexOf(b.cond) === -1) fail(400, 'Choose the condition', 'cond');
  if (TIERS.indexOf(b.tier) === -1) fail(400, 'Choose how the pair will be authenticated', 'tier');
  const { format, start, buyNow, minOffer, duration, acceptOffers } = parseTerms(b);

  const photos = Array.isArray(b.photos) ? b.photos.slice(0, VAULT.maxPhotos) : [];
  const parsed = [];
  for (const p of photos) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(p && p.data || ''));
    if (!m) fail(400, 'One of the photos could not be read — please use JPG, PNG or WebP', 'photo_bad');
    if (m[2].length * 0.75 > VAULT.maxPhotoBytes) fail(400, 'A photo is too large — keep each under 750 KB', 'photo_big');
    // the small version is optional; a bad one is simply dropped
    const t = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(p.thumb || ''));
    const thumb = t && t[1].length * 0.75 <= VAULT.maxThumbBytes ? t[1] : null;
    parsed.push({ mime: m[1], data: m[2], thumb, kind: PHOTO_KINDS.indexOf(p.kind) !== -1 ? p.kind : 'other' });
  }
  const have = parsed.map((p) => p.kind);
  const missing = REQUIRED_KINDS[b.tier].filter((k) => have.indexOf(k) === -1);
  if (missing.length) fail(400, 'Missing required photos: ' + missing.join(', '), 'photos_missing', { missing });

  const at = nowIso();
  const res = await env.DB.prepare(
    `INSERT INTO mk_listings (seller_id, brand, model, size, cond, description, format, tier, start_price, buy_now,
       accept_offers, min_offer, duration_days, price, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'review', ?, ?)`
  ).bind(me.id, brand, model, size, b.cond, description, format, b.tier, start, buyNow, acceptOffers, minOffer,
    duration, format === 'auction' ? start : buyNow, at, at).run();
  const id = res.meta.last_row_id;
  const stored = [];
  for (let i = 0; i < parsed.length; i++) stored.push(await storePhoto(env, id, i, parsed[i]));
  await env.DB.batch(parsed.map((p, i) => env.DB.prepare(
    'INSERT INTO mk_photos (listing_id, idx, kind, mime, data, thumb, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, i, p.kind, p.mime, stored[i].data, stored[i].thumb, at)));
  await logEvent(env, { listingId: id, kind: 'submitted' });

  const title = listingTitle({ brand, model });
  await tell(env, me, 'listingSubmitted', {
    title, size, url: '/vault-item.html?id=' + id, next: { k: b.tier === 'photo' ? 'nextPhotoCheck' : 'nextLabCheck' },
  });
  await tellStudio(env, 'sListingReview', {
    title, url: LAB,
    rows: [['seller', me.name + ' <' + me.email + '>'], ['tier', { k: b.tier === 'lab' ? 'tierLab' : 'tierPhoto' }],
      ['format', { k: format === 'auction' ? 'auction' : 'fixed' }], ['price', { m: format === 'auction' ? start : buyNow }], ['size', 'EU ' + size]],
  }, me.email);
  return json({ ok: true, id, status: 'review' });
}

// ── POST bid — proxy bidding with a soft close ─────────────────────────────
// Bidders enter the most they would pay; the Vault bids for them one step
// at a time, so the price only rises as far as the competition forces it.
async function placeBid({ request, env }) {
  const me = await needVerified(request, env);
  const b = await body(request);
  const id = intParam(b.id), max = cents(b.max);
  if (!id || !Number.isFinite(max)) fail(400, 'Enter your maximum bid', 'bid_input');
  if (max > VAULT.maxPrice) fail(400, 'That bid is above the Vault maximum of ' + euro(VAULT.maxPrice), 'bid_cap', { amount: VAULT.maxPrice });

  for (let attempt = 0; attempt < 4; attempt++) {
    const l = await freshListing(env, id);
    if (!l || l.status !== 'live' || l.format !== 'auction') fail(409, 'This auction is not open for bids', 'closed');
    if (l.seller_id === me.id) fail(403, 'You cannot bid on your own listing', 'own');

    // Each action writes the history the way eBay shows it: a losing
    // challenger appears at their own bid, followed by the leader's automatic
    // reply; a winning challenger follows the old leader's proxy, which bid
    // up to its maximum.
    let price, leader, leaderMax, outbidUser = null, lost = false;
    const entries = [];
    if (l.high_bidder === me.id) {
      if (max <= l.high_max) fail(400, 'Your maximum is already ' + euro(l.high_max), 'max_already', { amount: l.high_max });
      price = l.price; leader = me.id; leaderMax = max;
      entries.push({ who: me.id, amount: l.price, max, auto: 0, pub: 0 });
    } else {
      const minNext = l.bids ? l.price + increment(l.price) : l.start_price;
      if (max < minNext) fail(400, 'Bid at least ' + euro(minNext), 'bid_low', { amount: minNext });
      if (!l.bids || !l.high_bidder) {
        price = l.start_price; leader = me.id; leaderMax = max;
        entries.push({ who: me.id, amount: price, max, auto: 0, pub: 1 });
      } else if (max > l.high_max) {
        price = Math.min(max, l.high_max + increment(l.high_max));
        leader = me.id; leaderMax = max; outbidUser = l.high_bidder;
        entries.push({ who: l.high_bidder, amount: l.high_max, max: l.high_max, auto: 1, pub: 1 });
        entries.push({ who: me.id, amount: price, max, auto: 0, pub: 1 });
      } else {
        // the standing maximum defends itself; ties go to whoever bid first
        price = Math.min(l.high_max, max + increment(max));
        leader = l.high_bidder; leaderMax = l.high_max; lost = true;
        entries.push({ who: me.id, amount: max, max, auto: 0, pub: 1 });
        entries.push({ who: l.high_bidder, amount: price, max: l.high_max, auto: 1, pub: 1 });
      }
    }
    const counted = entries.filter((e) => e.pub).length;

    // a bid in the closing minutes pushes the end back, so nobody wins by
    // sniping in the last second
    let ends = l.ends_at;
    if (counted && ends && new Date(ends).getTime() - Date.now() < VAULT.softCloseMs) ends = isoIn(VAULT.softCloseMs);

    // History rows and the price move commit together or not at all: the
    // rows are only inserted while the listing still has the version we
    // read, and the UPDATE checks the same version, inside one transaction.
    // Written separately, a competing bid could land between them and leave
    // the history out of order.
    const at = nowIso();
    const stmts = entries.map((e) => env.DB.prepare(
      `INSERT INTO mk_bids (listing_id, bidder_id, amount, max_amount, auto, pub, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM mk_listings WHERE id = ? AND version = ? AND status = 'live')`
    ).bind(id, e.who, e.amount, e.max, e.auto, e.pub, at, id, l.version));
    stmts.push(env.DB.prepare(
      `UPDATE mk_listings SET price = ?, high_bidder = ?, high_max = ?, bids = bids + ?, ends_at = ?,
         version = version + 1, updated_at = ?
       WHERE id = ? AND version = ? AND status = 'live'`
    ).bind(price, leader, leaderMax, counted, ends, at, id, l.version));
    const done = await env.DB.batch(stmts);
    if (!done[done.length - 1].meta.changes) continue;   // someone else bid first — re-read and retry

    if (outbidUser) {
      await tell(env, await userById(env, outbidUser), 'outbid', {
        title: listingTitle(l), price: { m: price }, url: '/vault-item.html?id=' + id,
      });
    }
    return json({
      ok: true, leading: !lost, outbid: lost, price, bids: l.bids + counted, endsAt: ends,
      minNext: price + increment(price), extended: ends !== l.ends_at,
    });
  }
  fail(409, 'Bids are coming in fast — please try again', 'busy');
}

// ── POST buy ───────────────────────────────────────────────────────────────
async function buyNow({ request, env }) {
  const me = await needVerified(request, env);
  const id = intParam((await body(request)).id);
  const l = await freshListing(env, id);
  if (!l || l.status !== 'live' || !l.buy_now) fail(409, 'This pair is no longer available to buy', 'unavailable');
  if (l.seller_id === me.id) fail(403, 'You cannot buy your own listing', 'own');
  if (l.format === 'auction' && l.bids > 0) fail(409, 'Buy Now closed when the first bid came in', 'bin_closed');
  const r = await env.DB.prepare(
    `UPDATE mk_listings SET status = 'sold', buyer_id = ?, sold_price = buy_now, price = buy_now, updated_at = ?
     WHERE id = ? AND status = 'live' AND (format = 'fixed' OR bids = 0)`
  ).bind(me.id, nowIso(), id).run();
  if (!r.meta.changes) fail(409, 'Someone else just bought this pair', 'taken');
  const orderId = await createOrder(env, l, me.id, l.buy_now, 'buy_now');
  return json({ ok: true, orderId });
}

// ── POST offer ─────────────────────────────────────────────────────────────
async function makeOffer({ request, env }) {
  const me = await needVerified(request, env);
  const b = await body(request);
  const id = intParam(b.id), amount = cents(b.amount);
  const l = await freshListing(env, id);
  if (!l || l.status !== 'live' || l.format !== 'fixed' || !l.accept_offers) fail(409, 'This listing does not take offers', 'no_offers');
  if (l.seller_id === me.id) fail(403, 'You cannot make an offer on your own listing', 'own');
  if (!(amount >= VAULT.minPrice)) fail(400, 'Offers start at ' + euro(VAULT.minPrice), 'offer_min', { amount: VAULT.minPrice });
  if (amount >= l.buy_now) fail(400, 'At that price, just use Buy Now', 'offer_high');
  const at = nowIso();
  // one live offer per buyer per pair; a new one replaces the old
  await env.DB.prepare(
    "UPDATE mk_offers SET status = 'withdrawn', updated_at = ? WHERE listing_id = ? AND buyer_id = ? AND status IN ('pending','countered')"
  ).bind(at, id, me.id).run();
  const auto = l.min_offer && amount < l.min_offer;
  const res = await env.DB.prepare(
    `INSERT INTO mk_offers (listing_id, buyer_id, seller_id, amount, message, status, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, me.id, l.seller_id, amount, clean(b.message || '', 300), auto ? 'declined' : 'pending',
    isoIn(VAULT.offerTtlMs), at, at).run();
  if (auto) return json({ ok: true, offerId: res.meta.last_row_id, status: 'declined', autoDeclined: true });
  await tell(env, await userById(env, l.seller_id), 'offerReceived', {
    title: listingTitle(l), amount: { m: amount }, price: { m: l.buy_now }, message: clean(b.message || '', 300),
    url: '/vault-me.html#offers',
  });
  return json({ ok: true, offerId: res.meta.last_row_id, status: 'pending' });
}

// ── POST offer/respond ─────────────────────────────────────────────────────
async function respondOffer({ request, env }) {
  const me = await needUser(request, env);
  const b = await body(request);
  const o = await env.DB.prepare('SELECT * FROM mk_offers WHERE id = ?').bind(intParam(b.offerId)).first();
  if (!o) fail(404, 'Offer not found', 'offer_locked');
  const l = await freshListing(env, o.listing_id);
  const at = nowIso();
  const set = (status, extra) => env.DB.prepare(
    'UPDATE mk_offers SET status = ?, counter = COALESCE(?, counter), expires_at = COALESCE(?, expires_at), updated_at = ? WHERE id = ? AND status = ?'
  ).bind(status, (extra && extra.counter) || null, (extra && extra.expires) || null, at, o.id, o.status).run();

  async function sell(price) {
    if (!l || l.status !== 'live') fail(409, 'This pair is no longer available', 'unavailable');
    const r = await env.DB.prepare(
      "UPDATE mk_listings SET status = 'sold', buyer_id = ?, sold_price = ?, price = ?, updated_at = ? WHERE id = ? AND status = 'live'"
    ).bind(o.buyer_id, price, price, at, l.id).run();
    if (!r.meta.changes) fail(409, 'This pair is no longer available', 'unavailable');
    await set('accepted');
    return createOrder(env, l, o.buyer_id, price, 'offer');
  }

  if (o.seller_id === me.id && o.status === 'pending') {
    if (b.action === 'accept') return json({ ok: true, status: 'accepted', orderId: await sell(o.amount) });
    if (b.action === 'decline') {
      await set('declined');
      await tell(env, await userById(env, o.buyer_id), 'offerDeclined', {
        title: l ? listingTitle(l) : '', amount: { m: o.amount }, url: '/vault-item.html?id=' + o.listing_id,
      });
      return json({ ok: true, status: 'declined' });
    }
    if (b.action === 'counter') {
      const c = cents(b.amount);
      if (!(c > o.amount) || (l.buy_now && c >= l.buy_now)) fail(400, 'A counter-offer sits between their offer and your price', 'counter_range');
      await set('countered', { counter: c, expires: isoIn(VAULT.offerTtlMs) });
      await tell(env, await userById(env, o.buyer_id), 'counterOffer', {
        title: listingTitle(l), offer: { m: o.amount }, amount: { m: c }, url: '/vault-me.html#offers',
      });
      return json({ ok: true, status: 'countered' });
    }
  }
  if (o.buyer_id === me.id) {
    if (o.status === 'countered' && b.action === 'accept') return json({ ok: true, status: 'accepted', orderId: await sell(o.counter) });
    if (o.status === 'countered' && b.action === 'decline') { await set('declined'); return json({ ok: true, status: 'declined' }); }
    if (o.status === 'pending' && b.action === 'withdraw') { await set('withdrawn'); return json({ ok: true, status: 'withdrawn' }); }
  }
  fail(409, 'This offer can no longer be changed', 'offer_locked');
}

// ── POST watch ─────────────────────────────────────────────────────────────
async function watch({ request, env }) {
  const me = await needUser(request, env);
  const b = await body(request);
  const id = intParam(b.id);
  if (!id) fail(400, 'Missing listing id', 'gone');
  if (b.on) {
    await env.DB.prepare('INSERT OR IGNORE INTO mk_watch (user_id, listing_id, created_at) VALUES (?, ?, ?)').bind(me.id, id, nowIso()).run();
  } else {
    await env.DB.prepare('DELETE FROM mk_watch WHERE user_id = ? AND listing_id = ?').bind(me.id, id).run();
  }
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM mk_watch WHERE listing_id = ?').bind(id).first();
  return json({ ok: true, watching: !!b.on, watchers: n.n });
}

// ── POST listing/cancel ────────────────────────────────────────────────────
async function cancelListing({ request, env }) {
  const me = await needUser(request, env);
  const id = intParam((await body(request)).id);
  const r = await env.DB.prepare(
    "UPDATE mk_listings SET status = 'cancelled', updated_at = ? WHERE id = ? AND seller_id = ? AND status IN ('review','live') AND bids = 0"
  ).bind(nowIso(), id, me.id).run();
  if (!r.meta.changes) fail(409, 'Listings with bids cannot be withdrawn', 'has_bids');
  await env.DB.prepare("UPDATE mk_offers SET status = 'declined', updated_at = ? WHERE listing_id = ? AND status IN ('pending','countered')")
    .bind(nowIso(), id).run();
  return json({ ok: true });
}

// ── POST listing/relist ────────────────────────────────────────────────────
// A pair that already passed review and went live goes straight back on sale
// with new terms; its photos move across, so nothing is stored twice.
async function relistListing({ request, env }) {
  const me = await needVerified(request, env);
  const b = await body(request);
  const l = await env.DB.prepare('SELECT * FROM mk_listings WHERE id = ?').bind(intParam(b.id)).first();
  if (!l || l.seller_id !== me.id) fail(404, 'Listing not found', 'gone');
  if (['ended', 'cancelled'].indexOf(l.status) === -1 || !l.live_at) fail(409, 'Only listings that were live and have ended can be relisted', 'no_relist');
  const t = parseTerms(b);
  const at = nowIso();
  // claim the old listing first, so a double click cannot relist it twice
  const claim = await env.DB.prepare(
    "UPDATE mk_listings SET status = 'relisted', updated_at = ? WHERE id = ? AND status IN ('ended','cancelled')"
  ).bind(at, l.id).run();
  if (!claim.meta.changes) fail(409, 'Only listings that were live and have ended can be relisted', 'no_relist');
  const res = await env.DB.prepare(
    `INSERT INTO mk_listings (seller_id, brand, model, size, cond, description, format, tier, start_price, buy_now,
       accept_offers, min_offer, duration_days, price, status, review_note, live_at, ends_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'live', ?, ?, ?, ?, ?)`
  ).bind(me.id, l.brand, l.model, l.size, l.cond, l.description, t.format, l.tier, t.start, t.buyNow, t.acceptOffers,
    t.minOffer, t.duration, t.format === 'auction' ? t.start : t.buyNow, l.review_note,
    at, t.format === 'auction' ? isoIn(t.duration * 86400000) : null, at, at).run();
  const id = res.meta.last_row_id;
  await env.DB.prepare('UPDATE mk_photos SET listing_id = ? WHERE listing_id = ?').bind(id, l.id).run();
  await logEvent(env, { listingId: id, kind: 'relisted', note: 'from #' + l.id });
  return json({ ok: true, id });
}

// ── orders ─────────────────────────────────────────────────────────────────
async function orderView(env, o, me, spec) {
  const l = await loadListing(env, o.listing_id);
  const ev = await env.DB.prepare('SELECT kind, note, created_at FROM mk_events WHERE order_id = ? ORDER BY id').bind(o.id).all();
  const asSeller = me && o.seller_id === me.id;
  const asBuyer = me && o.buyer_id === me.id;
  const v = {
    id: o.id, listingId: o.listing_id, title: l ? listingTitle(l) : 'Listing #' + o.listing_id,
    size: l && l.size, photo: l && l.photo_id ? '/api/market/photo?id=' + l.photo_id + '&s=t' : null,
    tier: o.tier, source: o.source, status: o.status, payMode: o.pay_mode,
    itemPrice: o.item_price, authFee: o.auth_fee, shipFee: o.ship_fee, total: o.total,
    trackingIn: o.tracking_in, trackingOut: o.tracking_out,
    createdAt: o.created_at, updatedAt: o.updated_at,
    events: (ev.results || []).map((e) => ({ kind: e.kind, note: e.note, at: e.created_at })),
    role: asSeller ? 'seller' : asBuyer ? 'buyer' : 'lab',
  };
  const fb = await env.DB.prepare('SELECT rating, comment FROM mk_feedback WHERE order_id = ?').bind(o.id).first();
  if (fb) v.feedback = { rating: fb.rating, comment: fb.comment };
  if (asSeller || spec) {
    v.payout = o.payout; v.commission = o.commission;
    // manual | waiting (seller has not finished Stripe) | sending | sent | failed
    v.payoutStatus = o.payout_status || null; v.payoutAt = o.payout_at || null;
  }
  if (o.refund_ref) v.refunded = true;
  // the buyer's address goes to the seller only when the seller posts direct
  const showAddress = asBuyer || spec || (asSeller && o.tier === 'photo' && o.status !== 'awaiting_payment');
  if (showAddress) {
    v.address = { name: o.ship_name, line1: o.ship_line1, line2: o.ship_line2, city: o.ship_city, postal: o.ship_postal, country: o.ship_country };
  }
  if (asSeller && o.status === 'paid') v.shipTo = shipTo(env, o);
  if (spec) { v.stripePaid = !!o.stripe_pi; v.payoutRef = o.payout_ref || null; v.refundRef = o.refund_ref || null; }
  return v;
}

async function loadOrder(env, id) {
  const o = id && await env.DB.prepare('SELECT * FROM mk_orders WHERE id = ?').bind(id).first();
  if (!o) fail(404, 'Order not found', 'order_missing');
  return o;
}

async function payOrder({ request, env }) {
  const me = await needUser(request, env);
  const b = await body(request);
  const o = await loadOrder(env, intParam(b.orderId));
  if (o.buyer_id !== me.id) fail(403, 'This is not your order', 'not_yours');
  if (o.status !== 'awaiting_payment') fail(409, 'This order has already been paid', 'already_paid');
  const a = b.address || {};
  const addr = {
    name: clean(a.name, 80), line1: clean(a.line1, 120), line2: clean(a.line2 || '', 120),
    city: clean(a.city, 60), postal: clean(a.postal, 12), country: clean(a.country || 'DE', 2).toUpperCase(),
  };
  if (!addr.name || !addr.line1 || !addr.city || !addr.postal) fail(400, 'Add your full delivery address', 'address');
  await env.DB.prepare(
    'UPDATE mk_orders SET ship_name = ?, ship_line1 = ?, ship_line2 = ?, ship_city = ?, ship_postal = ?, ship_country = ?, updated_at = ? WHERE id = ?'
  ).bind(addr.name, addr.line1, addr.line2, addr.city, addr.postal, addr.country, nowIso(), o.id).run();

  const l = await loadListing(env, o.listing_id);
  if (env.STRIPE_SECRET_KEY) {
    const site = siteUrl(env);
    const s = await stripeApi(env, 'checkout/sessions', {
      mode: 'payment',
      'line_items[0][quantity]': 1,
      'line_items[0][price_data][currency]': 'eur',
      'line_items[0][price_data][unit_amount]': o.total,
      'line_items[0][price_data][product_data][name]': 'ShoeLab Vault: ' + listingTitle(l) + ' (EU ' + l.size + ')',
      'line_items[0][price_data][product_data][description]':
        'Item ' + euro(o.item_price) + ' + authentication ' + euro(o.auth_fee) + ' + shipping ' + euro(o.ship_fee),
      success_url: site + '/vault-me.html?paid=' + o.id + '#order-' + o.id,
      cancel_url: site + '/vault-me.html#order-' + o.id,
      customer_email: me.email,
      client_reference_id: 'vault_' + o.id,
      'metadata[vault_order]': String(o.id),
      'payment_intent_data[metadata][vault_order]': String(o.id),
      // ties the charge to the later transfer to the seller (Stripe Connect)
      'payment_intent_data[transfer_group]': 'vault_' + o.id,
    });
    if (!s || !s.url) fail(502, (s && s.error && s.error.message) || 'Payment could not be started', 'pay_failed');
    await env.DB.prepare('UPDATE mk_orders SET stripe_session = ?, pay_mode = ? WHERE id = ?').bind(s.id, 'stripe', o.id).run();
    return json({ ok: true, url: s.url });
  }
  // no card payments configured yet: ShoeLab sends payment details by hand
  await env.DB.prepare("UPDATE mk_orders SET pay_mode = 'manual' WHERE id = ?").bind(o.id).run();
  await logEvent(env, { orderId: o.id, kind: 'payment_requested' });
  await tellStudio(env, 'sPaymentNeeded', {
    order: o.id, title: listingTitle(l), amount: { m: o.total }, buyerEmail: me.email, url: LAB,
  }, me.email);
  await tell(env, me, 'paymentManual', { title: listingTitle(l), amount: { m: o.total } });
  return json({ ok: true, manual: true });
}

async function shipOrder({ request, env }) {
  const me = await needUser(request, env);
  const b = await body(request);
  const o = await loadOrder(env, intParam(b.orderId));
  if (o.seller_id !== me.id) fail(403, 'Only the seller can do this', 'not_yours');
  if (o.status !== 'paid') fail(409, 'This order is not waiting to be shipped', 'wrong_step');
  const tracking = clean(b.tracking, 80);
  if (!tracking) fail(400, 'Add the tracking number', 'tracking');
  const lab = o.tier === 'lab';
  await env.DB.prepare(
    'UPDATE mk_orders SET status = ?, ' + (lab ? 'tracking_in' : 'tracking_out') + " = ?, updated_at = ? WHERE id = ? AND status = 'paid'"
  ).bind(lab ? 'to_lab' : 'shipped', tracking, nowIso(), o.id).run();
  await logEvent(env, { orderId: o.id, kind: lab ? 'to_lab' : 'shipped', note: tracking });
  const l = await loadListing(env, o.listing_id);
  if (lab) {
    await tellStudio(env, 'sIncoming', {
      order: o.id, url: LAB,
      rows: [['item', listingTitle(l) + ' · EU ' + l.size], ['tracking', tracking], ['seller', me.name + ' <' + me.email + '>']],
    }, me.email);
  } else {
    await tell(env, await userById(env, o.buyer_id), 'shippedToBuyer', {
      title: listingTitle(l), url: '/vault-me.html#order-' + o.id, rows: [['tracking', tracking]],
    });
  }
  return json({ ok: true });
}

async function receivedOrder({ request, env }) {
  const me = await needUser(request, env);
  const o = await loadOrder(env, intParam((await body(request)).orderId));
  if (o.buyer_id !== me.id) fail(403, 'This is not your order', 'not_yours');
  const r = await env.DB.prepare("UPDATE mk_orders SET status = 'delivered', updated_at = ? WHERE id = ? AND status = 'shipped'")
    .bind(nowIso(), o.id).run();
  if (!r.meta.changes) fail(409, 'This order is not out for delivery', 'wrong_step');
  await logEvent(env, { orderId: o.id, kind: 'delivered' });
  await orderDelivered(env, o, 'buyer');
  return json({ ok: true });
}

// Something wrong with a parcel that is on its way: the order is held (no
// automatic delivery, no payout) until a specialist resolves it.
async function reportProblem({ request, env }) {
  const me = await needUser(request, env);
  const b = await body(request);
  const o = await loadOrder(env, intParam(b.orderId));
  if (o.buyer_id !== me.id) fail(403, 'This is not your order', 'not_yours');
  const note = clean(b.note || '', 1000);
  if (note.length < 10) fail(400, 'Describe the problem in a sentence or two', 'problem_note');
  const r = await env.DB.prepare("UPDATE mk_orders SET status = 'disputed', updated_at = ? WHERE id = ? AND status = 'shipped'")
    .bind(nowIso(), o.id).run();
  if (!r.meta.changes) fail(409, 'Problems can be reported while the parcel is on its way', 'wrong_step');
  await logEvent(env, { orderId: o.id, kind: 'disputed', note });
  const l = await loadListing(env, o.listing_id);
  const title = l ? listingTitle(l) : 'order #' + o.id;
  const seller = await userById(env, o.seller_id);
  await tellStudio(env, 'sProblem', {
    order: o.id, title, message: note, url: LAB,
    rows: [['buyer', me.name + ' <' + me.email + '>'], ['seller', seller ? seller.name + ' <' + seller.email + '>' : String(o.seller_id)],
      ['tier', { k: o.tier === 'lab' ? 'tierLab' : 'tierPhoto' }], ['paid', { m: o.total }]],
  }, me.email);
  await tell(env, me, 'problemReceived', { order: o.id, message: note });
  await tell(env, seller, 'problemSeller', { order: o.id, title });
  return json({ ok: true });
}

async function leaveFeedback({ request, env }) {
  const me = await needUser(request, env);
  const b = await body(request);
  const o = await loadOrder(env, intParam(b.orderId));
  if (o.buyer_id !== me.id) fail(403, 'This is not your order', 'not_yours');
  if (o.status !== 'delivered') fail(409, 'Feedback opens once the pair is delivered', 'wrong_step');
  const rating = [1, 0, -1].indexOf(Number(b.rating)) !== -1 ? Number(b.rating) : null;
  if (rating === null) fail(400, 'Choose positive, neutral or negative', 'rating');
  const comment = clean(b.comment || '', 300);
  const r = await env.DB.prepare(
    'INSERT OR IGNORE INTO mk_feedback (order_id, seller_id, buyer_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(o.id, o.seller_id, me.id, rating, comment || null, nowIso()).run();
  if (!r.meta.changes) fail(409, 'You already left feedback for this order', 'feedback_done');
  await logEvent(env, { orderId: o.id, kind: 'feedback', note: String(rating) });
  await tell(env, await userById(env, o.seller_id), 'feedbackNew', {
    order: o.id, rating: { k: rating > 0 ? 'ratePos' : rating < 0 ? 'rateNeg' : 'rateNeu' }, message: comment,
  });
  return json({ ok: true });
}

// ── GET me ─────────────────────────────────────────────────────────────────
async function getMe({ request, env }) {
  const me = await needUser(request, env);
  const spec = isSpecialist(env, me);
  const mine = await env.DB.prepare(
    'SELECT ' + CARD_COLS + `, (SELECT COUNT(*) FROM mk_offers o WHERE o.listing_id = l.id AND o.status = 'pending') AS open_offers
     FROM mk_listings l WHERE l.seller_id = ? ORDER BY l.id DESC LIMIT 100`
  ).bind(me.id).all();
  const received = await env.DB.prepare(
    `SELECT o.*, l.brand, l.model, l.size, l.buy_now, u.name AS buyer_name FROM mk_offers o
     JOIN mk_listings l ON l.id = o.listing_id LEFT JOIN users u ON u.id = o.buyer_id
     WHERE o.seller_id = ? AND o.status IN ('pending','countered') ORDER BY o.id DESC LIMIT 50`
  ).bind(me.id).all();
  const sent = await env.DB.prepare(
    `SELECT o.*, l.brand, l.model, l.size, l.buy_now, l.status AS listing_status FROM mk_offers o
     JOIN mk_listings l ON l.id = o.listing_id WHERE o.buyer_id = ? ORDER BY o.id DESC LIMIT 50`
  ).bind(me.id).all();
  const bidOn = await env.DB.prepare(
    'SELECT ' + CARD_COLS + `, (SELECT MAX(max_amount) FROM mk_bids b WHERE b.listing_id = l.id AND b.bidder_id = ?) AS my_max
     FROM mk_listings l WHERE l.id IN (SELECT DISTINCT listing_id FROM mk_bids WHERE bidder_id = ?)
     ORDER BY CASE l.status WHEN 'live' THEN 0 ELSE 1 END, l.ends_at DESC LIMIT 50`
  ).bind(me.id, me.id).all();
  const watching = await env.DB.prepare(
    'SELECT ' + CARD_COLS + ' FROM mk_listings l JOIN mk_watch w ON w.listing_id = l.id WHERE w.user_id = ? ORDER BY w.created_at DESC LIMIT 60'
  ).bind(me.id).all();
  const orders = await env.DB.prepare(
    'SELECT * FROM mk_orders WHERE buyer_id = ? OR seller_id = ? ORDER BY id DESC LIMIT 60'
  ).bind(me.id, me.id).all();
  const ov = [];
  for (const o of orders.results || []) ov.push(await orderView(env, o, me, false));

  const offerView = (o) => ({
    id: o.id, listingId: o.listing_id, title: listingTitle(o), size: o.size, listPrice: o.buy_now,
    amount: o.amount, counter: o.counter, message: o.message, status: o.status, expiresAt: o.expires_at,
    createdAt: o.created_at, buyer: o.buyer_name ? shortName(o.buyer_name) : undefined, listingStatus: o.listing_status,
  });
  return json({
    user: { id: me.id, name: me.name, email: me.email, verified: !!me.verified },
    specialist: spec,
    connect: connectOn(env),
    seller: await sellerState(env, me.id),
    selling: {
      listings: (mine.results || []).map((l) => Object.assign(card(l), { openOffers: l.open_offers, reviewNote: l.review_note })),
      offers: (received.results || []).map(offerView),
      orders: ov.filter((o) => o.role === 'seller'),
    },
    buying: {
      bids: (bidOn.results || []).map((l) => Object.assign(card(l), { myMax: l.my_max, leading: l.high_bidder === me.id })),
      offers: (sent.results || []).map(offerView),
      orders: ov.filter((o) => o.role === 'buyer'),
    },
    watching: (watching.results || []).map(card),
    onlinePayment: !!env.STRIPE_SECRET_KEY,
  }, 200, { 'Cache-Control': 'no-store' });
}

// ── specialist console ─────────────────────────────────────────────────────
async function getQueue({ request, env }) {
  const me = await needSpecialist(request, env);
  await housekeeping(env, true);
  const review = await env.DB.prepare(
    `SELECT l.*, u.name AS seller_name, u.email AS seller_email, u.email_verified_at AS seller_verified FROM mk_listings l
     LEFT JOIN users u ON u.id = l.seller_id WHERE l.status = 'review' ORDER BY l.id ASC LIMIT 50`
  ).all();
  const items = [];
  for (const l of review.results || []) {
    const ph = await env.DB.prepare('SELECT id, kind FROM mk_photos WHERE listing_id = ? ORDER BY idx').bind(l.id).all();
    items.push(Object.assign(card(l), {
      description: l.description, startPrice: l.start_price, duration: l.duration_days, minOffer: l.min_offer,
      seller: { name: l.seller_name, email: l.seller_email, emailVerifiedAt: l.seller_verified }, sellerId: l.seller_id,
      photos: (ph.results || []).map((p) => ({ url: '/api/market/photo?id=' + p.id, kind: p.kind })),
    }));
  }
  const active = await env.DB.prepare(
    `SELECT * FROM mk_orders WHERE status IN ('paid','to_lab','in_lab','verified','disputed')
       OR (status = 'awaiting_payment' AND pay_mode = 'manual')
       OR (status = 'delivered' AND payout_status IN ('failed','waiting'))
     ORDER BY CASE status WHEN 'disputed' THEN 0 ELSE 1 END, id ASC LIMIT 100`
  ).all();
  const orders = [];
  for (const o of active.results || []) {
    const v = await orderView(env, o, me, true);
    const buyer = await userById(env, o.buyer_id), seller = await userById(env, o.seller_id);
    v.buyer = buyer && { name: buyer.name, email: buyer.email };
    v.seller = seller && { name: seller.name, email: seller.email };
    orders.push(v);
  }
  const stats = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM mk_listings WHERE status = 'live') AS live,
            (SELECT COUNT(*) FROM mk_listings WHERE status = 'review') AS review,
            (SELECT COUNT(*) FROM mk_orders WHERE status NOT IN ('delivered','cancelled','failed','refunded')) AS open_orders,
            (SELECT COUNT(*) FROM mk_orders WHERE status = 'disputed') AS disputes,
            (SELECT COALESCE(SUM(commission + auth_fee),0) FROM mk_orders WHERE status IN ('delivered','shipped','verified')) AS revenue,
            (SELECT COALESCE(SUM(LENGTH(data) + COALESCE(LENGTH(thumb),0)),0) FROM mk_photos WHERE data NOT LIKE 'r2:%') AS photo_bytes,
            (SELECT COUNT(*) FROM mk_photos WHERE data NOT LIKE 'r2:%') AS photos_in_db`
  ).first();
  for (const it of items) {
    const acct = connectOn(env) ? await sellerRow(env, it.sellerId) : null;
    it.seller.verifiedSeller = !!(acct && acct.details_submitted);
    it.seller.emailVerified = !!it.seller.emailVerifiedAt;
    delete it.sellerId; delete it.seller.emailVerifiedAt;
  }
  stats.r2 = !!env.VAULT_PHOTOS;
  stats.connect = connectOn(env);
  return json({ review: items, orders, stats, tickets: await ticketsForQueue(env) }, 200, { 'Cache-Control': 'no-store' });
}

async function review({ request, env }) {
  await needSpecialist(request, env);
  const b = await body(request);
  const l = await env.DB.prepare('SELECT * FROM mk_listings WHERE id = ?').bind(intParam(b.id)).first();
  if (!l || l.status !== 'review') fail(409, 'This listing is not waiting for review', 'wrong_step');
  const at = nowIso(), note = clean(b.note || '', 500);
  const seller = await userById(env, l.seller_id);
  if (b.decision === 'approve') {
    const ends = l.format === 'auction' ? isoIn(l.duration_days * 86400000) : null;
    await env.DB.prepare("UPDATE mk_listings SET status = 'live', live_at = ?, ends_at = ?, review_note = ?, updated_at = ? WHERE id = ? AND status = 'review'")
      .bind(at, ends, note || null, at, l.id).run();
    await logEvent(env, { listingId: l.id, kind: 'approved', note });
    await tell(env, seller, 'listingLive', {
      title: listingTitle(l), url: '/vault-item.html?id=' + l.id, note: { k: l.tier === 'photo' ? 'livePhoto' : 'liveLab' },
    });
  } else if (b.decision === 'reject') {
    if (!note) fail(400, 'Tell the seller why', 'note_needed');
    await env.DB.prepare("UPDATE mk_listings SET status = 'rejected', review_note = ?, updated_at = ? WHERE id = ? AND status = 'review'")
      .bind(note, at, l.id).run();
    await logEvent(env, { listingId: l.id, kind: 'rejected', note });
    await tell(env, seller, 'listingRejected', { title: listingTitle(l), message: note, url: '/vault-sell.html' });
  } else fail(400, 'Unknown decision', 'bad_action');
  return json({ ok: true });
}

async function lab({ request, env }) {
  await needSpecialist(request, env);
  const b = await body(request);
  const o = await loadOrder(env, intParam(b.orderId));
  const note = clean(b.note || '', 500), at = nowIso();
  const l = await loadListing(env, o.listing_id);
  const buyer = await userById(env, o.buyer_id), seller = await userById(env, o.seller_id);
  const title = l ? listingTitle(l) : 'the pair';
  const move = async (from, to, extraCol, extraVal) => {
    const r = await env.DB.prepare(
      'UPDATE mk_orders SET status = ?' + (extraCol ? ', ' + extraCol + ' = ?' : '') + ', updated_at = ? WHERE id = ? AND status = ?'
    ).bind(...[to].concat(extraCol ? [extraVal] : []).concat([at, o.id, from])).run();
    if (!r.meta.changes) fail(409, 'The order is not in the right step for that', 'wrong_step');
    await logEvent(env, { orderId: o.id, kind: to, note: note || extraVal || null });
  };
  switch (b.action) {
    case 'paid':
      if (!(await markPaid(env, o.id, 'manual'))) fail(409, 'The order is not awaiting payment', 'wrong_step');
      break;
    case 'received':
      await move('to_lab', 'in_lab');
      await tell(env, buyer, 'labArrived', { title });
      break;
    case 'pass':
      await move('in_lab', 'verified');
      await tell(env, buyer, 'labPassedBuyer', { title, message: note });
      await tell(env, seller, 'labPassedSeller', { title, payout: { m: o.payout } });
      break;
    case 'fail':
      if (!note) fail(400, 'Record why it failed', 'note_needed');
      await move('in_lab', 'failed');
      await tell(env, buyer, 'labFailedBuyer', { order: o.id, amount: { m: o.total } });
      await tell(env, seller, 'labFailedSeller', { title, message: note });
      // the buyer already heard about the refund in the email above
      await refundOrder(env, o, { note, tellBuyer: false });
      break;
    case 'shipped': {
      const tracking = clean(b.tracking, 80);
      if (!tracking) fail(400, 'Add the tracking number', 'tracking');
      await move('verified', 'shipped', 'tracking_out', tracking);
      await tell(env, buyer, 'labShipped', { title, url: '/vault-me.html#order-' + o.id, rows: [['tracking', tracking]] });
      break;
    }
    // a reported problem ends one of two ways
    case 'release':
      await move('disputed', 'delivered');
      await tell(env, seller, 'disputeReleased', { order: o.id, payout: { m: o.payout }, message: note });
      await tell(env, buyer, 'disputeClosed', { order: o.id, message: note });
      await orderDelivered(env, o, 'released');
      break;
    case 'refund':
      if (!note) fail(400, 'Record why the buyer is refunded', 'note_needed');
      await move('disputed', 'refunded');
      await refundOrder(env, o, { note });
      await tell(env, seller, 'refundedSeller', { order: o.id, title, message: note });
      break;
    // a payout that failed, or waited for the seller's Stripe setup, can be retried
    case 'payout': {
      if (o.status !== 'delivered' || ['failed', 'waiting'].indexOf(o.payout_status) === -1) fail(409, 'This payout cannot be retried', 'wrong_step');
      const res = await releasePayout(env, o, 'retry');
      return json({ ok: res === 'sent', payout: res });
    }
    default: fail(400, 'Unknown action', 'bad_action');
  }
  return json({ ok: true });
}

// ── payouts (Stripe Connect) ───────────────────────────────────────────────
// A seller verifies once with Stripe — identity and bank account, on Stripe's
// own pages — and from then on the money for each delivered order reaches
// their Stripe account by itself.
async function payoutsSetup({ request, env }) {
  const me = await needVerified(request, env);
  if (!connectOn(env)) fail(409, 'Payouts through Stripe are not switched on', 'no_connect');
  let row = await sellerRow(env, me.id);
  if (!row) {
    const a = await stripeApi(env, 'accounts', {
      type: 'express', country: 'DE', email: me.email,
      'capabilities[card_payments][requested]': 'true', 'capabilities[transfers][requested]': 'true',
      'business_profile[mcc]': '5931', 'business_profile[url]': siteUrl(env) + '/vault.html',
      'business_profile[product_description]': 'Selling sneakers on the ShoeLab Vault marketplace',
      'metadata[user_id]': String(me.id),
    }, { idem: 'vault-seller-' + me.id });
    if (!a || !a.id) fail(502, (a && a.error && a.error.message) || 'Stripe could not start the setup', 'stripe_failed');
    await env.DB.prepare('INSERT OR IGNORE INTO mk_sellers (user_id, stripe_account, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .bind(me.id, a.id, nowIso(), nowIso()).run();
    row = await sellerRow(env, me.id);
  }
  const back = siteUrl(env) + '/vault-me.html';
  const link = await stripeApi(env, 'account_links', {
    account: row.stripe_account, type: 'account_onboarding',
    refresh_url: back + '?payouts=retry#payouts', return_url: back + '?payouts=done#payouts',
  });
  if (!link || !link.url) fail(502, (link && link.error && link.error.message) || 'Stripe could not start the setup', 'stripe_failed');
  return json({ ok: true, url: link.url });
}

async function payoutsStatus({ request, env }) {
  const me = await needUser(request, env);
  if (!connectOn(env)) return json({ connect: false });
  const row = await refreshSeller(env, me.id);
  const released = row && row.payouts_enabled ? await releaseWaiting(env, me.id) : 0;
  const waiting = await env.DB.prepare(
    "SELECT COALESCE(SUM(payout),0) AS s, COUNT(*) AS n FROM mk_orders WHERE seller_id = ? AND payout_status IN ('waiting','failed')"
  ).bind(me.id).first();
  const paid = await env.DB.prepare(
    "SELECT COALESCE(SUM(payout),0) AS s, COUNT(*) AS n FROM mk_orders WHERE seller_id = ? AND payout_status = 'sent'"
  ).bind(me.id).first();
  return json({
    connect: true, connected: !!row, ready: !!(row && row.details_submitted), payouts: !!(row && row.payouts_enabled),
    due: row ? row.due : 0, released, waiting: { amount: waiting.s, count: waiting.n }, paid: { amount: paid.s, count: paid.n },
  }, 200, { 'Cache-Control': 'no-store' });
}

// Stripe's own dashboard for the seller: payouts, bank account, tax details.
async function payoutsDashboard({ request, env }) {
  const me = await needUser(request, env);
  const row = connectOn(env) ? await sellerRow(env, me.id) : null;
  if (!row || !row.details_submitted) fail(409, 'Finish setting up payouts first', 'no_connect');
  const l = await stripeApi(env, 'accounts/' + encodeURIComponent(row.stripe_account) + '/login_links', {});
  if (!l || !l.url) fail(502, (l && l.error && l.error.message) || 'Stripe could not open the dashboard', 'stripe_failed');
  return json({ ok: true, url: l.url });
}

// ── support ────────────────────────────────────────────────────────────────
async function supportChatRoute({ request, env }) {
  const me = await currentUser(request, env);
  const r = await supportChat(request, env, me, await body(request));
  return json(r.body, r.status);
}
async function supportTicketRoute({ request, env }) {
  const me = await currentUser(request, env);
  const r = await supportTicket(request, env, me, await body(request));
  return json(r.body, r.status);
}
async function supportAnswerRoute({ request, env }) {
  await needSpecialist(request, env);
  const r = await supportAnswer(env, await body(request));
  return json(r.body, r.status);
}

const ROUTES = {
  'GET config': getConfig,
  'GET listings': getListings,
  'GET listing': getListing,
  'GET photo': getPhoto,
  'GET me': getMe,
  'GET queue': getQueue,
  'POST listings': createListing,
  'POST bid': placeBid,
  'POST buy': buyNow,
  'POST offer': makeOffer,
  'POST offer/respond': respondOffer,
  'POST watch': watch,
  'POST listing/cancel': cancelListing,
  'POST listing/relist': relistListing,
  'POST order/pay': payOrder,
  'POST order/ship': shipOrder,
  'POST order/received': receivedOrder,
  'POST order/problem': reportProblem,
  'POST order/feedback': leaveFeedback,
  'POST review': review,
  'POST lab': lab,
  'POST lab/photos-to-r2': photosToR2,
  'POST payouts/setup': payoutsSetup,
  'GET payouts/status': payoutsStatus,
  'POST payouts/dashboard': payoutsDashboard,
  'POST support/chat': supportChatRoute,
  'POST support/ticket': supportTicketRoute,
  'POST support/answer': supportAnswerRoute,
};

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method === 'OPTIONS') return preflight();
  if (!env.DB) return json({ error: 'The Vault needs its database (DB binding).' }, 503);
  // Sign-ins are signed with this secret; with the built-in fallback anyone
  // could forge one, so money never moves until a real secret is set.
  if (sessionSecret(env) === 'shoelab-dev-secret-change-me') {
    return json({ error: 'The Vault is not switched on yet (SESSION_SECRET missing).', code: 'offline' }, 503);
  }
  const parts = Array.isArray(params.route) ? params.route : [params.route];
  const route = parts.filter(Boolean).join('/');
  const handler = ROUTES[request.method + ' ' + route];
  if (!handler) return json({ error: 'Not found' }, 404);
  try {
    await ensureSchema(env);
    if (route !== 'photo') await housekeeping(env);
    return await handler(context);
  } catch (e) {
    if (e instanceof HttpError) return json(Object.assign({ error: e.message }, e.code ? { code: e.code } : null, e.extra), e.status);
    console.error('vault ' + route + ': ' + (e && e.stack || e));
    return json({ error: 'Something went wrong on our side. Please try again.' }, 500);
  }
}
