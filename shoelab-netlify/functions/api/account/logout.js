import { json, preflight, setCookie } from '../../_shared/util.js';

export async function onRequestOptions() {
  return preflight();
}

export async function onRequestPost() {
  return json({ ok: true }, 200, { 'Set-Cookie': setCookie('shoelab_session', '', 0) });
}

export async function onRequest() {
  return json({ ok: true }, 200, { 'Set-Cookie': setCookie('shoelab_session', '', 0) });
}
