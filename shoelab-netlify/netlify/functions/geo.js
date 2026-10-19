// ShoeLab — visitor country lookup (Netlify mirror of functions/api/geo.js)
// Netlify Serverless Function v1
//
// Cloudflare Pages is the primary host; this keeps /api/geo answering if the
// site is served from Netlify instead. Same contract: { "country": "DE" }
// or { "country": null }. Nothing is logged or stored.

const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    // Never cache: a cached country would be handed to the wrong visitors.
    'Cache-Control': 'no-store, max-age=0',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const h = event.headers || {};
  let country = '';

  // Netlify v1 functions receive geo as a base64-encoded JSON blob in x-nf-geo.
  try {
    const raw = h['x-nf-geo'] || h['X-Nf-Geo'];
    if (raw) {
      const decoded = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
      // country is an object: { code, name }
      country = (decoded && decoded.country && decoded.country.code) || '';
    }
  } catch (e) {
    country = '';
  }

  // Some Netlify edges also forward the plain header; and if the site sits
  // behind Cloudflare DNS, CF-IPCountry may still be present.
  if (!country) {
    country = h['x-country'] || h['cf-ipcountry'] || h['CF-IPCountry'] || '';
  }

  country = String(country).toUpperCase();
  if (!/^[A-Z]{2}$/.test(country) || country === 'XX' || country === 'T1') {
    country = '';
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ country: country || null }),
  };
};

exports.handler = handler;
