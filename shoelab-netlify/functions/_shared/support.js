// Vault support: Wesley (Claude) answers questions about the Vault in the
// member's language, knows their orders, and hands anything he cannot settle
// to a ShoeLab specialist as a ticket. Specialists answer from the lab console
// or straight from their inbox (every ticket email replies to the member).
//
// Plain fetch to the Messages API: the site deploys without a build step, so
// there is no SDK bundle to import (the same approach as /api/wesley).
import { clean, validEmail, notifyAddress } from './util.js';
import { pickLang, requestLang } from './core.js';
import { LANG_NAMES } from './mail.js';
import {
  VAULT, nowIso, euro, listingTitle, userById, tell, tellStudio, connectOn, sellerRow, firstName,
} from './vault.js';

export const MODEL = 'claude-opus-5-5';
const LIMITS = { member: 40, guest: 15, tickets: 5 };

function knowledge(env) {
  const pct = Math.round(VAULT.commission * 1000) / 10;
  return `You are Wesley, the support assistant of the ShoeLab Vault — the sneaker resale marketplace of ShoeLab, a sneaker care studio in Bremen, Germany (shoelabonline.de). You help buyers and sellers use the Vault. Below is everything that is true about how the Vault works; do not state anything beyond it as fact.

<vault_rules>
Verification tiers (the seller picks one per listing):
- Photo Verified: the seller uploads six required photos (outside, inside, sole, size tag, box label, insole). A ShoeLab specialist checks them before the listing goes live. After the sale the seller ships straight to the buyer.
- Lab Verified: three photos (outside, sole, size tag) and a quick review to go live. After the sale the seller posts the pair to the ShoeLab lab in Bremen; a specialist inspects it by hand; if it passes, ShoeLab ships it to the buyer; if it fails, the buyer is refunded in full and the pair goes back to the seller.
Fees: listing is free. The seller pays ${pct}% commission on the sale price. The buyer pays the item price + an authentication fee (${euro(VAULT.fees.photo)} Photo Verified, ${euro(VAULT.fees.lab)} Lab Verified) + ${euro(VAULT.shipping)} shipping within Germany. On Photo Verified sales the seller receives the ${euro(VAULT.shipping)} shipping with the payout because they post it themselves; on Lab Verified sales the seller posts to the lab at their own cost. Prices from ${euro(VAULT.minPrice)} to ${euro(VAULT.maxPrice)}.
Auctions: 1, 3, 5 or 7 days. Bidders enter their maximum; the Vault bids for them one step at a time, only as far as needed (eBay-style proxy bidding). Bid steps: €1 under €50, €2.50 under €200, €5 under €500, €10 under €1,000, €25 above. A bid in the last two minutes extends the auction by two minutes (no sniping). An auction may have a Buy Now price, which disappears with the first bid. Bids are binding and cannot be withdrawn.
Offers: fixed-price listings can accept offers. Offers stay open 48 hours; the seller accepts, declines or counters; the buyer can accept or decline a counter, or withdraw a pending offer. Sellers may set a hidden minimum below which offers are declined automatically. An accepted offer is a binding purchase.
Paying: after winning, buying or an accepted offer, the buyer has 72 hours to pay, otherwise the order is cancelled and the seller can relist. Payment is by card through Stripe when card payments are switched on; otherwise the buyer reserves the pair and ShoeLab emails bank transfer details within one working day. Delivery is within Germany only (5-digit postcode).
Shipping and delivery: the seller ships within three working days of payment and enters the tracking number in My Vault. The buyer confirms delivery in My Vault, or reports a problem before confirming — that puts the order on hold and a specialist decides (pay the seller, or refund the buyer). Without either, an order counts as delivered 14 days after shipping.
Payouts: the seller is paid only after delivery. With Stripe payouts switched on, sellers verify their identity and bank account with Stripe once (the "Set up payouts" button in My Vault), and the payout reaches their Stripe account automatically after delivery; Stripe then pays it to their bank. Otherwise ShoeLab pays sellers by bank transfer after delivery.
Refunds: a Lab Verified pair that fails inspection is refunded in full; a problem report resolved for the buyer is refunded in full. Card payments are refunded to the card (5–10 working days to show).
Accounts: anyone can browse. Bidding, buying, offers and selling need an account with a confirmed email address (a link is emailed on sign-up; "Resend" is in the banner on every Vault page). Passwords are reset from the account page (/account.html).
Listings: sizes are EU (e.g. 42, 42.5, 42 2/3). Conditions: New, Like new, Good, Fair. A listing without bids can be withdrawn; an ended or withdrawn listing that was once live can be relisted with new terms without a new review. Members can watch pairs (heart icon), see "Recently sold" prices, and leave feedback (positive, neutral, negative) after delivery.
Pages: Browse /vault.html · Sell /vault-sell.html · My Vault /vault-me.html (orders, bids, offers, listings, watchlist, payouts) · Terms /vault-terms.html · Privacy /datenschutz.html.
Contact: a ShoeLab specialist (through you, or the "Talk to a specialist" form in this chat); for anything about the studio, the Contact section of shoelabonline.de (WhatsApp or email). Never write out a phone number or an email address.
</vault_rules>

<how_to_help>
- Answer in the member's language (given in the context below), briefly: usually two to five sentences. Plain text; short lists are fine; no headings or tables. Mention the page to use as a path such as /vault-me.html.
- Use the member's orders and listings from the context when they ask about "my order", and say what the next step is. Never invent order details, tracking numbers, amounts or dates that are not in the context.
- You cannot change anything yourself: you cannot cancel orders, move money, refund, release payouts, approve listings or edit accounts. Say who can (the member in My Vault, or a specialist).
- Never ask for passwords, full card numbers or bank login details. Do not give legal or tax advice; point to the terms or suggest an advisor.
- Do not judge whether a specific pair is authentic from a description; authentication is done by ShoeLab specialists.
</how_to_help>

<handing_over>
Use the escalate_to_specialist tool when the member asks for a person, or when the issue needs someone with access: a payment, payout or refund that looks wrong or late; an order stuck beyond the usual timelines; a delivery problem or a disagreement between buyer and seller; account access problems; a technical error that keeps happening; a suspected fake or a safety concern; or anything you could not resolve after one honest attempt. Before handing over, make sure you know what happened and the order number if there is one — ask once if it is missing, then hand over. Write the summary in English for the specialist: who, which order, what happened, what the member wants. After the tool returns, tell the member the request number and that a specialist replies by email within one working day.
</handing_over>`;
}

