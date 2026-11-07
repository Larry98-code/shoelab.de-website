// The ShoeLab server: the same API the website uses. The app signs in with a
// token ("Authorization: Bearer …") instead of a cookie.
export const API = (process.env.EXPO_PUBLIC_API_URL ?? 'https://shoelabonline.de').replace(/\/$/, '');

let token: string | null = null;
let lang = 'en';
export function setToken(t: string | null) { token = t; }
export function setApiLang(l: string) { lang = l; }

export type Res<T = any> = { ok: boolean; status: number; data: T };

// Never throws: resolves to { ok, status, data } (status 0 when offline).
export async function api<T = any>(path: string, opts: { body?: unknown; method?: string } = {}): Promise<Res<T>> {
  const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': lang };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const r = await fetch(API + path, {
      method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'), headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    let data: any = {};
    try { data = await r.json(); } catch { data = {}; }
    return { ok: r.ok, status: r.status, data: data || {} };
  } catch {
    return { ok: false, status: 0, data: { code: 'network', error: 'Network error' } as any };
  }
}
export const market = <T = any>(route: string, opts?: { body?: unknown; method?: string }) => api<T>('/api/market/' + route, opts);

// photos come as "/api/market/photo?id=…"
export function abs(u?: string | null): string | undefined {
  if (!u) return undefined;
  return /^https?:/.test(u) ? u : API + u;
}
