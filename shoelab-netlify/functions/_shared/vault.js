// ShoeLab Vault — shared marketplace core: rules, schema, settlement, money,
// and the emails each step sends.
//
// Money is always integer cents. Times are ISO-8601 UTC strings, which sort
// correctly as text, so "ends_at <= ?" comparisons work in SQL directly.

import { notifyAddress, stripeApi, stripeGet } from './util.js';
import { siteUrl, ensureCore, addMissingColumns } from './core.js';
import { sendMail, sendStudio } from './mail.js';

// ── rules ───────────────────────────────────────────────────────────────────
// The fees and limits of the marketplace — change them here any time. The
// seller's commission comes off their sale price; the buyer pays the
// authentication fee for the tier the seller chose, plus shipping.
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
  maxThumbBytes: 120 * 1024,
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

export { siteUrl };

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
  // a seller's Stripe Connect account: identity check and bank details live
  // at Stripe; we keep the account id and the last known state
  `CREATE TABLE IF NOT EXISTS mk_sellers (
    user_id INTEGER PRIMARY KEY, stripe_account TEXT NOT NULL,
    details_submitted INTEGER NOT NULL DEFAULT 0, payouts_enabled INTEGER NOT NULL DEFAULT 0,
    due INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT
  )`,
  // support: a conversation handed from Wesley (or a form) to a specialist
  `CREATE TABLE IF NOT EXISTS mk_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT, email TEXT NOT NULL, lang TEXT,
    topic TEXT, summary TEXT NOT NULL, transcript TEXT, page TEXT,
    status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, updated_at TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS mk_t_status ON mk_tickets(status, id)',
  `CREATE TABLE IF NOT EXISTS mk_ticket_msgs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER NOT NULL, sender TEXT NOT NULL,
    body TEXT NOT NULL, created_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS mk_tm_ticket ON mk_ticket_msgs(ticket_id, id)',
  // daily message counts that keep the support assistant from being abused
  `CREATE TABLE IF NOT EXISTS support_usage (
    k TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (k, day)
  )`,
];
// columns added after the first release
const LATER = [
  ['mk_photos', 'thumb', 'TEXT'],
  ['mk_orders', 'stripe_pi', 'TEXT'], ['mk_orders', 'payout_status', 'TEXT'],
  ['mk_orders', 'payout_ref', 'TEXT'], ['mk_orders', 'payout_at', 'TEXT'], ['mk_orders', 'refund_ref', 'TEXT'],
];

let schemaReady = false;
export async function ensureSchema(env) {
  if (schemaReady) return;
  await ensureCore(env);
  await env.DB.batch(SCHEMA.map((sql) => env.DB.prepare(sql)));
  await addMissingColumns(env, LATER);
  schemaReady = true;
}

export async function logEvent(env, { orderId = null, listingId = null, kind, note = null }) {
  await env.DB.prepare(
    'INSERT INTO mk_events (order_id, listing_id, kind, note, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(orderId, listingId, kind, note, nowIso()).run();
}

export async function userById(env, id) {
  if (!id) return null;
  return env.DB.prepare('SELECT id, name, email, phone, address, city, postal, country, lang, email_verified_at FROM users WHERE id = ?')
    .bind(id).first();
}

export function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || ''; }

// "Jordan" + "Air Jordan 1 Low" reads "Air Jordan 1 Low", not "Jordan Air Jordan 1 Low"
export function listingTitle(l) {
  const brand = String(l.brand || '').trim(), model = String(l.model || '').trim();
  return brand && model.toLowerCase().indexOf(brand.toLowerCase()) !== -1 ? model : (brand + ' ' + model).trim();
}

// ── emails ──────────────────────────────────────────────────────────────────
// Every email goes out in the recipient's own language (users.lang), built
// from the templates in mail-i18n/. The studio gets its copies in its own.
export async function tell(env, user, key, params) {
  if (!user || !user.email) return;
  await sendMail(env, {
    to: user.email, lang: user.lang, key, vault: true,
    params: Object.assign({ name: firstName(user.name) }, params || {}),
  });
}
export async function tellStudio(env, key, params, replyTo) {
  await sendStudio(env, key, params || {}, replyTo, true);
}
const orderUrl = (id) => '/vault-me.html#order-' + id;
const LAB = '/vault-lab.html';

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
  const tierWord = { k: listing.tier === 'lab' ? 'tierLab' : 'tierPhoto' };
  await tell(env, buyer, source === 'auction' ? 'wonAuction' : source === 'offer' ? 'offerAccepted' : 'boughtNow', {
    title, size: listing.size, url: orderUrl(orderId),
    rows: [['item', { m: price }], ['auth', { m: f.authFee }], ['tier', tierWord], ['ship', { m: f.shipFee }], ['total', { m: f.total }]],
  });
  await tell(env, seller, 'sold', {
    title, price: { m: price }, payout: { m: f.payout },
    payoutLine: { k: listing.tier === 'lab' ? 'payoutAfterLab' : 'payoutAfterDelivery' },
  });
  await tellStudio(env, 'sSale', {
    order: orderId, title, price: { m: price },
    rows: [['format', { k: source === 'auction' ? 'auction' : 'fixed' }], ['tier', tierWord],
      ['buyer', buyer ? buyer.email : String(buyerId)], ['seller', seller ? seller.email : String(listing.seller_id)],
      ['total', { m: f.total }], ['payout', { m: f.payout }]],
  });
  return orderId;
}

