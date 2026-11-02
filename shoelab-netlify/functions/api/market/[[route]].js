// ShoeLab Vault API — every /api/market/* route.
//
//   GET  config | listings | listing?id= | photo?id= | me | queue | payouts/status
//   POST listings | bid | buy | offer | offer/respond | watch | listing/cancel
//        listing/relist | order/pay | order/ship | order/received | order/problem
//        order/feedback | payouts/setup | payouts/dashboard | support/chat
//        support/ticket | support/answer | review | lab | lab/photos-to-r2
//        check | check/ask | listing/answer   (the Lab Check, see _shared/labcheck.js)
//        listing/feature                      (featured listings)
//   GET  legit/cert?c=
//   POST legit | legit/pay | legit/run | legit/answer | legit/cert
//        legit/decide | legit/paid | legit/ask (the Legit Check, see _shared/legit.js)
//   GET  reviews | reviews/mine | reviews/queue
//   POST reviews | reviews/idea | reviews/moderate | reviews/idea-status  (see _shared/reviews.js)
import { json, preflight, clean, currentUser, stripeApi, sessionSecret, mailTrouble } from '../../_shared/util.js';
import {
  VAULT, CONDITIONS, TIERS, PHOTO_KINDS, REQUIRED_KINDS, increment, nowIso, isoIn, euro,
  siteUrl, isSpecialist, onSpecialistList, shortName, maskName, fees, ensureSchema, logEvent, userById,
  listingTitle, tell, tellStudio, createOrder, markPaid, shipTo, housekeeping, settleAuction,
  orderDelivered, releasePayout, releaseWaiting, refundOrder, connectOn, sellerRow, refreshSeller, LAB, approveListing,
  featureListing,
} from '../../_shared/vault.js';
import {
  OPEN_LIMIT, LEGIT_VERDICTS, cleanLink, platformOf, normCert, loadLegit, legitView, legitTitle,
  startLegitPayment, legitPaidAtStripe, markLegitPaid, decideLegit, certView, certLive,
} from '../../_shared/legit.js';
import {
  TOPICS as RV_TOPICS, parseRef, eligible as rvEligible, readInvite, submitReview, submitIdea, listReviews,
  reviewQueue, moderate, ideaStatus, sendInvites, allowed as rvAllowed,
} from '../../_shared/reviews.js';
import { supportChat, supportTicket, supportAnswer, ticketsForQueue } from '../../_shared/support.js';
import { runCheck, mayRun, checkView, requestView, latestCheck, latestRequest, askSeller, checkSettings } from '../../_shared/labcheck.js';

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
  if (!isSpecialist(env, u)) {
    if (onSpecialistList(env, u.email)) fail(403, 'Please confirm your email address first', 'verify_email', { email: u.email });
    fail(403, 'Specialists only', 'specialists');
  }
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
  (SELECT id FROM mk_photos p WHERE p.listing_id = l.id AND COALESCE(p.kind, '') != 'extra' ORDER BY idx LIMIT 1) AS photo_id,
  (SELECT COUNT(*) FROM mk_watch w WHERE w.listing_id = l.id) AS watchers`;

function card(l) {
  return {
    id: l.id, title: listingTitle(l), brand: l.brand, model: l.model, size: l.size, cond: l.cond,
    format: l.format, tier: l.tier, price: l.price, buyNow: l.buy_now, bids: l.bids,
    endsAt: l.ends_at, status: l.status, acceptOffers: !!l.accept_offers,
    // cards load the small version; the item page asks for the full photo
    photo: l.photo_id ? '/api/market/photo?id=' + l.photo_id + '&s=t' : null,
    watchers: l.watchers || 0, createdAt: l.created_at, liveAt: l.live_at, updatedAt: l.updated_at,
    featured: !!(l.featured_until && l.status === 'live' && l.featured_until > nowIso()),
    featuredUntil: l.featured_until && l.featured_until > nowIso() ? l.featured_until : null,
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
    legit: VAULT.legit, addons: VAULT.addons, feature: VAULT.feature,
    // where a happy customer can also leave a Google review (optional, shown to everyone)
    googleReviewUrl: /^https:\/\//.test(String(env.GOOGLE_REVIEW_URL || '')) ? env.GOOGLE_REVIEW_URL : null,
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

  // "Featured first" is the default: paid features lead, marked as such, then the newest.
  // nowIso() is our own timestamp, safe to write into the SQL.
  const SORTS = {
    featured: "CASE WHEN l.featured_until > '" + nowIso() + "' THEN 0 ELSE 1 END, COALESCE(l.live_at, l.created_at) DESC",
    ending: "CASE WHEN l.ends_at IS NULL THEN 1 ELSE 0 END, l.ends_at ASC, l.id DESC",
    new: 'COALESCE(l.live_at, l.created_at) DESC',
    price_asc: 'l.price ASC', price_desc: 'l.price DESC',
    popular: 'watchers DESC, l.bids DESC, l.id DESC',
    sold: 'l.updated_at DESC',
  };
  const sort = SORTS[q.get('sort')] ? q.get('sort') : (view === 'sold' ? 'sold' : 'featured');
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

  const photos = await env.DB.prepare("SELECT id, kind FROM mk_photos WHERE listing_id = ? AND COALESCE(kind, '') != 'extra' ORDER BY idx").bind(id).all();
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
  const p = id && await env.DB.prepare(
    'SELECT p.mime, p.data, p.thumb, p.kind, p.legit_id, p.review_id, l.seller_id FROM mk_photos p LEFT JOIN mk_listings l ON l.id = p.listing_id WHERE p.id = ?'
  ).bind(id).first();
  if (!p) return new Response('Not found', { status: 404 });
  // a photo sent on request (it may be a receipt) is shown only to its owner and to
  // specialists; so is every photo of a Legit Check, unless it is on a live certificate
  let privy = p.kind === 'extra', owner = p.seller_id;
  if (p.legit_id) {
    const g = await loadLegit(env, p.legit_id);
    owner = g && g.user_id;
    if (!g || !certLive(g)) privy = true;
  }
  if (p.review_id) {
    const rv = await env.DB.prepare('SELECT user_id, status, publish FROM fb_reviews WHERE id = ?').bind(p.review_id).first();
    owner = rv && rv.user_id;
    if (!rv || rv.status !== 'published' || !rv.publish) privy = true;
  }
  if (privy) {
    const u = await currentUser(request, env);
    if (!u || (u.id !== owner && !isSpecialist(env, u))) return new Response('Not found', { status: 404 });
  }
  const small = q.get('s') === 't' && p.thumb;
  const src = small ? p.thumb : p.data;
  const headers = {
    'Content-Type': small ? 'image/jpeg' : p.mime,
    'Cache-Control': privy ? 'private, no-store' : 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff',
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
  const rows = await env.DB.prepare("SELECT id, listing_id, legit_id, idx, mime, data, thumb FROM mk_photos WHERE data NOT LIKE 'r2:%' LIMIT 15").all();
  let moved = 0;
  for (const p of rows.results || []) {
    const folder = p.legit_id ? 'legit-' + p.legit_id : p.listing_id;
    const data = await putR2(env, folder, String(p.idx), p.mime, p.data);
    const thumb = p.thumb && String(p.thumb).slice(0, 3) !== 'r2:' ? await putR2(env, folder, p.idx + 't', 'image/jpeg', p.thumb) : p.thumb;
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
    addon: o.addon || null, addonFee: o.addon_fee || 0,
    trackingIn: o.tracking_in, trackingOut: o.tracking_out,
    createdAt: o.created_at, updatedAt: o.updated_at,
    // payouts are between the seller and ShoeLab; Stripe references and
    // error texts are for the specialists
    events: (ev.results || []).filter((e) => spec || asSeller || e.kind.indexOf('payout_') !== 0)
      .map((e) => ({ kind: e.kind, note: spec || !/^(payout|refund)_/.test(e.kind) ? e.note : null, at: e.created_at })),
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
  // "Fresh for delivery": a Lab Verified pair passes through the studio, so the
  // buyer can have it cleaned there before it ships (ShoeLab's own service)
  const addon = o.tier === 'lab' && VAULT.addons[b.addon] ? b.addon : null;
  if (addon && !b.addonConsent) fail(400, 'Please confirm that the cleaning may start before the withdrawal period ends', 'addon_consent');
  const addonFee = addon ? VAULT.addons[addon] : 0;
  o.total = o.item_price + o.auth_fee + o.ship_fee + addonFee;
  o.addon = addon; o.addon_fee = addonFee;
  await env.DB.prepare(
    'UPDATE mk_orders SET ship_name = ?, ship_line1 = ?, ship_line2 = ?, ship_city = ?, ship_postal = ?, ship_country = ?, addon = ?, addon_fee = ?, total = ?, updated_at = ? WHERE id = ?'
  ).bind(addr.name, addr.line1, addr.line2, addr.city, addr.postal, addr.country, addon, addonFee, o.total, nowIso(), o.id).run();

  const l = await loadListing(env, o.listing_id);
  if (env.STRIPE_SECRET_KEY) {
    const site = siteUrl(env);
    const s = await stripeApi(env, 'checkout/sessions', {
      mode: 'payment',
      'line_items[0][quantity]': 1,
      'line_items[0][price_data][currency]': 'eur',
      'line_items[0][price_data][unit_amount]': o.total - addonFee,
      'line_items[0][price_data][product_data][name]': 'ShoeLab Vault: ' + listingTitle(l) + ' (EU ' + l.size + ')',
      'line_items[0][price_data][product_data][description]':
        'Item ' + euro(o.item_price) + ' + authentication ' + euro(o.auth_fee) + ' + shipping ' + euro(o.ship_fee),
      ...(addon ? {
        'line_items[1][quantity]': 1,
        'line_items[1][price_data][currency]': 'eur',
        'line_items[1][price_data][unit_amount]': addonFee,
        'line_items[1][price_data][product_data][name]': 'ShoeLab ' + (addon === 'revival' ? 'Revival' : 'Refresh') + ': cleaned in our Bremen studio before it ships',
      } : {}),
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
      rows: [['item', listingTitle(l) + ' · EU ' + l.size], ['tracking', tracking], ['seller', me.name + ' <' + me.email + '>'],
        o.addon ? ['cleaning', { k: 'addon_' + o.addon }] : null].filter(Boolean),
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
      listings: await Promise.all((mine.results || []).map(async (l) => {
        const c = Object.assign(card(l), { openOffers: l.open_offers, reviewNote: l.review_note });
        if (l.status === 'review') {
          const q = requestView(await latestRequest(env, l.id));
          if (q && q.status === 'open') c.request = { id: q.id, items: q.items.map((x) => ({ type: x.type, title: x.title, instructions: x.instructions })) };
        }
        return c;
      })),
      offers: (received.results || []).map(offerView),
      orders: ov.filter((o) => o.role === 'seller'),
    },
    buying: {
      bids: (bidOn.results || []).map((l) => Object.assign(card(l), { myMax: l.my_max, leading: l.high_bidder === me.id })),
      offers: (sent.results || []).map(offerView),
      orders: ov.filter((o) => o.role === 'buyer'),
    },
    watching: (watching.results || []).map(card),
    legit: await Promise.all(((await env.DB.prepare('SELECT * FROM mk_legit WHERE user_id = ? ORDER BY id DESC LIMIT 30').bind(me.id).all()).results || [])
      .map((g) => legitView(env, g, false))),
    reviewed: ((await env.DB.prepare("SELECT ref_kind, ref_id FROM fb_reviews WHERE kind = 'review' AND user_id = ? AND ref_kind IS NOT NULL").bind(me.id).all()).results || [])
      .map((x) => x.ref_kind + '-' + x.ref_id),
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
    const ph = await env.DB.prepare('SELECT id, kind, note FROM mk_photos WHERE listing_id = ? ORDER BY idx, id').bind(l.id).all();
    items.push(Object.assign(card(l), {
      description: l.description, startPrice: l.start_price, duration: l.duration_days, minOffer: l.min_offer,
      seller: { name: l.seller_name, email: l.seller_email, emailVerifiedAt: l.seller_verified }, sellerId: l.seller_id,
      photos: (ph.results || []).map((p) => ({ id: p.id, url: '/api/market/photo?id=' + p.id, kind: p.kind, note: p.note || null })),
      check: checkView(await latestCheck(env, l.id)), request: requestView(await latestRequest(env, l.id)),
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
  stats.labCheck = checkSettings(env);
  // pairs the Lab Check put live by itself lately, so a person still sees them
  const auto = await env.DB.prepare(
    `SELECT e.listing_id AS id, e.created_at AS at, l.brand, l.model, l.size, c.confidence FROM mk_events e
       JOIN mk_listings l ON l.id = e.listing_id
       LEFT JOIN mk_checks c ON c.id = (SELECT MAX(id) FROM mk_checks WHERE listing_id = e.listing_id AND status = 'done')
     WHERE e.kind = 'auto_approved' ORDER BY e.id DESC LIMIT 10`
  ).all();
  stats.autoApproved = (auto.results || []).map((x) => ({ id: x.id, at: x.at, title: listingTitle(x), size: x.size, confidence: x.confidence }));
  // emails that did not go out this week: the console warns until one goes out again
  const trouble = await mailTrouble(env);
  stats.mail_failures = trouble.failing;
  stats.mail_failure_last = trouble.last;
  const week = new Date(Date.now() - 7 * 86400000).toISOString();
  const lg = await env.DB.prepare(
    `SELECT * FROM mk_legit WHERE status IN ('checking','needs_info','review') OR (status = 'awaiting_payment' AND pay_mode = 'manual')
       OR (status = 'done' AND decided_at > ?) ORDER BY CASE status WHEN 'review' THEN 0 WHEN 'checking' THEN 1 WHEN 'needs_info' THEN 2
       WHEN 'awaiting_payment' THEN 3 ELSE 4 END, id ASC LIMIT 60`
  ).bind(week).all();
  const legit = [];
  for (const g of lg.results || []) legit.push(await legitView(env, g, true));
  return json({ review: items, orders, stats, tickets: await ticketsForQueue(env), legit }, 200, { 'Cache-Control': 'no-store' });
}

async function review({ request, env }) {
  await needSpecialist(request, env);
  const b = await body(request);
  const l = await env.DB.prepare('SELECT * FROM mk_listings WHERE id = ?').bind(intParam(b.id)).first();
  if (!l || l.status !== 'review') fail(409, 'This listing is not waiting for review', 'wrong_step');
  const at = nowIso(), note = clean(b.note || '', 500);
  const seller = await userById(env, l.seller_id);
  if (b.decision === 'approve') {
    await approveListing(env, l, note, 'approved');
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
    // a key per ten minutes: a double click creates one account, while an
    // error Stripe remembers (say, Connect not switched on yet) clears soon
    }, { idem: 'vault-seller-' + me.id + '-' + Math.floor(Date.now() / 600000) });
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

// ── POST check — run the Lab Check on a listing waiting for review ─────────
// The seller's page starts it right after a listing is sent (and again after
// they answer a request); the console starts it for any listing without a
// current result. The seller only learns whether more is needed, never the
// verdict or the findings: those would teach a forger what to fix.
async function checkRoute({ request, env }) {
  const me = await needUser(request, env);
  const b = await body(request);
  const l = await env.DB.prepare('SELECT * FROM mk_listings WHERE id = ?').bind(intParam(b.id)).first();
  if (!l) fail(404, 'Listing not found', 'not_found');
  const spec = isSpecialist(env, me);
  if (!spec && l.seller_id !== me.id) fail(404, 'Listing not found', 'not_found');
  const why = await mayRun(env, l, spec && !!b.force);
  const forSeller = (outcome, req) => ({ ok: true, outcome: outcome === 'approved' ? 'approved' : req && req.status === 'open' ? 'asked' : 'done' });
  if (why === 'running' || why === 'up_to_date') {
    const req = requestView(await latestRequest(env, l.id));
    return json(spec ? { ok: true, running: why === 'running', check: checkView(await latestCheck(env, l.id)), request: req }
      : Object.assign(forSeller(why === 'running' ? 'running' : 'done', req), why === 'running' ? { outcome: 'running' } : {}));
  }
  if (why === 'wrong_step') fail(409, 'This listing is not waiting for review', 'wrong_step');
  if (why === 'check_off') fail(409, 'The Lab Check is switched off', 'check_off');
  if (why === 'check_limit') fail(429, 'This listing has been checked often enough today', 'check_limit');
  const ran = await runCheck(env, l, spec ? 'specialist' : 'seller');
  const req = requestView(await latestRequest(env, l.id));
  if (!ran) return json(spec ? { ok: true, running: true, check: checkView(await latestCheck(env, l.id)), request: req } : { ok: true, outcome: 'running' });
  return json(spec ? { ok: true, check: ran.check, request: req, outcome: ran.outcome } : forSeller(ran.outcome, req));
}

// ── POST check/ask — a specialist sends the check's requests to the seller ──
// For a suspected fake the check never asks by itself; this is the button.
async function checkAsk({ request, env }) {
  await needSpecialist(request, env);
  const b = await body(request);
  const l = await env.DB.prepare('SELECT * FROM mk_listings WHERE id = ?').bind(intParam(b.id)).first();
  if (!l || l.status !== 'review') fail(409, 'This listing is not waiting for review', 'wrong_step');
  const c = checkView(await latestCheck(env, l.id));
  const items = c && c.result && c.result.requests;
  if (!items || !items.length) fail(409, 'The check has nothing to ask for', 'nothing_to_ask');
  if (!await askSeller(env, l, await userById(env, l.seller_id), c.id, items, true)) fail(409, 'The seller has an open request already', 'request_open');
  return json({ ok: true, request: requestView(await latestRequest(env, l.id)) });
}

// ── POST listing/answer — the seller sends what the check asked for ────────
// One answer per item: a photo, a short text, or "I can't provide this".
async function answerRequest({ request, env }) {
  const me = await needUser(request, env);
  const b = await body(request);
  const l = await env.DB.prepare('SELECT * FROM mk_listings WHERE id = ?').bind(intParam(b.id)).first();
  if (!l || l.seller_id !== me.id) fail(404, 'Listing not found', 'not_found');
  const q = await env.DB.prepare("SELECT * FROM mk_requests WHERE listing_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1").bind(l.id).first();
  if (!q || l.status !== 'review') fail(409, 'There is nothing to answer for this listing', 'no_request');
  const n = await saveAnswers(env, l, q, b);
  await logEvent(env, { listingId: l.id, kind: 'info_sent', note: n + ' answer(s)' });
  return json({ ok: true });
}
// One answer per item: a photo (stored as a private 'extra' photo), a short
// text, or "I can't provide this". subj is a listing, or a Legit Check (legit).
async function saveAnswers(env, subj, q, b) {
  const legit = !!subj.legit;
  // the specialist sent a newer list while this page was open
  if (b.request && +b.request !== q.id) fail(409, 'The request has changed: reload the page', 'request_changed');
  const items = JSON.parse(q.items || '[]');
  const given = Array.isArray(b.answers) ? b.answers : [];
  const answers = [], photos = [];
  items.forEach((it, i) => {
    const a = given.find((x) => x && +x.i === i) || {};
    if (a.none) { answers.push({ i, none: true }); return; }
    if (it.type === 'text') {
      const text = clean(String(a.text || ''), 600);
      if (!text) fail(400, 'Answer every point, or tick that you cannot provide it', 'answer_missing');
      answers.push({ i, text });
      return;
    }
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(a.photo && a.photo.data || ''));
    if (!m) fail(400, 'Answer every point, or tick that you cannot provide it', 'answer_missing');
    if (m[2].length * 0.75 > VAULT.maxPhotoBytes) fail(400, 'A photo is too large — keep each under 750 KB', 'photo_big');
    const t = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(a.photo.thumb || ''));
    photos.push({ i, mime: m[1], data: m[2], thumb: t && t[1].length * 0.75 <= VAULT.maxThumbBytes ? t[1] : null, note: it.title_en || it.title });
    answers.push({ i, photo: true });
  });
  const at = nowIso();
  const top = await env.DB.prepare('SELECT COALESCE(MAX(idx), -1) AS n FROM mk_photos WHERE ' + (legit ? 'legit_id' : 'listing_id') + ' = ?').bind(subj.id).first();
  for (let k = 0; k < photos.length; k++) {
    const p = photos[k], idx = top.n + 1 + k;
    const stored = await storePhoto(env, legit ? 'legit-' + subj.id : subj.id, idx, p);
    await env.DB.prepare('INSERT INTO mk_photos (listing_id, legit_id, idx, kind, note, mime, data, thumb, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(legit ? 0 : subj.id, legit ? subj.id : null, idx, 'extra', clean(p.note, 120), p.mime, stored.data, stored.thumb, at).run();
  }
  await env.DB.prepare("UPDATE mk_requests SET answers = ?, status = 'answered', answered_at = ? WHERE id = ? AND status = 'open'")
    .bind(JSON.stringify(answers), at, q.id).run();
  return answers.length;
}

// ── the Legit Check (see _shared/legit.js) ────────────────────────────────
// Photos arrive like a listing's: data URLs compressed on the phone, each
// labelled with what it shows. An owner needs the full photo set; a buyer
// may only have the other seller's pictures, so three will do.
async function createLegit({ request, env }) {
  const me = await needVerified(request, env);
  const b = await body(request);
  const mode = b.mode === 'sell' ? 'sell' : b.mode === 'buy' ? 'buy' : null;
  if (!mode) fail(400, 'Choose whether you are buying or selling', 'legit_mode');
  const brand = clean(b.brand || '', 40), model = clean(b.model || '', 80), size = clean(String(b.size || ''), 8);
  if (!brand || !model || !size) fail(400, 'Add the brand, model and size', 'legit_fields');
  const link = b.link ? cleanLink(b.link) : null;
  if (b.link && !link) fail(400, 'That link does not look right', 'legit_link');
  let asked = null;
  if (b.askedPrice != null && b.askedPrice !== '') {
    asked = cents(b.askedPrice);
    if (!(asked > 0 && asked <= VAULT.maxPrice)) fail(400, 'That price does not look right', 'legit_price');
  }
  if (VAULT.legit && !b.consent) fail(400, 'Please confirm that the check may start right away', 'legit_consent');
  const open = await env.DB.prepare("SELECT COUNT(*) AS n FROM mk_legit WHERE user_id = ? AND status = 'awaiting_payment'").bind(me.id).first();
  if ((open.n || 0) >= OPEN_LIMIT) fail(429, 'Pay or cancel your open Legit Checks first', 'legit_open');
  const photos = (Array.isArray(b.photos) ? b.photos : []).slice(0, VAULT.maxPhotos + 1);
  if (photos.length > VAULT.maxPhotos) fail(400, 'Too many photos', 'too_many_photos', { max: VAULT.maxPhotos });
  const parsed = photos.map((p) => {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(p && p.data || ''));
    if (!m) fail(400, 'One of the photos could not be read', 'photo_bad');
    if (m[2].length * 0.75 > VAULT.maxPhotoBytes) fail(400, 'A photo is too large — keep each under 750 KB', 'photo_big');
    const t = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(p.thumb || ''));
    return { kind: PHOTO_KINDS.indexOf(p.kind) !== -1 ? p.kind : 'other', mime: m[1], data: m[2], thumb: t && t[1].length * 0.75 <= VAULT.maxThumbBytes ? t[1] : null };
  });
  if (mode === 'sell') {
    const have = parsed.map((p) => p.kind);
    const missing = REQUIRED_KINDS.photo.filter((k) => have.indexOf(k) === -1);
    if (missing.length) fail(400, 'Some required photos are missing', 'photos_missing', { missing });
  } else if (parsed.length < 3) fail(400, 'Add at least three photos', 'legit_photos');
  const at = nowIso();
  const res = await env.DB.prepare(
    `INSERT INTO mk_legit (user_id, mode, brand, model, size, link, platform, asked_price, note, status, fee, cert_public, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_payment', ?, ?, ?, ?)`
  ).bind(me.id, mode, brand, model, size, link, link ? platformOf(link) : (clean(b.platform || '', 40) || null), asked,
    clean(b.note || '', 600) || null, VAULT.legit, b.publish === false ? 0 : 1, at, at).run();
  const id = res.meta.last_row_id;
  for (let i = 0; i < parsed.length; i++) {
    const stored = await storePhoto(env, 'legit-' + id, i, parsed[i]);
    await env.DB.prepare('INSERT INTO mk_photos (listing_id, legit_id, idx, kind, mime, data, thumb, created_at) VALUES (0, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, i, parsed[i].kind, parsed[i].mime, stored.data, stored.thumb, at).run();
  }
  const g = await loadLegit(env, id);
  const pay = await startLegitPayment(env, g, me);
  return json(Object.assign({ ok: true, id }, pay.error ? { payError: pay.error } : pay));
}
async function ownLegit(request, env, b) {
  const me = await needUser(request, env);
  const g = await loadLegit(env, intParam(b.id));
  const spec = isSpecialist(env, me);
  if (!g || (g.user_id !== me.id && !spec)) fail(404, 'Legit Check not found', 'not_found');
  return { me, g, spec };
}
async function payLegit({ request, env }) {
  const b = await body(request);
  const { me, g } = await ownLegit(request, env, b);
  if (g.user_id !== me.id) fail(404, 'Legit Check not found', 'not_found');
  if (g.status !== 'awaiting_payment') fail(409, 'This Legit Check has already been paid', 'already_paid');
  if (VAULT.legit && !b.consent && g.pay_mode !== 'manual') fail(400, 'Please confirm that the check may start right away', 'legit_consent');
  const pay = await startLegitPayment(env, g, me);
  if (pay.error) fail(502, pay.error, 'pay_failed');
  return json(Object.assign({ ok: true }, pay));
}
// Runs the Lab Check on a paid Legit Check. The owner's page calls this on
// coming back from paying (Stripe may not have told us yet: we ask it), and
// the console calls it for any paid check without a current result.
async function runLegit({ request, env }) {
  const b = await body(request);
  const { g: g0, spec } = await ownLegit(request, env, b);
  let g = g0;
  if (g.status === 'awaiting_payment' && await legitPaidAtStripe(env, g)) g = await loadLegit(env, g.id);
  if (g.status === 'awaiting_payment') return json({ ok: true, outcome: 'unpaid' });
  if (g.status === 'done') return json({ ok: true, outcome: 'done' });
  const why = await mayRun(env, g, spec && !!b.force);
  const reply = async (outcome, extra) => {
    const fresh = await loadLegit(env, g.id);
    return json(Object.assign({ ok: true, outcome, status: fresh.status }, spec ? { legit: await legitView(env, fresh, true) } : {}, extra || {}));
  };
  if (why === 'check_off') {                              // a specialist checks it by hand
    await env.DB.prepare("UPDATE mk_legit SET status = 'review', updated_at = ? WHERE id = ? AND status = 'checking'").bind(nowIso(), g.id).run();
    return reply('review');
  }
  if (why === 'running') return reply('running');
  if (why === 'up_to_date') return reply(g.status === 'needs_info' ? 'asked' : 'review');
  if (why === 'check_limit') fail(429, 'This pair has been checked often enough today', 'check_limit');
  if (why) fail(409, 'This Legit Check is not waiting for a check', 'wrong_step');
  const ran = await runCheck(env, g, spec ? 'specialist' : 'customer');
  if (!ran) return reply('running');
  if (ran.outcome === 'error') {
    // the specialist can still decide from the photos
    await env.DB.prepare("UPDATE mk_legit SET status = 'review', updated_at = ? WHERE id = ? AND status = 'checking'").bind(nowIso(), g.id).run();
  }
  return reply(ran.outcome === 'asked' ? 'asked' : 'review');
}
async function answerLegit({ request, env }) {
  const b = await body(request);
  const { me, g } = await ownLegit(request, env, b);
  if (g.user_id !== me.id) fail(404, 'Legit Check not found', 'not_found');
  const q = await env.DB.prepare("SELECT * FROM mk_requests WHERE legit_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1").bind(g.id).first();
  if (!q || ['checking', 'needs_info', 'review'].indexOf(g.status) === -1) fail(409, 'There is nothing to answer for this check', 'no_request');
  await saveAnswers(env, g, q, b);
  await env.DB.prepare("UPDATE mk_legit SET status = 'checking', updated_at = ? WHERE id = ? AND status IN ('needs_info','review')").bind(nowIso(), g.id).run();
  return json({ ok: true });
}
async function askLegit({ request, env }) {
  await needSpecialist(request, env);
  const b = await body(request);
  const g = await loadLegit(env, intParam(b.id));
  if (!g || ['checking', 'needs_info', 'review'].indexOf(g.status) === -1) fail(409, 'This Legit Check is not open', 'wrong_step');
  const c = checkView(await latestCheck(env, g.id, true));
  const items = c && c.result && c.result.requests;
  if (!items || !items.length) fail(409, 'The check has nothing to ask for', 'nothing_to_ask');
  if (!await askSeller(env, g, await userById(env, g.user_id), c.id, items, true)) fail(409, 'The customer has an open request already', 'request_open');
  await env.DB.prepare("UPDATE mk_legit SET status = 'needs_info', updated_at = ? WHERE id = ?").bind(nowIso(), g.id).run();
  return json({ ok: true, legit: await legitView(env, await loadLegit(env, g.id), true) });
}
async function decideLegitRoute({ request, env }) {
  await needSpecialist(request, env);
  const b = await body(request);
  const g = await loadLegit(env, intParam(b.id));
  if (!g || ['checking', 'needs_info', 'review'].indexOf(g.status) === -1) fail(409, 'This Legit Check is not waiting for a decision', 'wrong_step');
  if (LEGIT_VERDICTS.indexOf(b.verdict) === -1) fail(400, 'Choose a verdict', 'legit_verdict');
  const note = clean(b.note || '', 800);
  if (b.verdict !== 'authentic' && !note) fail(400, 'Add a note for the customer', 'note_needed');
  const out = await decideLegit(env, g, b.verdict, note);
  if (!out) fail(409, 'This Legit Check is not waiting for a decision', 'wrong_step');
  return json({ ok: true, refund: out.refund, legit: await legitView(env, await loadLegit(env, g.id), true) });
}
async function paidLegit({ request, env }) {
  await needSpecialist(request, env);
  const b = await body(request);
  const g = await loadLegit(env, intParam(b.id));
  if (!g || g.status !== 'awaiting_payment') fail(409, 'This Legit Check is not waiting for payment', 'wrong_step');
  await markLegitPaid(env, g.id, 'manual');
  return json({ ok: true, legit: await legitView(env, await loadLegit(env, g.id), true) });
}
// the owner shows or hides their certificate; a specialist can withdraw it
async function certLegit({ request, env }) {
  const b = await body(request);
  const { me, g, spec } = await ownLegit(request, env, b);
  if (!g.cert) fail(409, 'This check has no certificate', 'no_cert');
  if (b.revoke != null) {
    if (!spec) fail(403, 'Specialists only', 'specialists');
    await env.DB.prepare('UPDATE mk_legit SET cert_revoked = ?, updated_at = ? WHERE id = ?').bind(b.revoke ? 1 : 0, nowIso(), g.id).run();
  } else {
    if (g.user_id !== me.id) fail(404, 'Legit Check not found', 'not_found');
    await env.DB.prepare('UPDATE mk_legit SET cert_public = ?, updated_at = ? WHERE id = ?').bind(b.public ? 1 : 0, nowIso(), g.id).run();
  }
  return json({ ok: true, legit: await legitView(env, await loadLegit(env, g.id), spec && g.user_id !== me.id) });
}
async function getCert({ request, env }) {
  const code = normCert(new URL(request.url).searchParams.get('c'));
  if (!code) fail(404, 'No certificate with that number', 'cert_unknown');
  const v = await certView(env, code);
  if (!v) fail(404, 'No certificate with that number', 'cert_unknown');
  return json(v, 200, { 'Cache-Control': 'no-store' });
}

