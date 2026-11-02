// Retired: reviews now live in the satisfaction survey at /reviews.html,
// served by /api/market/reviews (see functions/_shared/reviews.js), where
// every review is checked before it is published. This address still lists
// the published ones for anything that used it, and refuses new ones.
import { json, preflight } from '../_shared/util.js';
import { ensureSchema } from '../_shared/vault.js';

export async function onRequestOptions() { return preflight(); }

export async function onRequestGet(context) {
  const { env } = context;
  if (!env.DB) return json({ reviews: [] }, 200);
  await ensureSchema(env);
  const rows = await env.DB.prepare(
    "SELECT name, rating, body, published_at AS created_at FROM fb_reviews WHERE kind = 'review' AND status = 'published' AND publish = 1 ORDER BY published_at DESC LIMIT 50"
  ).all();
  return json({ reviews: (rows && rows.results) || [] }, 200);
}

export async function onRequestPost() {
  return json({ error: 'Reviews are written at /reviews.html', moved: '/reviews.html#write' }, 410);
}

export async function onRequest() {
  return json({ error: 'Method not allowed' }, 405);
}
