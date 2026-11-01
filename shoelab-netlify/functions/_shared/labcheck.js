// ShoeLab Vault — the Lab Check, an AI authenticity check of every listing.
//
// Claude looks at every photo of a pair together with what the seller says it
// is, and reports detail by detail what checks out, what does not, what it
// could not see, and what it would need to be sure. The specialist reads that
// in the lab console before deciding. When the photos are not enough, the
// check asks the seller for exactly the shots (or facts) it needs, and runs
// again once they arrive.
//
// Photos alone never prove a pair genuine beyond doubt, so the check gives a
// verdict with a confidence, not a guarantee. It never rejects a listing by
// itself, and it approves one only when VAULT_AUTO_APPROVE is on and it is at
// least VAULT_AUTO_APPROVE_MIN % sure with every critical detail in order.
import { clean } from './util.js';
import { nowIso, listingTitle, tell, tellStudio, logEvent, userById, approveListing, LAB } from './vault.js';

export const CHECK_MODEL = 'claude-opus-5-5';
const PRICE_IN = 4, PRICE_OUT = 20;              // US$ per million tokens (Opus 5.5)
const DAILY_LIMIT = 8;                           // runs per listing per day: a cost guard
const RUNNING_MS = 4 * 60 * 1000;                // after this a run that never finished is stale
const ASK_ROUNDS = 2;                            // automatic requests to a seller per listing
const MAX_ITEMS = 6;

export const VERDICTS = ['authentic', 'likely_authentic', 'inconclusive', 'likely_counterfeit', 'counterfeit'];
export const AREAS = ['size_tag', 'box_label', 'style_code', 'logos', 'stitching', 'shape', 'materials',
  'sole', 'insole', 'condition', 'consistency', 'photos', 'other'];
const STATUSES = ['pass', 'concern', 'fail', 'not_visible'];
// a concern here is enough to keep a listing from being approved automatically
const CRITICAL = ['size_tag', 'box_label', 'style_code', 'logos', 'consistency', 'photos'];

export function checkOn(env) {
  return !!env.ANTHROPIC_API_KEY && String(env.VAULT_LAB_CHECK || 'on').toLowerCase() !== 'off';
}
export function autoApproveOn(env) { return String(env.VAULT_AUTO_APPROVE || '').toLowerCase() === 'on'; }
export function autoMin(env) {
  const n = parseInt(env.VAULT_AUTO_APPROVE_MIN, 10);
  return n >= 80 && n <= 100 ? n : 95;
}
export function checkSettings(env) {
  return { on: checkOn(env), auto: autoApproveOn(env), min: autoMin(env) };
}

const LANG_NAMES = { en: 'English', de: 'German', pl: 'Polish', ru: 'Russian', uk: 'Ukrainian', it: 'Italian', es: 'Spanish', fr: 'French' };
const KIND_NAMES = {
  side_out: 'outer side', side_in: 'inner side', sole: 'outsole (bottom)', size_tag: 'size tag (label inside the shoe)',
  box_label: 'box label', insole: 'insole', heel: 'heel', toe: 'toe', other: 'other view',
};
const COND_NAMES = {
  new: 'new: never worn, original box and tags', like_new: 'like new: worn once or twice, no visible wear',
  good: 'good: light signs of wear, clean and solid', fair: 'fair: visible wear, still plenty of life left',
};

// What the check answers with. Properties come in the order Claude should
// work: what the pair is, each detail, then the verdict last.
const REPORT = {
  type: 'object', additionalProperties: false,
  properties: {
    identified: {
      type: 'object', additionalProperties: false,
      properties: {
        brand: { type: 'string' }, model: { type: 'string' }, colorway: { type: 'string' },
        style_code: { type: 'string' }, size_on_tag: { type: 'string' },
        matches_listing: { type: 'boolean' }, note: { type: 'string' },
      },
      required: ['brand', 'model', 'colorway', 'style_code', 'size_on_tag', 'matches_listing', 'note'],
    },
    checks: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { area: { type: 'string', enum: AREAS }, status: { type: 'string', enum: STATUSES }, finding: { type: 'string' } },
        required: ['area', 'status', 'finding'],
      },
    },
    red_flags: { type: 'array', items: { type: 'string' } },
    condition: {
      type: 'object', additionalProperties: false,
      properties: { matches: { type: 'boolean' }, note: { type: 'string' } },
      required: ['matches', 'note'],
    },
    requests: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          type: { type: 'string', enum: ['photo', 'text'] },
          title: { type: 'string' }, instructions: { type: 'string' },
          title_en: { type: 'string' }, instructions_en: { type: 'string' }, why: { type: 'string' },
        },
        required: ['type', 'title', 'instructions', 'title_en', 'instructions_en', 'why'],
      },
    },
    verdict: { type: 'string', enum: VERDICTS },
    confidence: { type: 'integer' },
    summary: { type: 'string' },
  },
  required: ['identified', 'checks', 'red_flags', 'condition', 'requests', 'verdict', 'confidence', 'summary'],
};