const ESCALATE = {
  name: 'escalate_to_specialist',
  description: 'Open a support request so a ShoeLab specialist follows up with the member by email. Use when the member asks for a person or needs someone with access to orders, payments, payouts, refunds or accounts, or when you could not resolve the issue. Do not use it for questions you can answer from the Vault rules.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'For the specialist, in English: who, which order (number if known), what happened, what the member wants. 2-6 sentences.' },
      category: { type: 'string', enum: ['order', 'payment', 'account', 'authentication', 'technical', 'other'], description: 'The main topic.' },
      urgent: { type: 'boolean', description: 'True for money missing, a safety issue, or a deadline within 24 hours.' },
    },
    required: ['summary', 'category', 'urgent'],
    additionalProperties: false,
  },
};

const SORRY = {
  en: 'Sorry, I could not answer that just now. A ShoeLab specialist can help — use “Talk to a specialist” below.',
  de: 'Entschuldige, das konnte ich gerade nicht beantworten. Ein ShoeLab-Spezialist hilft dir weiter – nutze „Mit einem Spezialisten sprechen“ unten.',
  pl: 'Przepraszam, nie mogę teraz na to odpowiedzieć. Specjalista ShoeLab pomoże — użyj opcji „Porozmawiaj ze specjalistą” poniżej.',
  ru: 'Извините, сейчас я не могу ответить. Специалист ShoeLab поможет — нажмите «Связаться со специалистом» ниже.',
  uk: 'Вибачте, зараз я не можу відповісти. Спеціаліст ShoeLab допоможе — скористайтеся «Зв’язатися зі спеціалістом» нижче.',
  it: 'Scusa, ora non riesco a rispondere. Uno specialista ShoeLab può aiutarti: usa «Parla con uno specialista» qui sotto.',
  es: 'Lo siento, ahora no puedo responder. Un especialista de ShoeLab puede ayudarte: usa «Hablar con un especialista» abajo.',
  fr: 'Désolé, je ne peux pas répondre pour le moment. Un spécialiste ShoeLab peut t’aider : utilise « Parler à un spécialiste » ci-dessous.',
};

