// ShoeLab Vault — shared marketplace core: rules, schema, settlement, mail.
//
// Money is always integer cents. Times are ISO-8601 UTC strings, which sort
// correctly as text, so "ends_at <= ?" comparisons work in SQL directly.

import { sendEmail, notifyAddress, dropoffInstructions } from './util.js';

// ── rules ───────────────────────────────────────────────────────────────────
// Starting values — every fee is a placeholder to be tuned once the Vault has
// real traffic. The seller's commission comes off their sale price; the buyer
// pays the authentication fee for the tier the seller chose, plus shipping.
export const VAULT = {
  commission: 0.08,
  fees: { photo: 490, lab: 1290 },
  shipping: 699,
  minPrice: 1000,
  maxPrice: 2000000,
  durations: [1, 3, 5, 7],
  softCloseMs: 2 * 60 * 1000,
  offerTtlMs: 48 * 3600 * 1000,
  payTtlMs: 72 * 3600 * 1000,
  autoDeliverMs: 14 * 24 * 3600 * 1000,
  maxPhotos: 8,
  maxPhotoBytes: 750 * 1024,
};

export const CONDITIONS = ['new', 'like_new', 'good', 'fair'];
export const TIERS = ['photo', 'lab'];
export const PHOTO_KINDS = ['side_out', 'side_in', 'sole', 'size_tag', 'box_label', 'insole', 'heel', 'toe', 'other'];
// A photo check stands or falls on the details fakes get wrong, so it needs
// more angles than a listing that will be inspected by hand anyway.
export const REQUIRED_KINDS = {
  photo: ['side_out', 'side_in', 'sole', 'size_tag', 'box_label', 'insole'],
  lab: ['side_out', 'sole', 'size_tag'],
};

// Bid steps scale with the price, as on every auction site.
export function increment(c) {
  if (c < 5000) return 100;
  if (c < 20000) return 250;
  if (c < 50000) return 500;
  if (c < 100000) return 1000;
  return 2500;
}

export function nowIso() { return new Date().toISOString(); }
export function isoIn(ms) { return new Date(Date.now() + ms).toISOString(); }

export function euro(c) {
  return '€' + (Math.round(c) / 100).toFixed(2);
}

export function siteUrl(env) {
  return (env.SITE_URL || 'https://shoelabonline.de').replace(/\/$/, '');
}

export function isSpecialist(env, user) {
  if (!user || !user.email) return false;
  const list = String(env.VAULT_SPECIALISTS || notifyAddress(env))
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.indexOf(String(user.email).toLowerCase()) !== -1;
}

// "Lena Koch" -> "Lena K."  — enough to recognise a seller, not to find them.
export function shortName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Member';
  return parts[0] + (parts[1] ? ' ' + parts[1][0].toUpperCase() + '.' : '');
}

// Bidders are masked the way eBay does it: "L***a".
export function maskName(name) {
  const s = String(name || '').replace(/\s+/g, '');
  if (s.length < 2) return '***';
  return s[0].toUpperCase() + '***' + s[s.length - 1].toLowerCase();
}

export function fees(tier, itemPrice) {
  const authFee = VAULT.fees[tier] || 0;
  const commission = Math.round(itemPrice * VAULT.commission);
  // On a photo-check sale the seller posts straight to the buyer, so the
  // buyer's shipping charge goes to them; on a lab sale ShoeLab ships.
  const payout = itemPrice - commission + (tier === 'photo' ? VAULT.shipping : 0);
  return {
    authFee, shipFee: VAULT.shipping, commission,
    total: itemPrice + authFee + VAULT.shipping, payout,
  };
}

