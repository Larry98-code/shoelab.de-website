// ShoeLab's look, the same as the website: black, ShoeLab red for actions,
// gold for anything verified, Bebas Neue headlines, Inter for text.
export const C = {
  black: '#080808', bg: '#0b0b0b', card: '#151515', card2: '#1c1c1c', card3: '#262626',
  text: '#f5f5f5', muted: '#8c8c8c', muted2: '#a8a8a8',
  border: 'rgba(255,255,255,0.08)', borderHi: 'rgba(255,255,255,0.16)',
  red: '#CC1111', redHi: '#FF2020', redText: '#ff5c5c', redSoft: 'rgba(204,17,17,0.14)', redLine: 'rgba(255,60,60,0.38)',
  gold: '#d4af37', goldHi: '#f3d77a', goldLo: '#9c7a1e', goldSoft: 'rgba(212,175,55,0.12)', goldLine: 'rgba(212,175,55,0.32)',
  ok: '#22c55e', okSoft: 'rgba(34,197,94,0.12)', warn: '#f59e0b', warnSoft: 'rgba(245,158,11,0.12)',
  bad: '#ff4d4d', badSoft: 'rgba(255,77,77,0.12)', amber: '#e8b84a', amberText: '#f1dfae',
};
export const GOLD_GRAD = ['#f6e27a', '#d4af37', '#a8841f', '#f3d77a'] as const;
export const F = {
  display: 'BebasNeue_400Regular',
  regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold',
};
export const R = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 };
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
// On tablets the content stays a comfortable column in the middle.
export const CONTENT_MAX = 720;
// Numbers that change (prices, countdowns) keep their width so nothing jumps.
export const NUM = { fontVariant: ['tabular-nums' as const] };
// Big display type stays legible but never breaks the layout with huge system font sizes.
export const MAX_SCALE = { display: 1.25, text: 1.6 };
export const SHADOW = {
  card: { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  red: { shadowColor: '#CC1111', shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
};
