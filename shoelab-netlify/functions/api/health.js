// ShoeLab — Wesley diagnostics endpoint
// GET /api/health  →  human-readable JSON: is the key valid, which models
// respond, and the exact Anthropic error if not. Costs ~1 token per model.

import { sendEmail, notifyAddress } from '../_shared/util.js';

const MODELS = ['claude-sonnet-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'];

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
          : '⚠️ Emails will send, but MAIL_FROM is unset so Resend uses onboarding@resend.dev, which only delivers to the address that owns the Resend account. Verify your domain and set MAIL_FROM to e.g. "ShoeLab <booking@shoelabonline.de>".')
      : '❌ RESEND_API_KEY is not set — NO booking emails are being sent. Add it under Settings → Variables and Secrets, then redeploy.',
  };

  // ── the Vault (resale marketplace) ──────────────────────────────────────
  // Specialist addresses can be private, so only their number is shown.
  const specialists = String(env.VAULT_SPECIALISTS || '').split(',').map((x) => x.trim()).filter(Boolean);
  out.vault = {
    database: !!env.DB,
    specialists: specialists.length || 1,
    specialistsFrom: specialists.length ? 'VAULT_SPECIALISTS' : 'the studio notify address (default)',
    onlinePayments: !!env.STRIPE_SECRET_KEY,
    siteUrl: env.SITE_URL || 'https://shoelabonline.de (default)',
    verdict: !env.DB
      ? '❌ No D1 database bound as DB — the Vault cannot run.'
      : env.STRIPE_SECRET_KEY
        ? '✅ The Vault is live with card payments.'
        : '✅ The Vault is live. Buyers reserve pairs and ShoeLab emails payment details by hand until STRIPE_SECRET_KEY is set.',
  };

  // GET /api/health?testmail=1 sends one real email, only ever to the
  // studio's own notify address — never to an address from the query string.
  const url = new URL(context.request.url);
  if (url.searchParams.get('testmail')) {
    const to = notifyAddress(env);
    const r = await sendEmail(env, {
      to,
      subject: '[TEST] ShoeLab booking email check',
      text: 'This is a test from /api/health?testmail=1.\n\n' +
            'If you are reading it, booking notifications will reach ' + to + '.\n',
    });
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