// ── the member's situation, for the second (uncached) system block ─────────
async function memberContext(env, me, lang, page) {
  const lines = ['Date: ' + nowIso().slice(0, 10), 'Member language: ' + LANG_NAMES[lang] + ' (' + lang + ')',
    'Page the member is on: ' + (page || 'unknown')];
  if (!me) {
    lines.push('The visitor is not signed in. You cannot see any orders. To hand over to a specialist they need to leave an email address in the "Talk to a specialist" form, or sign in.');
    return lines.join('\n');
  }
  lines.push('Member: ' + firstName(me.name) + ' (signed in; email ' + (me.verified ? 'confirmed' : 'NOT confirmed yet') + ')');
  if (connectOn(env)) {
    const s = await sellerRow(env, me.id);
    lines.push('Stripe payouts: switched on. This member\'s payout setup: ' + (!s ? 'not started' : s.payouts_enabled ? 'complete' : s.details_submitted ? 'submitted, Stripe still checking' : 'started, not finished'));
  } else {
    lines.push('Stripe payouts: not switched on (sellers are paid by bank transfer after delivery).');
  }
  lines.push('Card payments: ' + (env.STRIPE_SECRET_KEY ? 'on' : 'off (bank transfer details by email)'));
  const orders = await env.DB.prepare(
    `SELECT o.*, l.brand, l.model, l.size FROM mk_orders o LEFT JOIN mk_listings l ON l.id = o.listing_id
     WHERE o.buyer_id = ? OR o.seller_id = ? ORDER BY o.id DESC LIMIT 8`
  ).bind(me.id, me.id).all();
  const os = orders.results || [];
  lines.push(os.length ? 'Their recent orders:' : 'They have no orders yet.');
  for (const o of os) {
    const role = o.buyer_id === me.id ? 'bought' : 'sold';
    lines.push('- Order #' + o.id + ': ' + role + ' ' + listingTitle(o) + ' (EU ' + o.size + '), ' + (o.tier === 'lab' ? 'Lab Verified' : 'Photo Verified') +
      ', status ' + o.status + (o.payout_status && role === 'sold' ? ', payout ' + o.payout_status : '') +
      ', ' + (role === 'bought' ? 'total ' + euro(o.total) : 'payout ' + euro(o.payout)) +
      (o.tracking_out ? ', tracking to buyer ' + o.tracking_out : '') + (o.tracking_in ? ', tracking to lab ' + o.tracking_in : '') +
      ', created ' + String(o.created_at).slice(0, 10) + ', last change ' + String(o.updated_at || o.created_at).slice(0, 10));
  }
  const listings = await env.DB.prepare(
    "SELECT id, brand, model, status, format, price, bids FROM mk_listings WHERE seller_id = ? AND status IN ('review','live','rejected') ORDER BY id DESC LIMIT 6"
  ).bind(me.id).all();
  for (const l of listings.results || []) {
    lines.push('- Listing #' + l.id + ': ' + listingTitle(l) + ', ' + l.status + ', ' + l.format + ' at ' + euro(l.price) + (l.format === 'auction' ? ', ' + l.bids + ' bids' : ''));
  }
  return lines.join('\n');
}

// ── usage limits ────────────────────────────────────────────────────────────
async function visitorKey(request, me) {
  if (me) return 'u' + me.id;
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('shoelab-support:' + ip));
  return 'ip' + Array.from(new Uint8Array(h).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}
async function spend(env, key, limit) {
  const day = nowIso().slice(0, 10);
  await env.DB.prepare('INSERT INTO support_usage (k, day, n) VALUES (?, ?, 1) ON CONFLICT(k, day) DO UPDATE SET n = n + 1').bind(key, day).run();
  const row = await env.DB.prepare('SELECT n FROM support_usage WHERE k = ? AND day = ?').bind(key, day).first();
  return row && row.n <= limit;
}

// ── tickets ─────────────────────────────────────────────────────────────────
const TOPIC_KEY = { order: 'catOrder', payment: 'catPayment', account: 'catAccount', authentication: 'catAuth', technical: 'catTech', other: 'catOther' };

