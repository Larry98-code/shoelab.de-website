import { json, preflight, currentUser, stripeApi } from '../../_shared/util.js';

export async function onRequestOptions() { return preflight(); }

// Create a Stripe Customer Portal session for the signed-in user.
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: 'Payments portal is not configured yet.' }, 503);
  }

  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Not signed in' }, 401);

  let customerId = null;
  try {
    const row = await env.DB.prepare('SELECT stripe_customer_id FROM users WHERE id=?')
      .bind(user.id).first();
    customerId = row && row.stripe_customer_id;
  } catch (e) { /* column not migrated */ }

  if (!customerId) {
    return json({ error: 'No payment history yet. Complete an order first.' }, 404);
  }

  const origin = new URL(request.url).origin;
  const session = await stripeApi(env, 'billing_portal/sessions', {
    customer: customerId,
    return_url: origin + '/account.html',
  });

  if (!session || !session.url) {
    return json({ error: 'Could not open the payments portal.' }, 502);
  }
  return json({ url: session.url }, 200);
}

export async function onRequest() { return json({ error: 'Method not allowed' }, 405); }
