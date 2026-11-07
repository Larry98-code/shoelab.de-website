import { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { abs } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { left, type ListingCard as Card } from '../lib/types';
import { C, F, R } from '../theme';
import { Icon } from './Icon';
import { tap } from './ui';

export function TierBadge({ tier, small }: { tier: 'photo' | 'lab'; small?: boolean }) {
  const { t } = useI18n();
  const lab = tier === 'lab';
  return (
    <View style={[b.tier, lab ? b.tierLab : b.tierPhoto, small && { paddingHorizontal: 6, paddingVertical: 3 }]}>
      <Icon name={lab ? 'shield' : 'camera'} size={small ? 10 : 12} color={lab ? '#111' : '#0b0f14'} stroke={2} />
      <Text style={[b.tierText, small && { fontSize: 8.5 }]}>{t(lab ? 'tierLab' : 'tierPhoto')}</Text>
    </View>
  );
}

export function Countdown({ endsAt, style }: { endsAt: string | null; style?: object }) {
  const [, force] = useState(0);
  useEffect(() => { const i = setInterval(() => force((x) => x + 1), 1000); return () => clearInterval(i); }, []);
  const l = left(endsAt);
  return (
    <View style={[b.cd, l.soon && { borderColor: 'rgba(255,77,77,0.5)' }, style]}>
      <Icon name="clock" size={11} color={l.soon ? '#ff9a9a' : C.muted2} />
      <Text style={[b.cdText, l.soon && { color: '#ff9a9a' }]}>{l.text}</Text>
    </View>
  );
}

export const ListingCard = memo(function ListingCard({ it, width }: { it: Card; width: number }) {
  const { t, money, tn } = useI18n();
  const auction = it.format === 'auction';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={it.title} onPress={() => { tap('select'); router.push('/listing/' + it.id); }}
      style={({ pressed }) => [{ width }, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}>
      <View style={[b.img, { height: width * 0.86 }]}>
        {it.photo ? <Image source={{ uri: abs(it.photo) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} /> :
          <View style={[StyleSheet.absoluteFill, b.noimg]}><Icon name="image" size={28} color={C.muted} /></View>}
        <View style={b.badges}><TierBadge tier={it.tier} small />{it.featured ? <View style={b.feat}><Text style={b.featText}>{t('featured')}</Text></View> : null}</View>
        {auction && it.endsAt && it.status === 'live' ? <Countdown endsAt={it.endsAt} style={b.cdPos} /> : null}
      </View>
      <Text numberOfLines={2} style={b.title}>{it.title}</Text>
      <Text style={b.meta}>EU {it.size} · {t('cond_' + it.cond)}</Text>
      <View style={b.priceRow}>
        <Text style={b.price}>{money(it.price)}</Text>
        <Text style={b.sub}>{auction ? tn('bids', it.bids) : it.acceptOffers ? t('orBestOffer') : t('buyNow')}</Text>
      </View>
    </Pressable>
  );
});

const b = StyleSheet.create({
  img: { borderRadius: R.lg, overflow: 'hidden', backgroundColor: C.card2, borderWidth: 1, borderColor: C.border },
  noimg: { alignItems: 'center', justifyContent: 'center' },
  badges: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  tierLab: { backgroundColor: C.goldHi }, tierPhoto: { backgroundColor: '#dfe6ef' },
  tierText: { fontFamily: F.bold, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: '#111' },
  feat: { backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: C.goldLine },
  featText: { fontFamily: F.bold, fontSize: 9, color: C.goldHi, letterSpacing: 0.8, textTransform: 'uppercase' },
  cd: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.border },
  cdPos: { position: 'absolute', bottom: 8, left: 8 },
  cdText: { fontFamily: F.semibold, fontSize: 11, color: '#eee', fontVariant: ['tabular-nums'] },
  title: { fontFamily: F.semibold, fontSize: 14, lineHeight: 19, color: C.text, marginTop: 9 },
  meta: { fontFamily: F.regular, fontSize: 12, color: C.muted, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 },
  price: { fontFamily: F.display, fontSize: 24, color: C.text, letterSpacing: 0.5 },
  sub: { fontFamily: F.medium, fontSize: 11, color: C.muted2 },
});