async function openTicket(env, who, fields) {
  const at = nowIso();
  const transcript = (fields.transcript || []).slice(-16);
  const r = await env.DB.prepare(
    'INSERT INTO mk_tickets (user_id, name, email, lang, topic, summary, transcript, page, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, \'open\', ?, ?)'
  ).bind(who.id || null, who.name || '', who.email, who.lang, fields.topic, fields.summary, JSON.stringify(transcript), fields.page || '', at, at).run();
  const id = r.meta.last_row_id;
  await env.DB.prepare('INSERT INTO mk_ticket_msgs (ticket_id, sender, body, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, 'member', fields.message || fields.summary, at).run();
  await tellStudio(env, 'sSupport', {
    ticket: id, customer: who.name || who.email, topic: { k: TOPIC_KEY[fields.topic] || 'catOther' },
    message: fields.summary, transcript, url: '/vault-lab.html#support',
    rows: [['name', who.name || '—'], ['email', who.email], ['language', LANG_NAMES[who.lang] || who.lang],
      ['category', { k: TOPIC_KEY[fields.topic] || 'catOther' }], fields.urgent ? ['status', 'URGENT'] : null].filter(Boolean),
  }, who.email);
  await tell(env, { email: who.email, name: who.name, lang: who.lang }, 'supportReceived', {
    ticket: id, message: fields.message || fields.summary,
  });
  return id;
}

function cleanTranscript(list) {
  return (Array.isArray(list) ? list : []).slice(-16).map((m) => ({
    role: m && m.role === 'assistant' ? 'assistant' : 'user', text: clean(String((m && m.text) || ''), 1500),
  })).filter((m) => m.text);
}

// POST /api/market/support/chat  { messages: [{role, text}], page }
export async function supportChat(request, env, me, b) {
  const lang = me && pickLang(me.lang) ? me.lang : requestLang(request);
  const msgs = cleanTranscript(b.messages);
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return { status: 400, body: { error: 'Ask a question first', code: 'support_empty' } };
  if (msgs.reduce((n, m) => n + m.text.length, 0) > 12000) msgs.splice(0, msgs.length - 6);
  if (!(await spend(env, await visitorKey(request, me), me ? LIMITS.member : LIMITS.guest))) {
    return { status: 429, body: { error: 'Daily limit reached', code: 'support_limit' } };
  }
  if (!env.ANTHROPIC_API_KEY) return { status: 200, body: { reply: SORRY[lang], offline: true } };

  // the API wants alternating turns that start with the member
  const messages = [];
  for (const m of msgs) {
    const last = messages[messages.length - 1];
    if (last && last.role === m.role) last.content += '\n\n' + m.text;
    else messages.push({ role: m.role, content: m.text });
  }
  while (messages.length && messages[0].role !== 'user') messages.shift();

  const system = [
    { type: 'text', text: knowledge(env), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: '<context>\n' + await memberContext(env, me, lang, clean(String(b.page || ''), 200)) + '\n</context>' },
  ];
  let ticket = null, needContact = false;
  for (let round = 0; round < 3; round++) {
    let data;
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01',
          // if a safety classifier declines, the request is re-run on a fallback model
          'anthropic-beta': 'server-side-fallback-2026-07-01',
        },
        body: JSON.stringify({
          model: MODEL, max_tokens: 2000, fallbacks: 'default',
          // quick, short answers: this is a chat window
          output_config: { effort: 'low' },
          system, tools: [ESCALATE], messages,
        }),
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('support: ' + res.status + ' ' + JSON.stringify(data).slice(0, 300));
        return { status: 200, body: { reply: SORRY[lang], ticket } };
      }
    } catch (e) {
      console.error('support: network ' + String(e).slice(0, 200));
      return { status: 200, body: { reply: SORRY[lang], ticket } };
    }
    if (data.stop_reason === 'refusal') return { status: 200, body: { reply: SORRY[lang], ticket } };
    const content = Array.isArray(data.content) ? data.content : [];
    const text = content.filter((c) => c.type === 'text' && c.text).map((c) => c.text).join('\n\n').trim();
    const calls = content.filter((c) => c.type === 'tool_use');
    if (data.stop_reason !== 'tool_use' || !calls.length) {
      return { status: 200, body: { reply: text || SORRY[lang], ticket, needContact } };
    }
    // run the hand-over, then let Wesley tell the member what happens next
    const results = [];
    for (const call of calls) {
      let out;
      const input = call.input || {};
      if (call.name !== ESCALATE.name) out = 'Unknown tool.';
      else if (!me) {
        needContact = true;
        out = 'Not created: the visitor is not signed in, so there is no email address to answer. Ask them to fill in the "Talk to a specialist" form below this chat (it asks for their email), or to sign in.';
      } else if (ticket) {
        out = 'A request was already opened in this conversation: #' + ticket.id + '.';
      } else {
        const id = await openTicket(env, { id: me.id, name: me.name, email: me.email, lang }, {
          topic: TOPIC_KEY[input.category] ? input.category : 'other', summary: clean(String(input.summary || ''), 2000) || 'Support request',
          urgent: !!input.urgent, transcript: msgs, page: b.page, message: msgs[msgs.length - 1].text,
        });
        ticket = { id };
        out = 'Request #' + id + ' opened. A specialist will reply to ' + me.email + ' within one working day.';
      }
      results.push({ type: 'tool_result', tool_use_id: call.id, content: out });
    }
    messages.push({ role: 'assistant', content });
    messages.push({ role: 'user', content: results });
  }
  return { status: 200, body: { reply: SORRY[lang], ticket, needContact } };
}

