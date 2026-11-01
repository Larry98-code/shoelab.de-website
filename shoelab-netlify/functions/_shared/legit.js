// ShoeLab Vault — the Legit Check: ShoeLab checks a pair from another app.
//
// Two kinds of customer:
//   buy  — someone about to buy a pair on Vinted, Kleinanzeigen, eBay … (or
//          who just did) uploads the seller's photos or screenshots, often
//          with the listing's link. They get a private answer.
//   sell — the owner of a pair uploads their own photos. If it is authentic
//          they get a certificate (SL-XXXX-XXXX) with a public page and an
//          image to add to their listing on any app.
//
// The flow: created (awaiting_payment) → paid (checking) → the Lab Check runs
// and may ask the customer for more (needs_info) → a specialist decides
// (review → done): authentic, not authentic, or "can't verify", which refunds.
// The Lab Check never answers the customer by itself.
import { clean, stripeApi, stripeGet } from './util.js';
import { VAULT, nowIso, euro, siteUrl, listingTitle, tell, tellStudio, userById, LAB } from './vault.js';
import { checkView, requestView, latestCheck, latestRequest } from './labcheck.js';

export const LEGIT_VERDICTS = ['authentic', 'not_authentic', 'inconclusive'];
export const OPEN_LIMIT = 3;              // unpaid Legit Checks one person may have at a time

// Where a link points: the app's name for the specialist and the page. The
// link itself is never fetched; it is shown as the customer gave it.
const PLATFORMS = [
  [/(^|\.)vinted\./, 'Vinted'], [/(^|\.)(ebay-)?kleinanzeigen\.de$/, 'Kleinanzeigen'], [/(^|\.)ebay\./, 'eBay'],
  [/(^|\.)depop\.com$/, 'Depop'], [/(^|\.)grailed\.com$/, 'Grailed'], [/(^|\.)stockx\.com$/, 'StockX'],
  [/(^|\.)goat\.com$/, 'GOAT'], [/(^|\.)(facebook|fb)\.(com|me)$/, 'Facebook'], [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)klekt\.com$/, 'KLEKT'], [/(^|\.)restocks\.(net|eu|com)$/, 'Restocks'], [/(^|\.)wethenew\.com$/, 'Wethenew'],
  [/(^|\.)sneakit\.com$/, 'Sneakit'], [/(^|\.)vestiairecollective\.com$/, 'Vestiaire Collective'],
  [/(^|\.)zalando\./, 'Zalando'], [/(^|\.)tiktok\.com$/, 'TikTok'], [/(^|\.)shpock\.com$/, 'Shpock'],
  [/(^|\.)willhaben\.at$/, 'willhaben'], [/(^|\.)marktplaats\.nl$/, 'Marktplaats'], [/(^|\.)leboncoin\.fr$/, 'leboncoin'],
  [/(^|\.)wallapop\.com$/, 'Wallapop'], [/(^|\.)subito\.it$/, 'Subito'], [/(^|\.)olx\./, 'OLX'], [/(^|\.)avito\.ru$/, 'Avito'],
];
export function cleanLink(v) {
  const s = String(v || '').trim().slice(0, 500);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch (e) { return null; }
}
export function platformOf(link) {
  let host = '';
  try { host = new URL(link).hostname.toLowerCase(); } catch (e) { return null; }
  for (const [re, name] of PLATFORMS) if (re.test(host)) return name;
  return host.replace(/^www\./, '') || null;
}