const SYSTEM = `You are the Lab Check, the authentication analyst of the ShoeLab Vault, a sneaker resale marketplace run by ShoeLab, a sneaker care studio in Bremen, Germany. A seller has listed a pair. You see their photos and what they say the pair is. Your report goes to a ShoeLab specialist, who makes the final decision before the listing goes live; buyers rely on it, so be rigorous and sceptical.

How to work:
- Look closely at every photo before deciding anything. Judge only what you can actually see. When a detail that matters is not visible, not sharp or not lit well enough, mark that check "not_visible" and ask for it; never guess or fill gaps from memory.
- Work out what the pair is from the photos themselves (brand, model, colourway, the style code printed on the size tag and the box label) and compare it with what the seller wrote. Note the size printed on the tag.
- Check the details counterfeits most often get wrong for this exact model, for example:
  - Size tag: font, spacing and alignment; style code and colourway code; production dates and factory code; barcode/UPC; the US/UK/EU/CM sizes agreeing with each other and with the listed size.
  - Box label: the same style code, size, colourway name and barcode as the size tag; label font and layout.
  - Logos and branding: shape, proportions, placement, embroidery or print quality.
  - Construction: stitching density, evenness and spacing; glue marks; panel alignment; toe box and heel shape; heel tab; tongue and tongue label.
  - Materials: leather grain, suede nap, mesh, the colour and texture of each part.
  - Sole: tread pattern, moulding, printed text, colours, wear.
  - Insole: printing, logo, fit.
  - Signatures of the model (for example Off-White's zip tie, quotation-mark text and "SHOELACES" lace text, Jordan Wings and Jumpman proportions, Yeezy SPLY-350 text, New Balance Made in USA/UK labels).
- Check that the photos show one real pair in the seller's hands: the same pair in every photo (left and right, wear, laces), no stock or catalogue pictures, no screenshots, no other shop's watermark.
- Check that the condition the seller chose matches the wear you see.

The verdict:
- authentic: every critical detail you can see (size tag, box label if shown, style code, logos, construction) is consistent with a genuine pair, nothing contradicts it, and the photos are clear enough to judge.
- likely_authentic: genuine as far as you can see, but one or more details could not be checked well enough.
- inconclusive: the photos are not enough to tell either way.
- likely_counterfeit: at least one detail contradicts a genuine pair.
- counterfeit: several clear contradictions; you are sure.
- confidence (0 to 100): how sure you are of your verdict. Photos never prove a pair genuine beyond doubt, so be calibrated: 95 or more only when the size tag and at least two other critical details are clearly visible and correct and nothing is off.

Requests:
- If anything would change or firm up your verdict, ask for it: a specific photo (say exactly what to photograph, the angle, how close and the light, for example "the size tag inside the left shoe, straight on, filling the frame, in daylight, without flash") or a short fact (for example where and when the pair was bought, with a photo of the receipt if they have one; when you ask for a receipt, tell them they may cover their address and payment details).
- Ask only for what you need, most important first, at most ${MAX_ITEMS} things. Never ask again for something the seller already sent or said they cannot provide; never ask for a photo that is already there and sharp.
- Write "title" and "instructions" in the seller's language, short and friendly, addressed to the seller. Write "title_en", "instructions_en" and "why" in English for the specialist.
- With a verdict of authentic at 95 or more, requests can be empty.

Write the findings, red flags, condition note and summary in English for the specialist: concrete and short, naming the photo ("Photo 5, size tag: ..."). The summary is two to four sentences.`;