// ── schema ──────────────────────────────────────────────────────────────────
// Created on first use, so the Vault works without a manual migration step.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS mk_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    brand TEXT NOT NULL, model TEXT NOT NULL, size TEXT NOT NULL, cond TEXT NOT NULL,
    description TEXT,
    format TEXT NOT NULL, tier TEXT NOT NULL,
    start_price INTEGER, buy_now INTEGER,
    accept_offers INTEGER NOT NULL DEFAULT 0, min_offer INTEGER,
    duration_days INTEGER,
    price INTEGER NOT NULL,
    high_bidder INTEGER, high_max INTEGER,
    bids INTEGER NOT NULL DEFAULT 0,
    ends_at TEXT,
    status TEXT NOT NULL DEFAULT 'review',
    review_note TEXT,
    buyer_id INTEGER, sold_price INTEGER,
    version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, live_at TEXT, updated_at TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS mk_l_status ON mk_listings(status, ends_at)',
  'CREATE INDEX IF NOT EXISTS mk_l_seller ON mk_listings(seller_id)',
  `CREATE TABLE IF NOT EXISTS mk_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL, idx INTEGER NOT NULL, kind TEXT,
    mime TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS mk_p_listing ON mk_photos(listing_id, idx)',
  // amount = what the history shows; max_amount = the bidder's secret ceiling;
  // auto = placed by the proxy on someone's behalf; pub = 0 for a leader
  // quietly raising their own maximum, which must not be visible to others.
  `CREATE TABLE IF NOT EXISTS mk_bids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL, bidder_id INTEGER NOT NULL,
    amount INTEGER NOT NULL, max_amount INTEGER NOT NULL,
    auto INTEGER NOT NULL DEFAULT 0, pub INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS mk_b_listing ON mk_bids(listing_id, id)',
  'CREATE INDEX IF NOT EXISTS mk_b_bidder ON mk_bids(bidder_id)',
  `CREATE TABLE IF NOT EXISTS mk_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL, buyer_id INTEGER NOT NULL, seller_id INTEGER NOT NULL,
    amount INTEGER NOT NULL, counter INTEGER, message TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    expires_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS mk_o_listing ON mk_offers(listing_id, status)',
  'CREATE INDEX IF NOT EXISTS mk_o_buyer ON mk_offers(buyer_id)',
  'CREATE INDEX IF NOT EXISTS mk_o_seller ON mk_offers(seller_id)',
  `CREATE TABLE IF NOT EXISTS mk_watch (
    user_id INTEGER NOT NULL, listing_id INTEGER NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, listing_id)
  )`,
  'CREATE INDEX IF NOT EXISTS mk_w_listing ON mk_watch(listing_id)',
  `CREATE TABLE IF NOT EXISTS mk_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL, buyer_id INTEGER NOT NULL, seller_id INTEGER NOT NULL,
    tier TEXT NOT NULL, source TEXT NOT NULL,
    item_price INTEGER NOT NULL, auth_fee INTEGER NOT NULL, ship_fee INTEGER NOT NULL,
    commission INTEGER NOT NULL, total INTEGER NOT NULL, payout INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'awaiting_payment',
    pay_mode TEXT, stripe_session TEXT,
    ship_name TEXT, ship_line1 TEXT, ship_line2 TEXT, ship_city TEXT, ship_postal TEXT, ship_country TEXT,
    tracking_in TEXT, tracking_out TEXT,
    created_at TEXT NOT NULL, updated_at TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS mk_or_buyer ON mk_orders(buyer_id)',
  'CREATE INDEX IF NOT EXISTS mk_or_seller ON mk_orders(seller_id)',
  'CREATE INDEX IF NOT EXISTS mk_or_status ON mk_orders(status)',
  `CREATE TABLE IF NOT EXISTS mk_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER, listing_id INTEGER,
    kind TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS mk_e_order ON mk_events(order_id)',
  `CREATE TABLE IF NOT EXISTS mk_feedback (
    order_id INTEGER PRIMARY KEY,
    seller_id INTEGER NOT NULL, buyer_id INTEGER NOT NULL,
    rating INTEGER NOT NULL, comment TEXT, created_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS mk_fb_seller ON mk_feedback(seller_id)',
];

let schemaReady = false;
export async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch(SCHEMA.map((sql) => env.DB.prepare(sql)));
  schemaReady = true;
}

