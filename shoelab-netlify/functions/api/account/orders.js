import { json, preflight, currentUser } from '../../_shared/util.js';

export async function onRequestOptions() { return preflight(); }

// List the signed-in user's bookings/orders (by account id or matching email).
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return json({ orders: [] }, 200);

  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Not signed in' }, 401);

  const rows = await env.DB.prepare(
    `SELECT id, type, service, plan, amount, date, time_slot, status, created_at
     FROM bookings WHERE user_id = ? OR email = ? ORDER BY id DESC LIMIT 100`
  ).bind(user.id, user.email).all();

  return json({ orders: (rows && rows.results) || [] }, 200);
}

export async function onRequest() { return json({ error: 'Method not allowed' }, 405); }