// POST /api/market/support/ticket  { message, name?, email?, page?, transcript? }
export async function supportTicket(request, env, me, b) {
  const lang = me && pickLang(me.lang) ? me.lang : requestLang(request);
  const message = clean(String(b.message || ''), 2000);
  if (message.length < 10) return { status: 400, body: { error: 'Tell us a little more', code: 'support_short' } };
  let who;
  if (me) who = { id: me.id, name: me.name, email: me.email, lang };
  else {
    const email = clean(String(b.email || ''), 254).toLowerCase();
    if (!validEmail(email)) return { status: 400, body: { error: 'Enter a valid email address', code: 'support_email' } };
    who = { name: clean(String(b.name || ''), 80), email, lang };
  }
  if (!(await spend(env, 't' + await visitorKey(request, me), LIMITS.tickets))) {
    return { status: 429, body: { error: 'Daily limit reached', code: 'support_limit' } };
  }
  const topic = TOPIC_KEY[b.topic] ? b.topic : 'other';
  const id = await openTicket(env, who, { topic, summary: message, message, transcript: cleanTranscript(b.transcript), page: clean(String(b.page || ''), 200) });
  return { status: 200, body: { ok: true, ticket: { id } } };
}

// POST /api/market/support/answer  { ticketId, message, close }  (specialists)
export async function supportAnswer(env, b) {
  const t = await env.DB.prepare('SELECT * FROM mk_tickets WHERE id = ?').bind(parseInt(b.ticketId, 10) || 0).first();
  if (!t) return { status: 404, body: { error: 'Request not found', code: 'gone' } };
  const message = clean(String(b.message || ''), 4000);
  const at = nowIso();
  if (message) {
    await env.DB.prepare('INSERT INTO mk_ticket_msgs (ticket_id, sender, body, created_at) VALUES (?, ?, ?, ?)').bind(t.id, 'specialist', message, at).run();
    const user = t.user_id ? await userById(env, t.user_id) : null;
    await tell(env, { email: t.email, name: (user && user.name) || t.name, lang: t.lang }, 'supportReply', { ticket: t.id, message });
  } else if (!b.close) {
    return { status: 400, body: { error: 'Write an answer first', code: 'note_needed' } };
  }
  await env.DB.prepare('UPDATE mk_tickets SET status = ?, updated_at = ? WHERE id = ?').bind(b.close ? 'closed' : 'answered', at, t.id).run();
  return { status: 200, body: { ok: true } };
}

export async function ticketsForQueue(env) {
  const rows = await env.DB.prepare(
    "SELECT * FROM mk_tickets WHERE status != 'closed' OR updated_at > ? ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'answered' THEN 1 ELSE 2 END, id DESC LIMIT 40"
  ).bind(new Date(Date.now() - 7 * 86400000).toISOString()).all();
  const out = [];
  for (const t of rows.results || []) {
    const msgs = await env.DB.prepare('SELECT sender, body, created_at FROM mk_ticket_msgs WHERE ticket_id = ? ORDER BY id').bind(t.id).all();
    let transcript = [];
    try { transcript = JSON.parse(t.transcript || '[]'); } catch (e) { /* none */ }
    out.push({
      id: t.id, name: t.name, email: t.email, lang: t.lang, topic: t.topic, summary: t.summary, page: t.page,
      status: t.status, createdAt: t.created_at, updatedAt: t.updated_at, transcript,
      messages: (msgs.results || []).map((m) => ({ from: m.sender, body: m.body, at: m.created_at })),
    });
  }
  return out;
}
