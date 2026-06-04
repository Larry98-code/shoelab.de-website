import { json, preflight, currentUser } from '../../_shared/util.js';

export async function onRequestOptions() {
  return preflight();
}

export async function onRequestGet(context) {
  const user = await currentUser(context.request, context.env);
  if (!user) return json({ user: null }, 200);
  return json({ user: { id: user.id, name: user.name, email: user.email } }, 200);
}
