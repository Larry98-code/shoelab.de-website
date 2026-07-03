// ShoeLab — Wesley diagnostics endpoint
// GET /api/health  →  human-readable JSON: is the key valid, which models
// respond, and the exact Anthropic error if not. Costs ~1 token per model.

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
