// GET /api/newsletter/confirm?t=… — step 2 of double opt-in.
// Verifies the signed link and adds the address to the Resend "Newsletter"
// segment, subscribed to the "ShoeLab News" topic.
import {
  verifySession, sessionSecret, resendApi, NEWSLETTER_SEGMENT_ID, NEWSLETTER_TOPIC_ID,
} from '../../_shared/util.js';

function go(path) {
  return new Response(null, { status: 303, headers: { Location: path, 'Cache-Control': 'no-store' } });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const t = new URL(request.url).searchParams.get('t') || '';
  const p = await verifySession(t, sessionSecret(env));
  if (!p || p.k !== 'nl' || !p.e) return go('/newsletter.html?status=invalid');

  const email = p.e;
  const topics = [{ id: NEWSLETTER_TOPIC_ID, subscription: 'opt_in' }];
  const consentNote = { key: 'consent', value: 'double-opt-in ' + new Date().toISOString() };

  let r = await resendApi(env, 'POST', '/contacts', {
    email,
    unsubscribed: false,
    segments: [{ id: NEWSLETTER_SEGMENT_ID }],
    topics,
  });

  // Already a contact (e.g. resubscribing): re-enable and add to the list.
  if (!r.ok && r.status !== 0) {
    const enc = encodeURIComponent(email);
    const u = await resendApi(env, 'PATCH', '/contacts/' + enc, { unsubscribed: false });
    await resendApi(env, 'POST', '/contacts/' + enc + '/segments/' + NEWSLETTER_SEGMENT_ID);
    await resendApi(env, 'PATCH', '/contacts/' + enc + '/topics', { topics });
    r = u;
  }

  if (!r.ok) {
    console.log('newsletter confirm failed', r.status, JSON.stringify(r.data), consentNote.value);
    return go('/newsletter.html?status=error');
  }
  console.log('newsletter confirmed', consentNote.value);
  return go('/newsletter.html?status=ok');
}

export async function onRequest() {
  return new Response('Method not allowed', { status: 405 });
}