/* ── reading a listing ───────────────────────────────────────────────────── */
async function photosOf(env, listingId) {
  const rows = await env.DB.prepare('SELECT id, kind, note, mime, data FROM mk_photos WHERE listing_id = ? ORDER BY idx, id').bind(listingId).all();
  const out = [];
  for (const p of rows.results || []) {
    let b64 = p.data;
    if (String(b64).slice(0, 3) === 'r2:') {
      const obj = env.VAULT_PHOTOS && await env.VAULT_PHOTOS.get(b64.slice(3));
      if (!obj) continue;
      const bytes = new Uint8Array(await obj.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      b64 = btoa(bin);
    }
    out.push({ id: p.id, kind: p.kind, note: p.note, mime: p.mime, b64 });
  }
  return out;
}

export async function latestCheck(env, listingId) {
  return env.DB.prepare('SELECT * FROM mk_checks WHERE listing_id = ? ORDER BY id DESC LIMIT 1').bind(listingId).first();
}
export async function latestRequest(env, listingId) {
  return env.DB.prepare('SELECT * FROM mk_requests WHERE listing_id = ? ORDER BY id DESC LIMIT 1').bind(listingId).first();
}
const parse = (s, dflt) => { try { return s ? JSON.parse(s) : dflt; } catch (e) { return dflt; } };

// What the console shows of a run.
export function checkView(row) {
  if (!row) return null;
  const stale = row.status === 'running' && Date.now() - Date.parse(row.created_at) > RUNNING_MS;
  return {
    id: row.id, status: stale ? 'error' : row.status, verdict: row.verdict, confidence: row.confidence,
    result: parse(row.result, null), error: stale ? 'did not finish' : row.error, model: row.model,
    cost: row.cost, by: row.by_whom, at: row.created_at, doneAt: row.done_at, photoIds: parse(row.photo_ids, []),
  };
}
export function requestView(row) {
  if (!row) return null;
  return { id: row.id, checkId: row.check_id, status: row.status, items: parse(row.items, []), answers: parse(row.answers, []), at: row.created_at, answeredAt: row.answered_at };
}

/* ── asking Claude ───────────────────────────────────────────────────────── */
function facts(l, seller, prior, req) {
  const lines = [
    'The listing:',
    '- Brand (as typed by the seller): ' + l.brand,
    '- Model (as typed by the seller): ' + l.model,
    '- Size: EU ' + l.size,
    '- Condition the seller chose: ' + (COND_NAMES[l.cond] || l.cond),
    '- Description: ' + (l.description ? '"' + l.description + '"' : '(none)'),
    '- Verification route: ' + (l.tier === 'lab'
      ? 'Lab Verified — after a sale the pair is also inspected by hand in the ShoeLab lab.'
      : 'Photo Verified — after a sale the pair goes straight from the seller to the buyer, so this check and the specialist are the only checks.'),
    "- Seller's language: " + (LANG_NAMES[seller && seller.lang] || 'English'),
  ];
  if (prior && prior.result) {
    const r = prior.result;
    lines.push('', 'Your previous check of this listing: ' + r.verdict + ' at ' + r.confidence + '%. ' + (r.summary || ''));
  }
  if (req && req.items.length) {
    lines.push('', 'You asked the seller for:');
    req.items.forEach((it, i) => {
      const a = (req.answers || []).find((x) => x.i === i) || {};
      const said = a.none ? 'the seller says they cannot provide this' : a.text ? 'the seller answered: "' + a.text + '"'
        : a.photo ? 'sent as a photo below' : 'no answer';
      lines.push('- ' + it.title_en + ' — ' + said);
    });
  }
  return lines.join('\n');
}

async function askClaude(env, l, seller, photos, prior, req) {
  const content = [{ type: 'text', text: facts(l, seller, prior, req) + '\n\nThe photos, each labelled with what it shows:' }];
  photos.forEach((p, i) => {
    const label = p.kind === 'extra' ? 'extra photo the seller sent on request: ' + (p.note || 'requested detail') : (KIND_NAMES[p.kind] || p.kind);
    content.push({ type: 'text', text: 'Photo ' + (i + 1) + ' — ' + label });
    content.push({ type: 'image', source: { type: 'base64', media_type: p.mime, data: p.b64 } });
  });
  content.push({ type: 'text', text: 'Check this pair and report.' });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01',
      // if a safety classifier declines, the request is re-run on a fallback model
      'anthropic-beta': 'server-side-fallback-2026-07-01',
    },
    body: JSON.stringify({
      model: env.VAULT_CHECK_MODEL || CHECK_MODEL, max_tokens: 20000, fallbacks: 'default',
      // careful work: the details that give a fake away are small
      output_config: { effort: 'high', format: { type: 'json_schema', schema: REPORT } },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('Claude ' + res.status + ': ' + ((data.error && data.error.message) || 'no answer'));
  if (data.stop_reason === 'refusal') throw new Error('Claude declined to check these photos');
  if (data.stop_reason === 'max_tokens') throw new Error('the report was cut off');
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  let r;
  try { r = JSON.parse(text); } catch (e) { throw new Error('the report could not be read'); }
  const u = data.usage || {};
  const tokensIn = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) * 1.25 + (u.cache_read_input_tokens || 0) * 0.1;
  const cost = Math.ceil((tokensIn * PRICE_IN + (u.output_tokens || 0) * PRICE_OUT) / 10000);   // US cents
  return { report: tidy(r), model: data.model || CHECK_MODEL, cost };
}

// The schema fixes the shape; this keeps lengths and ranges sane.
function tidy(r) {
  const s = (v, n) => clean(String(v == null ? '' : v), n);
  const id = r.identified || {};
  return {
    identified: {
      brand: s(id.brand, 60), model: s(id.model, 120), colorway: s(id.colorway, 120), style_code: s(id.style_code, 40),
      size_on_tag: s(id.size_on_tag, 80), matches_listing: !!id.matches_listing, note: s(id.note, 400),
    },
    checks: (Array.isArray(r.checks) ? r.checks : []).slice(0, 24)
      .filter((c) => c && AREAS.indexOf(c.area) !== -1 && STATUSES.indexOf(c.status) !== -1)
      .map((c) => ({ area: c.area, status: c.status, finding: s(c.finding, 500) })),
    red_flags: (Array.isArray(r.red_flags) ? r.red_flags : []).slice(0, 10).map((x) => s(x, 300)).filter(Boolean),
    condition: { matches: !!(r.condition && r.condition.matches), note: s(r.condition && r.condition.note, 300) },
    requests: (Array.isArray(r.requests) ? r.requests : []).slice(0, MAX_ITEMS)
      .filter((q) => q && (q.type === 'photo' || q.type === 'text') && q.title)
      .map((q) => ({
        type: q.type, title: s(q.title, 120), instructions: s(q.instructions, 400),
        title_en: s(q.title_en || q.title, 120), instructions_en: s(q.instructions_en, 400), why: s(q.why, 300),
      })),
    verdict: VERDICTS.indexOf(r.verdict) !== -1 ? r.verdict : 'inconclusive',
    confidence: Math.max(0, Math.min(100, Math.round(+r.confidence || 0))),
    summary: s(r.summary, 900),
  };
}

/* ── running a check ─────────────────────────────────────────────────────── */
// → { check, outcome } where outcome is 'approved' | 'flagged' | 'asked' | 'done' | 'error'
// → null when another run of this listing started a moment earlier.
export async function runCheck(env, l, by) {
  const at = nowIso(), recent = new Date(Date.now() - RUNNING_MS).toISOString();
  // one run at a time per listing, decided in a single statement
  const ins = await env.DB.prepare(
    "INSERT INTO mk_checks (listing_id, status, by_whom, created_at) SELECT ?, 'running', ?, ? WHERE NOT EXISTS (SELECT 1 FROM mk_checks WHERE listing_id = ? AND status = 'running' AND created_at > ?)"
  ).bind(l.id, by || null, at, l.id, recent).run();
  if (!ins.meta.changes) return null;
  const id = ins.meta.last_row_id;
  const seller = await userById(env, l.seller_id);
  const photos = await photosOf(env, l.id);
  const prev = await env.DB.prepare("SELECT * FROM mk_checks WHERE listing_id = ? AND status = 'done' AND id < ? ORDER BY id DESC LIMIT 1").bind(l.id, id).first();
  const req = requestView(await latestRequest(env, l.id));
  let out;
  try {
    out = await askClaude(env, l, seller, photos, checkView(prev), req);
  } catch (e) {
    const msg = String(e && e.message || e).slice(0, 300);
    console.error('lab check #' + l.id + ': ' + msg);
    await env.DB.prepare("UPDATE mk_checks SET status = 'error', error = ?, done_at = ? WHERE id = ?").bind(msg, nowIso(), id).run();
    return { check: checkView(await env.DB.prepare('SELECT * FROM mk_checks WHERE id = ?').bind(id).first()), outcome: 'error' };
  }
  const r = out.report;
  await env.DB.prepare(
    "UPDATE mk_checks SET status = 'done', verdict = ?, confidence = ?, result = ?, photo_ids = ?, model = ?, cost = ?, done_at = ? WHERE id = ?"
  ).bind(r.verdict, r.confidence, JSON.stringify(r), JSON.stringify(photos.map((p) => p.id)), out.model, out.cost, nowIso(), id).run();
  await logEvent(env, { listingId: l.id, kind: 'checked', note: r.verdict + ' ' + r.confidence + '%' });
  const outcome = await settle(env, l, seller, id, r);
  return { check: checkView(await env.DB.prepare('SELECT * FROM mk_checks WHERE id = ?').bind(id).first()), outcome };
}

// What happens after a check: approve (only if switched on and sure), tell
// the studio about a suspected fake, or ask the seller for what is missing.
async function settle(env, l, seller, checkId, r) {
  const clearlyFine = r.verdict === 'authentic' && r.confidence >= autoMin(env) && !r.red_flags.length &&
    r.identified.matches_listing && r.condition.matches &&
    !r.checks.some((c) => c.status === 'fail' || (c.status === 'concern' && CRITICAL.indexOf(c.area) !== -1));
  if (clearlyFine && autoApproveOn(env)) {
    const fresh = await env.DB.prepare('SELECT * FROM mk_listings WHERE id = ?').bind(l.id).first();
    if (fresh && fresh.status === 'review' && await approveListing(env, fresh, null, 'auto_approved')) return 'approved';
  }
  if (r.verdict === 'likely_counterfeit' || r.verdict === 'counterfeit') {
    await tellStudio(env, 'sCheckFlag', {
      title: listingTitle(l), url: LAB, message: r.summary,
      rows: [['verdict', { k: 'vd_' + r.verdict }], ['confidence', r.confidence + '%'], ['size', 'EU ' + l.size],
        ['seller', seller ? seller.name + ' <' + seller.email + '>' : '']],
    });
    return 'flagged';
  }
  if (r.requests.length && !clearlyFine) {
    const rounds = await env.DB.prepare('SELECT COUNT(*) AS n FROM mk_requests WHERE listing_id = ?').bind(l.id).first();
    if ((rounds.n || 0) < ASK_ROUNDS && await askSeller(env, l, seller, checkId, r.requests)) return 'asked';
  }
  return 'done';
}

// Sends the seller the list of what the check needs (also offered as a button
// in the console for a suspected fake, which is never asked automatically).
// The seller has one open request at a time. A specialist asking for a newer
// check's list (replace) closes an open request from an earlier check;
// the automatic path never does.
export async function askSeller(env, l, seller, checkId, items, replace) {
  if (!items || !items.length) return false;
  if (replace) {
    await env.DB.prepare("UPDATE mk_requests SET status = 'replaced' WHERE listing_id = ? AND status = 'open' AND (check_id IS NULL OR check_id != ?)")
      .bind(l.id, checkId || 0).run();
  }
  const open = await env.DB.prepare("SELECT id FROM mk_requests WHERE listing_id = ? AND status = 'open'").bind(l.id).first();
  if (open) return false;
  await env.DB.prepare("INSERT INTO mk_requests (listing_id, check_id, items, status, created_at) VALUES (?, ?, ?, 'open', ?)")
    .bind(l.id, checkId || null, JSON.stringify(items), nowIso()).run();
  await logEvent(env, { listingId: l.id, kind: 'info_requested', note: items.map((x) => x.title_en).join('; ').slice(0, 480) });
  await tell(env, seller, 'listingNeedsMore', {
    title: listingTitle(l), url: '/vault-me.html#selling',
    message: items.map((x) => '• ' + x.title + (x.instructions ? ' — ' + x.instructions : '')).join('\n'),
  });
  return true;
}

// May this run now? → null when yes, or the reason it may not.
export async function mayRun(env, l, force) {
  if (!checkOn(env)) return 'check_off';
  if (l.status !== 'review') return 'wrong_step';
  const last = await latestCheck(env, l.id);
  if (last && last.status === 'running' && Date.now() - Date.parse(last.created_at) < RUNNING_MS) return 'running';
  const day = new Date(Date.now() - 86400000).toISOString();
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM mk_checks WHERE listing_id = ? AND created_at > ?').bind(l.id, day).first();
  if ((n.n || 0) >= DAILY_LIMIT) return 'check_limit';
  if (!force && last && last.status === 'done') {
    // nothing new to look at since the last run: keep its result
    const seen = parse(last.photo_ids, []);
    const now = await env.DB.prepare('SELECT id FROM mk_photos WHERE listing_id = ? ORDER BY idx, id').bind(l.id).all();
    const ids = (now.results || []).map((p) => p.id);
    const req = await latestRequest(env, l.id);
    const answeredAfter = req && req.answered_at && req.answered_at > last.created_at;
    if (!answeredAfter && ids.length === seen.length && ids.every((x, i) => x === seen[i])) return 'up_to_date';
  }
  return null;
}
