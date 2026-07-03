// ShoeLab — Wesley AI Proxy
// Netlify Serverless Function v2

const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Check API key exists
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'API key not configured' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { messages, system } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Messages required' }) };
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
          'x-api-key': process.env.ANTHROPIC_API_KEY,
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
      if (response.ok) return { statusCode: 200, headers, body: JSON.stringify(data) };
      last = { status: response.status, data };
      console.error('wesley: model ' + model + ' failed (' + response.status + '):', JSON.stringify(data).slice(0, 300));
      const type = data && data.error && data.error.type;
      if (response.status === 401 || (response.status === 400 && type !== 'not_found_error')) break;
    }
    const type = (last && last.data && last.data.error && last.data.error.type) || '';
    let msg = 'Sorry, I\'m having a brief issue. Please try again in a moment!';
    if (last && last.status === 401) msg = 'I\'m being reconnected by the team — please try again shortly, or WhatsApp us at +49 177 2258878!';
    if (last && (last.status === 429 || type === 'overloaded_error')) msg = 'I\'m getting a lot of questions right now! 😅 Give me a few seconds and try again.';
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ content: [{ type: 'text', text: msg }] }),
    };

  } catch (err) {
    console.error('Fetch error:', err.message);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        content: [{ type: 'text', text: 'I\'m reconnecting — please send your message again!' }]
      }),
    };
  }
};

exports.handler = handler;
