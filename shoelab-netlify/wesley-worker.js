// ShoeLab.de — single Cloudflare Worker (Workers Static Assets)
// Serves the static site (via the ASSETS binding) AND the Wesley AI API
// at /api/wesley, keeping the Anthropic key server-side.

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

async function wesley(request, env) {
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

  // Strongest model first; fall back automatically if the account lacks access.
  const MODELS = ['claude-sonnet-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'];

  try {
    let last = null;
    for (const model of MODELS) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 1200,
          system: system || 'You are Wesley, the helpful AI assistant for ShoeLab.de shoe cleaning studio in Bremen, Germany.',
          messages: messages,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) return json(normalizeReply(data), 200, { 'X-Wesley-Model': model });
      last = { status: response.status, data };
      console.error('wesley: model ' + model + ' failed (' + response.status + '): ' + JSON.stringify(data).slice(0, 300));
      const type = data && data.error && data.error.type;
      if (response.status === 401 || (response.status === 400 && type !== 'not_found_error')) break;
    }
    const type = (last && last.data && last.data.error && last.data.error.type) || '';
    let msg = "Sorry, I'm having a brief issue. Please try again in a moment!";
    if (last && last.status === 401) msg = "I'm being reconnected by the team — please try again shortly, or WhatsApp us at +49 177 2258878!";
    if (last && (last.status === 429 || type === 'overloaded_error')) msg = "I'm getting a lot of questions right now! 😅 Give me a few seconds and try again.";
    return json({ content: [{ type: 'text', text: msg }] }, 200, { 'X-Wesley-Error': String(last && last.status) + ':' + type });
  } catch (err) {
    console.error('wesley: network error: ' + String(err).slice(0, 200));
    return json({
      content: [{ type: 'text', text: "I'm reconnecting — please send your message again!" }],
    }, 200);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/wesley') {
      if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: cors() });
      if (request.method === 'POST') return wesley(request, env);
      return json({ error: 'Method not allowed' }, 405);
    }

    // everything else → static site (index.html, etc.)
    return env.ASSETS.fetch(request);
  },
};
