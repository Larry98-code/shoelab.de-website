// ShoeLab — Wesley AI Proxy
// Cloudflare Pages Function  ·  route: /api/wesley
// Mirrors the Netlify function; keeps the Anthropic API key server-side.
//
// Tries the strongest available model first and falls back automatically,
// so Wesley keeps answering even if the account lacks access to a newer
// model. The real API error is logged for the Cloudflare dashboard.

const MODELS = ['claude-sonnet-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'];

// Some model generations return multiple content blocks (reasoning first,
// answer second). Normalise to a single text block so every client works.
function normalizeReply(data) {
  if (!data || !Array.isArray(data.content)) return data;
  const text = data.content
    .filter((c) => c && c.type === 'text' && c.text)
    .map((c) => c.text)
    .join('\n\n');
  if (!text) return data;
  return Object.assign({}, data, { content: [{ type: 'text', text }] });
}


function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function json(obj, status, extra) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, cors(), extra || {}),
  });
}

async function callAnthropic(apiKey, model, system, messages) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: 1200, system, messages }),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

// CORS preflight
export async function onRequestOptions() {
  return new Response('', { status: 204, headers: cors() });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'API key not configured' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { messages, system } = body || {};
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'Messages required' }, 400);
  }

  const sys = system || 'You are Wesley, the helpful AI assistant for ShoeLab.de shoe cleaning studio in Bremen, Germany.';

  try {
    let last = null;
    for (const model of MODELS) {
      const r = await callAnthropic(env.ANTHROPIC_API_KEY, model, sys, messages);
      if (r.ok) {
        return json(normalizeReply(r.data), 200, { 'X-Wesley-Model': model });
      }
      last = r;
      console.error('wesley: model ' + model + ' failed (' + r.status + '): ' + JSON.stringify(r.data).slice(0, 300));
      // 401 = bad key, 400 = bad request payload — no point trying other models
      const type = r.data && r.data.error && r.data.error.type;
      if (r.status === 401 || (r.status === 400 && type !== 'not_found_error')) break;
    }

    const type = (last && last.data && last.data.error && last.data.error.type) || '';
    let msg = "Sorry, I'm having a brief issue. Please try again in a moment!";
    if (last && last.status === 401) msg = "I'm being reconnected by the team — please try again shortly, or WhatsApp us at +49 177 2258878!";
    if (last && (last.status === 429 || type === 'overloaded_error')) msg = "I'm getting a lot of questions right now! 😅 Give me a few seconds and try again.";
    return json({ content: [{ type: 'text', text: msg }] }, 200, {
      'X-Wesley-Error': String(last && last.status) + ':' + type,
    });
  } catch (err) {
    console.error('wesley: network error: ' + String(err).slice(0, 200));
    return json({
      content: [{ type: 'text', text: "I'm reconnecting — please send your message again!" }],
    }, 200);
  }
}

// Reject non-POST methods cleanly
export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return onRequestOptions();
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ error: 'Method not allowed' }, 405);
}