// Certificate numbers: SL-XXXX-XXXX in Crockford's base 32 (no I, L, O, U),
// easy to read out and to type from a photo.
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function newCertCode() {
  const b = crypto.getRandomValues(new Uint8Array(8));
  const c = Array.from(b, (x) => ALPHA[x & 31]).join('');
  return 'SL-' + c.slice(0, 4) + '-' + c.slice(4);
}
export function normCert(v) {
  let s = String(v || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (s.length === 10 && s.indexOf('SL') === 0) s = s.slice(2);
  // typed from a photo: O for 0, I or L for 1 (neither letter is ever used)
  s = s.replace(/O/g, '0').replace(/[IL]/g, '1');
  return s.length === 8 ? 'SL-' + s.slice(0, 4) + '-' + s.slice(4) : null;
}

export async function loadLegit(env, id) {
  const g = id ? await env.DB.prepare('SELECT * FROM mk_legit WHERE id = ?').bind(id).first() : null;
  if (g) g.legit = true;            // the Lab Check reads it as a Legit Check
  return g;
}
export function legitTitle(g) { return listingTitle(g); }
const ref = (g) => 'LC-' + g.id;
const meUrl = (g) => '/vault-me.html#legit-' + g.id;

// a certificate anyone may see: the owner's pair, found authentic, shown, not withdrawn
export function certLive(g) {
  return !!(g && g.cert && g.mode === 'sell' && g.verdict === 'authentic' && g.cert_public && !g.cert_revoked);
}

export async function legitPhotos(env, id) {
  const r = await env.DB.prepare('SELECT id, kind, note FROM mk_photos WHERE legit_id = ? ORDER BY idx, id').bind(id).all();
  return (r.results || []).map((p) => ({ id: p.id, url: '/api/market/photo?id=' + p.id, kind: p.kind, note: p.note || null }));
}

// What the owner (and, with spec, a specialist) sees of a Legit Check.
export async function legitView(env, g, spec) {
  const check = checkView(await latestCheck(env, g.id, true));
  const req = requestView(await latestRequest(env, g.id, true));
  const v = {
    id: g.id, ref: ref(g), mode: g.mode, title: legitTitle(g), brand: g.brand, model: g.model, size: g.size,
    link: g.link, platform: g.platform, askedPrice: g.asked_price, note: g.note,
    status: g.status, verdict: g.verdict, resultNote: g.result_note, decidedAt: g.decided_at,
    fee: g.fee, payMode: g.pay_mode, paidAt: g.paid_at, refunded: !!g.refund_ref,
    cert: g.cert && g.mode === 'sell' && g.verdict === 'authentic' ? g.cert : null,
    certPublic: !!g.cert_public, certRevoked: !!g.cert_revoked,
    createdAt: g.created_at, photos: await legitPhotos(env, g.id),
  };
  if (spec) {
    v.check = check;
    v.request = req;
    const u = await userById(env, g.user_id);
    v.customer = u ? { name: u.name, email: u.email, lang: u.lang } : null;
  } else if (req && req.status === 'open') {
    // what the owner is asked for, and for a buyer the message for the other seller
    v.request = { id: req.id, items: req.items.map((x) => ({ type: x.type, title: x.title, instructions: x.instructions })) };
    const r = check && check.result;
    if (g.mode === 'buy' && r && r.seller_message) v.sellerMessage = r.seller_message;
  }
  return v;
}

// ── paying ──────────────────────────────────────────────────────────────────
// → { url } to Stripe, { manual } when the studio emails payment details, or
// { free } when the check costs nothing (VAULT.legit = 0) and starts at once.
export async function startLegitPayment(env, g, me) {
  if (!g.fee) {
    await markLegitPaid(env, g.id, 'free');
    return { free: true };
  }
  const title = legitTitle(g);
  if (env.STRIPE_SECRET_KEY) {
    const site = siteUrl(env);
    const s = await stripeApi(env, 'checkout/sessions', {
      mode: 'payment',
      'line_items[0][quantity]': 1,
      'line_items[0][price_data][currency]': 'eur',
      'line_items[0][price_data][unit_amount]': g.fee,
      'line_items[0][price_data][product_data][name]': 'ShoeLab Legit Check ' + ref(g) + ': ' + title + ' (EU ' + g.size + ')',
      'line_items[0][price_data][product_data][description]': 'Authenticity check by the ShoeLab lab, Bremen',
      success_url: site + '/vault-me.html?legit=' + g.id + '#legit-' + g.id,
      cancel_url: site + '/vault-me.html#legit-' + g.id,
      customer_email: me.email,
      client_reference_id: 'legit_' + g.id,
      'metadata[vault_legit]': String(g.id),
      'payment_intent_data[metadata][vault_legit]': String(g.id),
    });
    if (!s || !s.url) return { error: (s && s.error && s.error.message) || 'Payment could not be started' };
    await env.DB.prepare("UPDATE mk_legit SET stripe_session = ?, pay_mode = 'stripe', updated_at = ? WHERE id = ?").bind(s.id, nowIso(), g.id).run();
    return { url: s.url };
  }
  // no card payments yet: the studio emails payment details, then marks it paid
  if (g.pay_mode !== 'manual') {
    await env.DB.prepare("UPDATE mk_legit SET pay_mode = 'manual', updated_at = ? WHERE id = ?").bind(nowIso(), g.id).run();
    await tellStudio(env, 'sLegitPayment', { ref: ref(g), title, amount: { m: g.fee }, email: me.email, url: LAB }, me.email);
    await tell(env, me, 'legitPayManual', { title, amount: { m: g.fee } });
  }
  return { manual: true };
}

// A customer back from Stripe before the webhook: ask Stripe directly.
export async function legitPaidAtStripe(env, g) {
  if (g.status !== 'awaiting_payment' || !g.stripe_session || !env.STRIPE_SECRET_KEY) return false;
  const s = await stripeGet(env, 'checkout/sessions/' + encodeURIComponent(g.stripe_session));
  if (!s || s.payment_status !== 'paid' || s.amount_total !== g.fee || String(s.currency).toLowerCase() !== 'eur') return false;
  return markLegitPaid(env, g.id, 'stripe', typeof s.payment_intent === 'string' ? s.payment_intent : null);
}

export async function markLegitPaid(env, id, how, pi) {
  const at = nowIso();
  const r = await env.DB.prepare(
    "UPDATE mk_legit SET status = 'checking', paid_at = ?, pay_mode = COALESCE(?, pay_mode), stripe_pi = COALESCE(?, stripe_pi), updated_at = ? WHERE id = ? AND status = 'awaiting_payment'"
  ).bind(at, how, pi || null, at, id).run();
  if (!r.meta || !r.meta.changes) return false;
  const g = await loadLegit(env, id);
  const owner = await userById(env, g.user_id);
  const title = legitTitle(g);
  await tell(env, owner, 'legitPaid', { title, ref: ref(g), url: meUrl(g) });
  await tellStudio(env, 'sLegitNew', {
    ref: ref(g), title, url: LAB,
    rows: [['mode', { k: g.mode === 'buy' ? 'modeBuy' : 'modeSell' }], ['size', 'EU ' + g.size],
      ['platform', g.platform || ''], ['asked', g.asked_price ? { m: g.asked_price } : ''],
      ['customer', owner ? owner.name + ' <' + owner.email + '>' : String(g.user_id)],
      ['paid', how === 'free' ? '—' : { m: g.fee }]],
  }, owner ? owner.email : undefined);
  return true;
}

// ── the specialist's answer ─────────────────────────────────────────────────
// authentic → for an owner, a certificate; not_authentic; inconclusive → we
// could not tell, so the customer gets their money back.
export async function decideLegit(env, g, verdict, note) {
  const at = nowIso();
  let cert = null;
  if (verdict === 'authentic' && g.mode === 'sell') {
    for (let i = 0; i < 4 && !cert; i++) {
      const code = newCertCode();
      const taken = await env.DB.prepare('SELECT 1 FROM mk_legit WHERE cert = ?').bind(code).first();
      if (!taken) cert = code;
    }
  }
  const r = await env.DB.prepare(
    "UPDATE mk_legit SET status = 'done', verdict = ?, result_note = ?, decided_at = ?, cert = COALESCE(cert, ?), updated_at = ? WHERE id = ? AND status IN ('checking','needs_info','review')"
  ).bind(verdict, note || null, at, cert, at, g.id).run();
  if (!r.meta || !r.meta.changes) return null;
  // the customer's open request (if any) is no longer needed
  await env.DB.prepare("UPDATE mk_requests SET status = 'closed' WHERE legit_id = ? AND status = 'open'").bind(g.id).run();
  const owner = await userById(env, g.user_id);
  const title = legitTitle(g);
  let refund = null;
  if (verdict === 'inconclusive' && g.fee && g.paid_at) refund = await refundLegit(env, g, owner);
  const next = verdict === 'authentic' ? (g.mode === 'sell' ? 'lrCert' : 'lrBuyOk')
    : verdict === 'not_authentic' ? (g.mode === 'sell' ? 'lrSellNo' : 'lrBuyNo')
    : refund === 'stripe' ? 'lrRefund' : refund ? 'lrRefundManual' : '';
  await tell(env, owner, 'legitResult', {
    title, ref: ref(g), url: meUrl(g), verdictLine: { k: 'lr_' + verdict }, message: note || '', next: next ? { k: next } : '',
  });
  return { verdict, refund };
}

async function refundLegit(env, g, owner) {
  const p = { ref: ref(g), title: legitTitle(g), amount: { m: g.fee }, email: owner ? owner.email : String(g.user_id) };
  if (g.stripe_pi && env.STRIPE_SECRET_KEY) {
    const r = await stripeApi(env, 'refunds', {
      payment_intent: g.stripe_pi, amount: g.fee, 'metadata[vault_legit]': String(g.id),
    }, { idem: 'legit-refund-' + g.id });
    if (r && r.id) {
      await env.DB.prepare('UPDATE mk_legit SET refund_ref = ? WHERE id = ?').bind(r.id, g.id).run();
      return 'stripe';
    }
  }
  await env.DB.prepare("UPDATE mk_legit SET refund_ref = 'manual' WHERE id = ?").bind(g.id).run();
  await tellStudio(env, 'sLegitRefund', p, owner ? owner.email : undefined);
  return 'manual';
}

// ── the public certificate ──────────────────────────────────────────────────
export async function certView(env, code) {
  const g = await env.DB.prepare('SELECT * FROM mk_legit WHERE cert = ?').bind(code).first();
  if (!g || g.mode !== 'sell' || g.verdict !== 'authentic') return null;
  if (g.cert_revoked) return { code, revoked: true };
  if (!g.cert_public) return { code, hidden: true };
  // photos sent on request (a receipt, say) stay private even here
  const photos = (await legitPhotos(env, g.id)).filter((p) => p.kind !== 'extra');
  return {
    code, title: legitTitle(g), brand: g.brand, model: g.model, size: g.size, checkedAt: g.decided_at,
    platform: g.platform, link: g.link, photos,
  };
}