// Where the seller posts a paid pair: to the buyer, or (Lab Verified) to the
// lab, whose full address only ever travels in private.
export function shipTo(env, order) {
  if (order.tier === 'lab') {
    const lab = String(env.DROPOFF_ADDRESS || '').trim();
    return { lab: true, address: lab ? lab.replace(/\s*,\s*/g, '\n') : null };
  }
  const lines = [order.ship_name, order.ship_line1, order.ship_line2,
    [order.ship_postal, order.ship_city].filter(Boolean).join(' '), order.ship_country === 'DE' ? 'Deutschland' : order.ship_country]
    .filter(Boolean);
  return { lab: false, address: lines.join('\n') || null };
}

export async function markPaid(env, orderId, how, paymentIntent) {
  const at = nowIso();
  const res = await env.DB.prepare(
    "UPDATE mk_orders SET status = 'paid', pay_mode = COALESCE(pay_mode, ?), stripe_pi = COALESCE(?, stripe_pi), updated_at = ? WHERE id = ? AND status = 'awaiting_payment'"
  ).bind(how, paymentIntent || null, at, orderId).run();
  if (!res.meta || !res.meta.changes) return false;
  await logEvent(env, { orderId, kind: 'paid', note: how });
  const o = await env.DB.prepare('SELECT * FROM mk_orders WHERE id = ?').bind(orderId).first();
  const l = await env.DB.prepare('SELECT * FROM mk_listings WHERE id = ?').bind(o.listing_id).first();
  const buyer = await userById(env, o.buyer_id);
  const seller = await userById(env, o.seller_id);
  const title = l ? listingTitle(l) : '#' + o.id;
  const dest = shipTo(env, o);
  await tell(env, seller, 'paidShip', {
    title, order: o.id, url: orderUrl(o.id),
    howToShip: { k: dest.lab ? 'shipLab' : 'shipPhoto' },
    address: dest.address || { k: 'labAddressLater' },
  });
  // no lab address on file: the studio sends it by hand
  if (dest.lab && !dest.address) {
    await tellStudio(env, 'sLabAddress', {
      order: o.id, title, rows: [['seller', seller ? seller.name + ' <' + seller.email + '>' : String(o.seller_id)]],
    }, seller ? seller.email : undefined);
  }
  await tell(env, buyer, 'paymentReceived', {
    title, amount: { m: o.total }, url: orderUrl(o.id),
    next: { k: o.tier === 'lab' ? 'paidNextLab' : 'paidNextPhoto' },
  });
  return true;
}

// ── money: payouts and refunds ──────────────────────────────────────────────
// With Stripe Connect switched on, the buyer's money waits in Stripe until the
// pair is delivered, then goes to the seller's own Stripe account; refunds go
// straight back to the card. Without it, both are done by hand from emails.
export function connectOn(env) {
  return !!env.STRIPE_SECRET_KEY && /^(on|1|true|yes)$/i.test(String(env.VAULT_STRIPE_CONNECT || '').trim());
}

export async function sellerRow(env, userId) {
  return env.DB.prepare('SELECT * FROM mk_sellers WHERE user_id = ?').bind(userId).first();
}

// Asks Stripe where the seller's verification stands and stores the answer.
export async function refreshSeller(env, userId) {
  const row = await sellerRow(env, userId);
  if (!row || !env.STRIPE_SECRET_KEY) return row;
  const a = await stripeGet(env, 'accounts/' + encodeURIComponent(row.stripe_account));
  if (!a || a.error) return row;
  const due = ((a.requirements && a.requirements.currently_due) || []).length;
  await env.DB.prepare('UPDATE mk_sellers SET details_submitted = ?, payouts_enabled = ?, due = ?, updated_at = ? WHERE user_id = ?')
    .bind(a.details_submitted ? 1 : 0, a.payouts_enabled ? 1 : 0, due, nowIso(), userId).run();
  return Object.assign({}, row, { details_submitted: a.details_submitted ? 1 : 0, payouts_enabled: a.payouts_enabled ? 1 : 0, due });
}

