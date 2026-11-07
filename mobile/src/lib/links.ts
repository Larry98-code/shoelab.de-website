// Website addresses (in emails, push notifications, shared links) → app screens.
//   /vault-item.html?id=12        → /listing/12
//   /vault-me.html#order-34       → /order/34
//   /vault-me.html, /vault.html…  → the matching tab
export function appPath(url: string): string | null {
  let u: URL;
  try { u = new URL(url, 'https://shoelabonline.de'); } catch { return null; }
  const p = u.pathname.replace(/\/+$/, '') || '/';
  if (/\/vault-item(\.html)?$/.test(p)) { const id = u.searchParams.get('id'); return id ? '/listing/' + encodeURIComponent(id) : '/vault'; }
  if (/\/vault-me(\.html)?$/.test(p)) {
    const m = /order-(\d+)/.exec(u.hash) || /^(\d+)$/.exec(u.searchParams.get('paid') || '');
    return m ? '/order/' + m[1] : '/me';
  }
  if (/\/vault(\.html)?$/.test(p)) return '/vault';
  if (/\/vault-sell(\.html)?$/.test(p)) return '/sell';
  if (/\/legit(\.html)?$/.test(p)) return '/legit';
  if (p === '/' || /\/index(\.html)?$/.test(p)) return '/';
  // already an app route (shoelab://listing/12)
  if (/^\/(listing|order)\/\d+$/.test(p) || /^\/(vault|sell|legit|me|auth|settings)$/.test(p)) return p;
  return null;
}
