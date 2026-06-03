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

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 800,
        system: system || 'You are Wesley, the helpful AI assistant for ShoeLab.de shoe cleaning studio in Bremen, Germany.',
        messages: messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return json({
        content: [{ type: 'text', text: "Sorry, I'm having a brief issue. Please try again in a moment!" }],
      }, 200);
    }

    return json(data, 200);
  } catch (err) {
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
