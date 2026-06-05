import { json, preflight, currentUser } from '../../_shared/util.js';

export async function onRequestOptions() {
  return preflight();
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await currentUser(request, env);
  if (!user) return json({ user: null }, 200);

  // Try to return the full profile; fall back if columns aren't migrated yet.
  let full = { id: user.id, name: user.name, email: user.email };
  try {
    const row = await env.DB.prepare(
      'SELECT id, name, email, phone, address, city, postal, country FROM users WHERE id = ?'
    ).bind(user.id).first();
    if (row) full = row;
  } catch (e) { /* pre-migration: minimal profile */ }

  return json({ user: full }, 200);
}
