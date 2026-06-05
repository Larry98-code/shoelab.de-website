import { json, preflight, clean, currentUser } from '../../_shared/util.js';

export async function onRequestOptions() { return preflight(); }

// Update profile (name, phone, address). Requires login.
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: 'Database not configured' }, 500);

  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Not signed in' }, 401);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Invalid JSON' }, 400); }

  const name = clean(body.name, 80) || user.name;
  const phone = clean(body.phone, 40);
  const address = clean(body.address, 160);
  const city = clean(body.city, 80);
  const postal = clean(body.postal, 20);
  const country = clean(body.country, 60);

  try {
    await env.DB.prepare(
      'UPDATE users SET name=?, phone=?, address=?, city=?, postal=?, country=? WHERE id=?'
    ).bind(name, phone, address, city, postal, country, user.id).run();
  } catch (e) {
    // columns missing → migration not yet applied
    return json({ error: 'Profile fields not migrated yet. Run migrate-accounts.sql in the D1 console.' }, 500);
  }

  return json({ ok: true, user: { id: user.id, name, email: user.email, phone, address, city, postal, country } }, 200);
}

export async function onRequest() { return json({ error: 'Method not allowed' }, 405); }