// ── reviews and the satisfaction survey (see _shared/reviews.js) ─────────
async function getReviews({ request, env }) {
  return json(await listReviews(env, new URL(request.url).searchParams), 200, { 'Cache-Control': 'no-store' });
}
// what the visitor may review (verified), and a booking invitation's details
async function getMyReviews({ request, env }) {
  const me = await currentUser(request, env);
  const q = new URL(request.url).searchParams;
  const out = { signedIn: !!me, name: me ? shortName(me.name) : null, eligible: await rvEligible(env, me) };
  const ref = parseRef(q.get('ref')), inv = await readInvite(env, q.get('k'));
  if (ref && ref.kind === 'booking' && inv && inv.id === ref.id) {
    const b = await env.DB.prepare('SELECT id, service, date, first_name, last_name FROM bookings WHERE id = ?').bind(ref.id).first();
    const done = await env.DB.prepare("SELECT id FROM fb_reviews WHERE kind = 'review' AND ref_kind = 'booking' AND ref_id = ?").bind(ref.id).first();
    if (b) out.invite = { ref: 'booking-' + b.id, topic: 'studio', label: b.service, date: b.date, name: shortName((b.first_name || '') + ' ' + (b.last_name || '')), done: !!done };
  }
  return json(out, 200, { 'Cache-Control': 'no-store' });
}
async function postReview({ request, env }) {
  const me = await currentUser(request, env);
  const b = await body(request);
  if (b.website) return json({ ok: true, id: 0 });           // a bot filled the hidden field
  // an invitation link is proof enough (and a booking is reviewed only once), so it skips the per-network limit
  const inv = me ? null : await readInvite(env, b.k), ref = parseRef(b.ref);
  const invited = !!(inv && ref && ref.kind === 'booking' && ref.id === inv.id);
  if (!invited && !await rvAllowed(env, request, me, 'rv', me ? 6 : 3)) fail(429, 'That is enough reviews for today — thank you!', 'rv_limit');
  const photos = (Array.isArray(b.photos) ? b.photos : []).slice(0, 3);
  const parsed = photos.map((p) => {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(p && p.data || ''));
    if (!m) fail(400, 'One of the photos could not be read', 'photo_bad');
    if (m[2].length * 0.75 > VAULT.maxPhotoBytes) fail(400, 'A photo is too large — keep each under 750 KB', 'photo_big');
    const t = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(p.thumb || ''));
    return { mime: m[1], data: m[2], thumb: t && t[1].length * 0.75 <= VAULT.maxThumbBytes ? t[1] : null };
  });
  const saver = async (id) => {
    const at = nowIso();
    for (let i = 0; i < parsed.length; i++) {
      const stored = await storePhoto(env, 'review-' + id, i, parsed[i]);
      await env.DB.prepare("INSERT INTO mk_photos (listing_id, review_id, idx, kind, mime, data, thumb, created_at) VALUES (0, ?, ?, 'other', ?, ?, ?, ?)")
        .bind(id, i, parsed[i].mime, stored.data, stored.thumb, at).run();
    }
    return parsed.length;
  };
  const out = await submitReview(env, me, b, saver);
  if (out.error) fail(out.status, out.error, out.code);
  if (!invited) await rvAllowed(env, request, me, 'rv', 0, true);
  return json(Object.assign({ ok: true }, out));
}
async function postIdea({ request, env }) {
  const me = await currentUser(request, env);
  const b = await body(request);
  if (b.website) return json({ ok: true });
  if (!await rvAllowed(env, request, me, 'idea', 5)) fail(429, 'That is enough ideas for today — thank you!', 'rv_limit');
  const out = await submitIdea(env, me, b);
  if (out.error) fail(out.status, out.error, out.code);
  await rvAllowed(env, request, me, 'idea', 0, true);
  return json({ ok: true });
}
async function getReviewQueue({ request, env }) {
  await needSpecialist(request, env);
  return json(await reviewQueue(env), 200, { 'Cache-Control': 'no-store' });
}
async function postModerate({ request, env }) {
  await needSpecialist(request, env);
  const b = await body(request);
  const out = await moderate(env, intParam(b.id), b.action, b.reason, b.reply);
  if (out.error) fail(out.status, out.error, out.code);
  return json({ ok: true });
}
async function postIdeaStatus({ request, env }) {
  await needSpecialist(request, env);
  const b = await body(request);
  const out = await ideaStatus(env, intParam(b.id), b.status);
  if (out.error) fail(out.status, out.error, out.code);
  return json({ ok: true });
}