// Every way an order becomes delivered ends here: the seller hears about it
// and the payout follows.
export async function orderDelivered(env, o, how) {
  const seller = await userById(env, o.seller_id);
  const l = await env.DB.prepare('SELECT brand, model FROM mk_listings WHERE id = ?').bind(o.listing_id).first();
  const title = l ? listingTitle(l) : '#' + o.id;
  if (how !== 'released') {
    await tell(env, seller, how === 'auto' ? 'deliveredAuto' : 'delivered', { order: o.id, title, payout: { m: o.payout } });
  }
  await releasePayout(env, o, how);
}

// how an order came to count as delivered, as shared email words
const HOW = { buyer: 'howBuyer', auto: 'howAuto', released: 'howReleased', retry: 'howRetry' };

export async function releasePayout(env, o, how) {
  const seller = await userById(env, o.seller_id);
  const l = await env.DB.prepare('SELECT brand, model FROM mk_listings WHERE id = ?').bind(o.listing_id).first();
  const title = l ? listingTitle(l) : '#' + o.id;
  if (!connectOn(env) || !o.stripe_pi) {
    await env.DB.prepare("UPDATE mk_orders SET payout_status = 'manual' WHERE id = ? AND payout_status IS NULL").bind(o.id).run();
    await tellStudio(env, 'sPayoutDue', {
      order: o.id, title, payout: { m: o.payout }, how: HOW[how] ? { k: HOW[how] } : how,
      rows: [['seller', seller ? seller.name + ' <' + seller.email + '>' : String(o.seller_id)],
        ['item', { m: o.item_price }], ['commission', { m: o.commission }],
        o.tier === 'photo' ? ['postage', { m: o.ship_fee }] : null, ['payout', { m: o.payout }]].filter(Boolean),
    }, seller ? seller.email : undefined);
    return 'manual';
  }
  let acct = await refreshSeller(env, o.seller_id);
  if (!acct || !acct.payouts_enabled) {
    const r = await env.DB.prepare(
      "UPDATE mk_orders SET payout_status = 'waiting' WHERE id = ? AND (payout_status IS NULL OR payout_status = 'failed')"
    ).bind(o.id).run();
    if (r.meta.changes) {
      await logEvent(env, { orderId: o.id, kind: 'payout_waiting' });
      await tell(env, seller, 'payoutSetupNeeded', { order: o.id, title, payout: { m: o.payout }, url: '/vault-me.html#payouts' });
    }
    return 'waiting';
  }
  // claim the payout first, so two requests can never both send it
  const claim = await env.DB.prepare(
    "UPDATE mk_orders SET payout_status = 'sending' WHERE id = ? AND (payout_status IS NULL OR payout_status IN ('waiting','failed'))"
  ).bind(o.id).run();
  if (!claim.meta.changes) return 'busy';
  let err = null, tr = null;
  try {
    // Stripe keeps the answer to a request for 24 hours under its idempotency
    // key, errors included, so every attempt gets its own key. Before trying
    // again, ask whether an earlier attempt went through after all (a reply
    // lost on the way back), so a retry can never pay twice.
    const tries = await env.DB.prepare("SELECT COUNT(*) AS n FROM mk_events WHERE order_id = ? AND kind = 'payout_failed'").bind(o.id).first();
    if (tries && tries.n) {
      const prior = await stripeGet(env, 'transfers?transfer_group=' + encodeURIComponent('vault_' + o.id) + '&limit=10');
      tr = ((prior && prior.data) || []).find((x) => x.destination === acct.stripe_account && !x.reversed) || null;
    }
    if (!tr) {
      const pi = await stripeGet(env, 'payment_intents/' + encodeURIComponent(o.stripe_pi));
      const charge = pi && (typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge && pi.latest_charge.id);
      if (!charge) err = (pi && pi.error && pi.error.message) || 'No charge found for this payment';
      else {
        tr = await stripeApi(env, 'transfers', {
          amount: o.payout, currency: 'eur', destination: acct.stripe_account, source_transaction: charge,
          transfer_group: 'vault_' + o.id, description: 'ShoeLab Vault order #' + o.id, 'metadata[vault_order]': String(o.id),
        }, { idem: 'vault-payout-' + o.id + '-' + ((tries && tries.n) || 0) });
        if (!tr || !tr.id) err = (tr && tr.error && tr.error.message) || 'Stripe did not accept the transfer';
      }
    }
  } catch (e) { err = String(e).slice(0, 200); }
  if (err) {
    await env.DB.prepare("UPDATE mk_orders SET payout_status = 'failed' WHERE id = ?").bind(o.id).run();
    await logEvent(env, { orderId: o.id, kind: 'payout_failed', note: err });
    await tellStudio(env, 'sPayoutFailed', { order: o.id, title, message: err });
    return 'failed';
  }
  await env.DB.prepare("UPDATE mk_orders SET payout_status = 'sent', payout_ref = ?, payout_at = ? WHERE id = ?")
    .bind(tr.id, nowIso(), o.id).run();
  await logEvent(env, { orderId: o.id, kind: 'payout_sent', note: tr.id });
  await tell(env, seller, 'payoutSent', { order: o.id, title, payout: { m: o.payout }, url: '/vault-me.html#payouts' });
  return 'sent';
}

