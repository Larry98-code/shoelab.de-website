// ShoeLab — Wesley AI Proxy
// Cloudflare Pages Function  ·  route: /api/wesley
// Mirrors the Netlify function; keeps the Anthropic API key server-side.

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

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1200,
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

// Reject non-POST methods cleanly
export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return onRequestOptions();
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ error: 'Method not allowed' }, 405);
}