export async function logEvent(env, { orderId = null, listingId = null, kind, note = null }) {
  await env.DB.prepare(
    'INSERT INTO mk_events (order_id, listing_id, kind, note, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(orderId, listingId, kind, note, nowIso()).run();
}

export async function userById(env, id) {
  if (!id) return null;
  return env.DB.prepare('SELECT id, name, email, phone, address, city, postal, country FROM users WHERE id = ?')
    .bind(id).first();
}

// "Jordan" + "Air Jordan 1 Low" reads "Air Jordan 1 Low", not "Jordan Air Jordan 1 Low"
export function listingTitle(l) {
  const brand = String(l.brand || '').trim(), model = String(l.model || '').trim();
  return brand && model.toLowerCase().indexOf(brand.toLowerCase()) !== -1 ? model : (brand + ' ' + model).trim();
}

// ── mail ────────────────────────────────────────────────────────────────────
function footer(env) {
  return '\n\n--\nShoeLab Vault · authenticated sneaker resale\n' + siteUrl(env) + '/vault.html\n';
}

export async function mail(env, to, subject, body) {
  if (!to) return;
  await sendEmail(env, { to, subject: '[Vault] ' + subject, text: body + footer(env) });
}

export async function mailStudio(env, subject, body, replyTo) {
  await sendEmail(env, { to: notifyAddress(env), subject: '[VAULT] ' + subject, text: body + footer(env), replyTo });
}

// ── orders ──────────────────────────────────────────────────────────────────
// One place turns a finished sale (auction win, buy now, accepted offer) into
// an order, so the fee maths and the notifications can never drift apart.
export async function createOrder(env, listing, buyerId, price, source) {
  const f = fees(listing.tier, price);
  const at = nowIso();
  const res = await env.DB.prepare(
    `INSERT INTO mk_orders (listing_id, buyer_id, seller_id, tier, source, item_price, auth_fee, ship_fee,
       commission, total, payout, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_payment', ?, ?)`
  ).bind(listing.id, buyerId, listing.seller_id, listing.tier, source, price, f.authFee, f.shipFee,
    f.commission, f.total, f.payout, at, at).run();
  const orderId = res.meta.last_row_id;
  await logEvent(env, { orderId, listingId: listing.id, kind: 'sold', note: source });

  // nobody else's offer can win once it has sold
  await env.DB.prepare(
    "UPDATE mk_offers SET status = 'declined', updated_at = ? WHERE listing_id = ? AND status IN ('pending','countered')"
  ).bind(at, listing.id).run();

  const buyer = await userById(env, buyerId);
  const seller = await userById(env, listing.seller_id);
  const title = listingTitle(listing);
  const how = source === 'auction' ? 'won the auction for' : source === 'offer' ? 'had your offer accepted on' : 'bought';
  if (buyer) await mail(env, buyer.email, 'You ' + how + ' ' + title,
    'Hi ' + (buyer.name || '') + ',\n\nYou ' + how + ' ' + title + ' (EU ' + listing.size + ').\n\n' +
    '  Item            ' + euro(price) + '\n' +
    '  Authentication  ' + euro(f.authFee) + (listing.tier === 'lab' ? '  (in-lab check by our specialists)' : '  (photo check)') + '\n' +
    '  Shipping        ' + euro(f.shipFee) + '\n' +
    '  Total           ' + euro(f.total) + '\n\n' +
    'Complete payment within 72 hours to secure the pair:\n' + siteUrl(env) + '/vault-me.html#order-' + orderId);
  if (seller) await mail(env, seller.email, 'Sold: ' + title,
    'Hi ' + (seller.name || '') + ',\n\nYour ' + title + ' sold for ' + euro(price) + '.\n' +
    'You will receive ' + euro(f.payout) + ' after the ' + (listing.tier === 'lab' ? 'in-lab authentication' : 'delivery') + '.\n\n' +
    'We will email you shipping instructions as soon as the buyer has paid. Nothing to post yet.');
  await mailStudio(env, 'Sale #' + orderId + ': ' + title + ' for ' + euro(price),
    'Source: ' + source + '\nTier: ' + listing.tier + '\nBuyer: ' + (buyer ? buyer.email : buyerId) +
    '\nSeller: ' + (seller ? seller.email : listing.seller_id) + '\nTotal charged: ' + euro(f.total) +
    '\nSeller payout: ' + euro(f.payout));
  return orderId;
}

// What the seller has to do once an order is paid.
export function shipInstructions(env, order, buyer) {
  if (order.tier === 'lab') {
    return 'Post the pair to ShoeLab for authentication — not to the buyer.\n' +
      dropoffInstructions(env) + '\nAdd the order number #' + order.id + ' inside the box, then enter the tracking number in your Vault dashboard.';
  }
  const addr = [order.ship_name, order.ship_line1, order.ship_line2,
    [order.ship_postal, order.ship_city].filter(Boolean).join(' '), order.ship_country].filter(Boolean).join('\n  ');
  return 'Post the pair straight to the buyer:\n  ' + (addr || (buyer ? buyer.name : 'see dashboard')) +
    '\n\nThen enter the tracking number in your Vault dashboard.';
}

export async function markPaid(env, orderId, how) {
  const at = nowIso();
  const res = await env.DB.prepare(
    "UPDATE mk_orders SET status = 'paid', pay_mode = COALESCE(pay_mode, ?), updated_at = ? WHERE id = ? AND status = 'awaiting_payment'"
  ).bind(how, at, orderId).run();
  if (!res.meta || !res.meta.changes) return false;
  await logEvent(env, { orderId, kind: 'paid', note: how });
  const o = await env.DB.prepare('SELECT * FROM mk_orders WHERE id = ?').bind(orderId).first();
  const l = await env.DB.prepare('SELECT * FROM mk_listings WHERE id = ?').bind(o.listing_id).first();
  const buyer = await userById(env, o.buyer_id);
  const seller = await userById(env, o.seller_id);
  const title = l ? listingTitle(l) : 'your item';
  if (seller) await mail(env, seller.email, 'Paid — please ship ' + title,
    'Hi ' + (seller.name || '') + ',\n\nThe buyer has paid for ' + title + ' (order #' + o.id + ').\n\n' +
    shipInstructions(env, o, buyer) + '\n\n' + siteUrl(env) + '/vault-me.html#order-' + o.id);
  if (buyer) await mail(env, buyer.email, 'Payment received for ' + title,
    'Hi ' + (buyer.name || '') + ',\n\nThanks — we have your payment of ' + euro(o.total) + ' for ' + title + '.\n' +
    (o.tier === 'lab'
      ? 'The seller now posts the pair to our lab. A specialist authenticates it before it travels on to you.'
      : 'The seller now posts the pair to you. You will get the tracking number by email.') +
    '\n\nFollow it here: ' + siteUrl(env) + '/vault-me.html#order-' + o.id);
  return true;
}

// ── housekeeping ────────────────────────────────────────────────────────────
// There is no cron on Pages, so time-based work (auction endings, offer
// expiry, unpaid orders) runs lazily on incoming requests, at most every 20s
// per isolate. Every state change is a conditional UPDATE, so two isolates
// racing on the same row cannot both act on it.
let lastSweep = 0;
export async function housekeeping(env, force) {
  if (!force && Date.now() - lastSweep < 20000) return;
  lastSweep = Date.now();
  const at = nowIso();

  // auctions that have run out
  const due = await env.DB.prepare(
    "SELECT * FROM mk_listings WHERE status = 'live' AND format = 'auction' AND ends_at <= ? LIMIT 25"
  ).bind(at).all();
  for (const l of due.results || []) await settleAuction(env, l);

  // offers nobody answered
  await env.DB.prepare(
    "UPDATE mk_offers SET status = 'expired', updated_at = ? WHERE status IN ('pending','countered') AND expires_at <= ?"
  ).bind(at, at).run();

  // orders never paid
  const stale = new Date(Date.now() - VAULT.payTtlMs).toISOString();
  const unpaid = await env.DB.prepare(
    "SELECT * FROM mk_orders WHERE status = 'awaiting_payment' AND created_at <= ? LIMIT 25"
  ).bind(stale).all();
  for (const o of unpaid.results || []) {
    const r = await env.DB.prepare(
      "UPDATE mk_orders SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'awaiting_payment'"
    ).bind(at, o.id).run();
    if (!r.meta.changes) continue;
    await env.DB.prepare("UPDATE mk_listings SET status = 'ended', updated_at = ? WHERE id = ? AND status = 'sold'")
      .bind(at, o.listing_id).run();
    await logEvent(env, { orderId: o.id, kind: 'cancelled', note: 'unpaid after 72h' });
    const seller = await userById(env, o.seller_id);
    if (seller) await mail(env, seller.email, 'Sale cancelled — buyer did not pay',
      'The buyer did not pay within 72 hours, so order #' + o.id + ' was cancelled. You can list the pair again any time.');
  }

  // delivered by default once a parcel has been out for two weeks
  const old = new Date(Date.now() - VAULT.autoDeliverMs).toISOString();
  const quiet = await env.DB.prepare(
    "SELECT * FROM mk_orders WHERE status = 'shipped' AND updated_at <= ? LIMIT 25"
  ).bind(old).all();
  for (const o of quiet.results || []) {
    const r = await env.DB.prepare(
      "UPDATE mk_orders SET status = 'delivered', updated_at = ? WHERE id = ? AND status = 'shipped'"
    ).bind(at, o.id).run();
    if (!r.meta.changes) continue;
    await logEvent(env, { orderId: o.id, kind: 'delivered', note: 'automatically after 14 days' });
    const seller = await userById(env, o.seller_id);
    if (seller) await mail(env, seller.email, 'Delivered — payout on its way',
      'Order #' + o.id + ' counts as delivered (two weeks without a problem report). Your payout of ' + euro(o.payout) + ' is being released.');
  }
}

export async function settleAuction(env, l) {
  const at = nowIso();
  if (l.bids > 0 && l.high_bidder) {
    const r = await env.DB.prepare(
      "UPDATE mk_listings SET status = 'sold', buyer_id = ?, sold_price = price, updated_at = ? WHERE id = ? AND status = 'live'"
    ).bind(l.high_bidder, at, l.id).run();
    if (r.meta.changes) await createOrder(env, l, l.high_bidder, l.price, 'auction');
  } else {
    const r = await env.DB.prepare(
      "UPDATE mk_listings SET status = 'ended', updated_at = ? WHERE id = ? AND status = 'live'"
    ).bind(at, l.id).run();
    if (r.meta.changes) {
      const seller = await userById(env, l.seller_id);
      if (seller) await mail(env, seller.email, 'Your auction ended without bids',
        listingTitle(l) + ' did not receive any bids. You can list it again with a lower start price or as Buy Now.');
    }
  }
}