// Payouts that waited for the seller to finish verifying go out once they have.
// A transfer Stripe refused is left to a specialist's "Retry payout": the
// reason needs a look, and retrying on every visit would email the studio
// each time.
export async function releaseWaiting(env, sellerId) {
  const rows = await env.DB.prepare(
    "SELECT * FROM mk_orders WHERE seller_id = ? AND status = 'delivered' AND payout_status = 'waiting' LIMIT 20"
  ).bind(sellerId).all();
  let sent = 0;
  for (const o of rows.results || []) if (await releasePayout(env, o, 'retry') === 'sent') sent++;
  return sent;
}

// The buyer gets everything back: by Stripe when they paid by card,
// otherwise the studio is asked to transfer it.
export async function refundOrder(env, o, opts) {
  opts = opts || {};
  const buyer = await userById(env, o.buyer_id);
  const l = await env.DB.prepare('SELECT brand, model FROM mk_listings WHERE id = ?').bind(o.listing_id).first();
  const title = l ? listingTitle(l) : '#' + o.id;
  const p = { order: o.id, title, amount: { m: o.total }, message: opts.note || '' };
  if (o.stripe_pi && env.STRIPE_SECRET_KEY) {
    const r = await stripeApi(env, 'refunds', {
      payment_intent: o.stripe_pi, amount: o.total, 'metadata[vault_order]': String(o.id),
    }, { idem: 'vault-refund-' + o.id });
    if (r && r.id) {
      await env.DB.prepare('UPDATE mk_orders SET refund_ref = ? WHERE id = ?').bind(r.id, o.id).run();
      await logEvent(env, { orderId: o.id, kind: 'refund_sent', note: r.id });
      if (opts.tellBuyer !== false) await tell(env, buyer, 'refundIssued', p);
      await tellStudio(env, 'sRefunded', p);
      return 'stripe';
    }
    const err = (r && r.error && r.error.message) || 'Stripe did not accept the refund';
    await logEvent(env, { orderId: o.id, kind: 'refund_failed', note: err });
    await tellStudio(env, 'sRefundFailed', Object.assign({}, p, { message: err }));
    if (opts.tellBuyer !== false) await tell(env, buyer, 'refundManual', p);
    return 'failed';
  }
  await tellStudio(env, 'sRefund', Object.assign({}, p, { buyerEmail: buyer ? buyer.email : String(o.buyer_id) }));
  if (opts.tellBuyer !== false) await tell(env, buyer, 'refundManual', p);
  return 'manual';
}

// ── housekeeping ────────────────────────────────────────────────────────────
// There is no cron on Pages, so time-based work (auction endings, offer
// expiry, unpaid orders) runs lazily on incoming requests, at most every 20s
// per isolate. Every state change is a conditional UPDATE, so two isolates
// racing on the same row cannot both act on it.
let lastSweep = 0, lastTidy = 0;
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
    const l = await env.DB.prepare('SELECT brand, model FROM mk_listings WHERE id = ?').bind(o.listing_id).first();
    await tell(env, await userById(env, o.seller_id), 'unpaidCancelled', {
      order: o.id, title: l ? listingTitle(l) : '#' + o.id, url: '/vault-me.html#selling',
    });
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
    await orderDelivered(env, o, 'auto');
  }

  // once a day: forget old stored emails, used links and support counters
  if (Date.now() - lastTidy > 86400000) {
    lastTidy = Date.now();
    const half = new Date(Date.now() - 180 * 86400000).toISOString();
    await env.DB.prepare('DELETE FROM mail_log WHERE created_at < ?').bind(half).run();
    await env.DB.prepare('DELETE FROM email_tokens WHERE expires_at < ?').bind(at).run();
    await env.DB.prepare('DELETE FROM support_usage WHERE day < ?').bind(at.slice(0, 10)).run();
    // support requests are kept for two years after they were last answered or closed
    const gone = new Date(Date.now() - 730 * 86400000).toISOString();
    await env.DB.prepare("DELETE FROM mk_ticket_msgs WHERE ticket_id IN (SELECT id FROM mk_tickets WHERE status != 'open' AND updated_at < ?)").bind(gone).run();
    await env.DB.prepare("DELETE FROM mk_tickets WHERE status != 'open' AND updated_at < ?").bind(gone).run();
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
      await tell(env, await userById(env, l.seller_id), 'auctionNoBids', {
        title: listingTitle(l), url: '/vault-item.html?id=' + l.id,
      });
    }
  }
}

export { LAB };
