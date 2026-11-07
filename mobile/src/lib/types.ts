// What the server sends (the same shapes the website uses).
export type ListingCard = {
  id: number; title: string; brand: string; model: string; size: string; cond: string; format: 'auction' | 'fixed'; tier: 'photo' | 'lab';
  price: number; buyNow: number | null; bids: number; endsAt: string | null; status: string; acceptOffers: boolean;
  photo: string | null; watchers: number; createdAt: string; liveAt: string | null; featured: boolean; featuredUntil: string | null;
};
export type Listing = ListingCard & {
  description: string; startPrice: number | null; photos: { url: string; kind: string }[];
  seller: { name: string; since: string; sales: number; verified: boolean; rating?: { pos: number; neu: number; neg: number; score: number | null }; feedback?: { rating: number; comment: string; who: string; at: string }[] };
  bidHistory: { who: string; amount: number; auto: boolean; at: string }[];
  increment: number | null; minNext: number | null; binAvailable: boolean; reviewNote: string | null;
  fees: { auth: number; shipping: number }; hidden?: { own: boolean; reason: string | null } | null;
  viewer: null | { role?: string; watching?: boolean; highBidder?: boolean; myMax?: number; specialist?: boolean; offer?: any; order?: { id: number } };
};
export function left(iso: string | null, now = Date.now()) {
  if (!iso) return { over: true, ms: 0, text: '' };
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return { over: true, ms: 0, text: '0s' };
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  const text = d ? d + 'd ' + h + 'h' : h ? h + 'h ' + m + 'm' : m + 'm ' + (s % 60) + 's';
  return { over: false, ms, text, soon: ms < 3600000 };
}
