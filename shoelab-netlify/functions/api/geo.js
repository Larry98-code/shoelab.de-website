// GET /api/geo — the visitor's country, and nothing else.
//
// Used by js/sl-geo.js to pick a language for someone whose browser language
// we don't speak. The country is read from the CDN edge, which already knows
// it: no third-party lookup service ever sees a ShoeLab visitor's IP, and we
// neither log nor store the address. Only the two-letter country code leaves
// this function, which keeps the feature inside "essential/functional" under
// GDPR rather than making it a tracking question.
import { json, preflight } from '../_shared/util.js';

export async function onRequestOptions() {
  return preflight();
}

export async function onRequestGet(context) {
  const { request } = context;

  // CF-IPCountry is set on every request Cloudflare proxies and survives
  // local dev better than request.cf, which is undefined under
  // `wrangler pages dev`. Fall back to request.cf.country anyway.
  const raw =
    request.headers.get('CF-IPCountry') ||
    (request.cf && request.cf.country) ||
    '';

  let country = String(raw).toUpperCase();

  // XX = Cloudflare could not determine it. T1 = Tor exit node.
  // Both mean "no usable signal", so say so rather than guessing.
  if (!/^[A-Z]{2}$/.test(country) || country === 'XX' || country === 'T1') {
    country = '';
  }

  return json(
    { country: country || null },
    200,
    // Must never be cached: a cached DE response served to a visitor in Spain
    // would quietly switch the wrong people into German.
    { 'Cache-Control': 'no-store, max-age=0', 'Vary': 'CF-IPCountry' }
  );
}

export async function onRequest(context) {
  const m = context.request.method;
  if (m === 'OPTIONS') return preflight();
  if (m === 'GET' || m === 'HEAD') return onRequestGet(context);
  return json({ error: 'Method not allowed' }, 405);
}
