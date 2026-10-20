// ShoeLab — Wesley diagnostics endpoint
// GET /api/health  →  human-readable JSON: is the key valid, which models
// respond, and the exact Anthropic error if not. Costs ~1 token per model.

import { notifyAddress } from '../_shared/util.js';
import { sendStudio } from '../_shared/mail.js';
import { connectOn } from '../_shared/vault.js';
import { MODEL as SUPPORT_MODEL } from '../_shared/support.js';

// the site chat's fallback chain, then the model behind Vault support
const MODELS = ['claude-sonnet-5', 'claude-sonnet-4-5', 'claude-haiku-4-5', SUPPORT_MODEL];

export async function onRequestGet(context) {
  const { env } = context;
  const out = {
    time: new Date().toISOString(),
    deploy: 'fallback-chain-v2',
    keyConfigured: !!env.ANTHROPIC_API_KEY,
    keyPrefix: env.ANTHROPIC_API_KEY ? env.ANTHROPIC_API_KEY.slice(0, 14) + '…' : null,
    db: !!env.DB,
    models: [],
  };

  // ── booking email ───────────────────────────────────────────────────────
  // sendEmail() quietly does nothing without a key, so a studio can lose
  // every appointment and never see an error. Say so plainly here.
  out.email = {
    resendKeyConfigured: !!env.RESEND_API_KEY,
    keyPrefix: env.RESEND_API_KEY ? env.RESEND_API_KEY.slice(0, 8) + '…' : null,
    from: env.MAIL_FROM || 'ShoeLab <onboarding@resend.dev>  (default — only delivers to the Resend account owner)',
    bookingsGoTo: notifyAddress(env),
    customAddressSet: !!env.NOTIFY_EMAIL,
    stripeWebhookSecret: !!env.STRIPE_WEBHOOK_SECRET,
    dropoffAddressSet: !!env.DROPOFF_ADDRESS,
    verdict: env.RESEND_API_KEY
      ? (env.MAIL_FROM
          ? '✅ Booking emails are configured.'
          : '⚠️ Emails will send, but MAIL_FROM is unset so Resend uses onboarding@resend.dev, which only delivers to the address that owns the Resend account. Set MAIL_FROM to an address on the domain verified in Resend, e.g. "ShoeLab <info@mail.shoelabonline.de>".')
      : '❌ RESEND_API_KEY is not set — NO booking emails are being sent. Add it under Settings → Variables and Secrets, then redeploy.',
  };

  // ── the Vault (resale marketplace) ──────────────────────────────────────
  // Specialist addresses can be private, so only their number is shown.
  const specialists = String(env.VAULT_SPECIALISTS || '').split(',').map((x) => x.trim()).filter(Boolean);
  out.sessionSecret = env.SESSION_SECRET ? 'set' : env.ANTHROPIC_API_KEY ? 'not set — borrowing ANTHROPIC_API_KEY (set SESSION_SECRET)' : '❌ not set — sign-ins are not safe';
  const connect = connectOn(env);
  out.vault = {
    database: !!env.DB,
    specialists: specialists.length || 1,
    specialistsFrom: specialists.length ? 'VAULT_SPECIALISTS' : 'the studio notify address (default)',
    onlinePayments: !!env.STRIPE_SECRET_KEY,
    // where the buyer's money waits, and how the seller is paid
    payouts: connect
      ? 'Stripe Connect: the money waits in Stripe and goes to the seller’s verified Stripe account on delivery; refunds go back to the card'
      : env.STRIPE_SECRET_KEY
        ? 'by hand from the emails (set VAULT_STRIPE_CONNECT=on to pay sellers through Stripe)'
        : 'by hand from the emails',
    photoStorage: env.VAULT_PHOTOS ? 'R2 bucket (VAULT_PHOTOS)' : 'the database (bind an R2 bucket as VAULT_PHOTOS for room to grow)',
    support: env.ANTHROPIC_API_KEY ? 'Wesley answers and hands over to a specialist when needed' : 'no ANTHROPIC_API_KEY: the help button opens the specialist form',
    labAddress: env.DROPOFF_ADDRESS ? 'set (sent privately to sellers of Lab Verified pairs)' : 'not set: sellers of Lab Verified pairs are told the address follows by email',
    emailLanguage: 'each member’s own language, with links to the other seven',
    siteUrl: env.SITE_URL || 'https://shoelabonline.de (default)',
    verdict: !env.DB
      ? '❌ No D1 database bound as DB — the Vault cannot run.'
      : !env.SESSION_SECRET && !env.ANTHROPIC_API_KEY
      ? '❌ SESSION_SECRET is not set — the Vault stays closed until it is.'
      : env.STRIPE_SECRET_KEY
        ? (env.STRIPE_WEBHOOK_SECRET
            ? (connect ? '✅ The Vault is live with card payments and Stripe payouts to sellers.' : '✅ The Vault is live with card payments.')
            : '⚠️ Card payments are on, but STRIPE_WEBHOOK_SECRET is missing, so Vault orders paid by card are not marked paid automatically. Add the webhook signing secret.')
        : '✅ The Vault is live. Buyers reserve pairs and ShoeLab emails payment details by hand until STRIPE_SECRET_KEY is set.',
  };

  // GET /api/health?testmail=1 sends one real email, only ever to the
  // studio's own notify address — never to an address from the query string.
  const url = new URL(context.request.url);
  if (url.searchParams.get('testmail')) {
    const to = notifyAddress(env);
    const r = await sendStudio(env, 'sTest', { to }, undefined, false);
    out.email.testSend = { to, result: r };
    out.email.testVerdict = r && r.ok
      ? '✅ Resend accepted the message. Check ' + to + ' (and the spam folder).'
      : '❌ Not sent: ' + JSON.stringify(r);
  }

  if (env.ANTHROPIC_API_KEY) {
    for (const model of MODELS) {
      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        });
        const data = await r.json().catch(() => ({}));
        out.models.push({
          model,
          ok: r.ok,
          status: r.status,
          error: r.ok ? null : (data.error ? data.error.type + ': ' + String(data.error.message).slice(0, 160) : 'unknown'),
        });
      } catch (e) {
        out.models.push({ model, ok: false, status: 0, error: 'network: ' + String(e).slice(0, 120) });
      }
    }
    out.verdict = out.models.some((m) => m.ok)
      ? '✅ Wesley can answer — at least one model works. If the chat still fails, the browser may be loading an old cached page (hard-refresh).'
      : '❌ No model works with this key. Read the first error above: authentication_error → the ANTHROPIC_API_KEY secret in Cloudflare is wrong/revoked (paste the current key from console.anthropic.com and retry deployment). billing/credit → add credits at console.anthropic.com.';
  } else {
    out.verdict = '❌ ANTHROPIC_API_KEY is not set for this deployment. Add it under Settings → Variables and Secrets (encrypted) and retry the deployment.';
  }

  return new Response(JSON.stringify(out, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return new Response(JSON.stringify({ error: 'GET only' }), { status: 405 });
}