// ── POST listing/feature — show a live listing first for a week ───────────
// Sellers pay by card (VAULT.feature); a specialist can feature one for free.
async function featureRoute({ request, env }) {
  const me = await needUser(request, env);
  const b = await body(request);
  const l = await loadListing(env, intParam(b.id));
  const spec = isSpecialist(env, me);
  if (!l || (l.seller_id !== me.id && !spec)) fail(404, 'Listing not found', 'not_found');
  if (l.status !== 'live') fail(409, 'Only a live listing can be featured', 'wrong_step');
  if (spec && b.free) return json({ ok: true, until: await featureListing(env, l.id, 'free') });
  if (l.seller_id !== me.id) fail(404, 'Listing not found', 'not_found');
  if (!env.STRIPE_SECRET_KEY) fail(409, 'Featuring needs card payments, which are not switched on yet', 'feature_off');
  if (!b.consent) fail(400, 'Please confirm that the feature may start right away', 'feature_consent');
  const site = siteUrl(env);
  const s = await stripeApi(env, 'checkout/sessions', {
    mode: 'payment',
    'line_items[0][quantity]': 1,
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': VAULT.feature.price,
    'line_items[0][price_data][product_data][name]': 'ShoeLab Vault: featured for ' + VAULT.feature.days + ' days — ' + listingTitle(l),
    success_url: site + '/vault-me.html?featured=' + l.id + '#selling',
    cancel_url: site + '/vault-me.html#selling',
    customer_email: me.email,
    client_reference_id: 'feature_' + l.id,
    'metadata[vault_feature]': String(l.id),
    'payment_intent_data[metadata][vault_feature]': String(l.id),
  });
  if (!s || !s.url) fail(502, (s && s.error && s.error.message) || 'Payment could not be started', 'pay_failed');
  return json({ ok: true, url: s.url });
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
  'POST check': checkRoute,
  'POST check/ask': checkAsk,
  'POST listing/answer': answerRequest,
  'POST listing/feature': featureRoute,
  'GET legit/cert': getCert,
  'GET reviews': getReviews,
  'GET reviews/mine': getMyReviews,
  'GET reviews/queue': getReviewQueue,
  'POST reviews': postReview,
  'POST reviews/idea': postIdea,
  'POST reviews/moderate': postModerate,
  'POST reviews/idea-status': postIdeaStatus,
  'POST legit': createLegit,
  'POST legit/pay': payLegit,
  'POST legit/run': runLegit,
  'POST legit/answer': answerLegit,
  'POST legit/ask': askLegit,
  'POST legit/decide': decideLegitRoute,
  'POST legit/paid': paidLegit,
  'POST legit/cert': certLegit,
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
    if (route !== 'photo') { await housekeeping(env); await sendInvites(env); }
    return await handler(context);
  } catch (e) {
    if (e instanceof HttpError) return json(Object.assign({ error: e.message }, e.code ? { code: e.code } : null, e.extra), e.status);
    console.error('vault ' + route + ': ' + (e && e.stack || e));
    return json({ error: 'Something went wrong on our side. Please try again.' }, 500);
  }
}
