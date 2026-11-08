import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useI18n } from '../lib/i18n';
import { C, F, R } from '../theme';
import { Icon } from './Icon';
import { Body, H2, tap } from './ui';

// ShoeLab on hold (the server says so in the config): the same message as the website.
// `compact`: a slim banner that opens to the full message when tapped.
export function HoldCard({ compact }: { compact?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(!compact);
  const badge = <View style={s.badge}><View style={s.dot} /><Text style={s.badgeText} maxFontSizeMultiplier={1.3}>{t('holdBadge')}</Text></View>;
  if (compact) {
    return (
      <Animated.View layout={LinearTransition.duration(260)} style={[s.card, { padding: 14, paddingLeft: 17 }]}>
        <View style={s.bar} />
        <Pressable onPress={() => { tap('select'); setOpen(!open); }} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={t('holdBadge') + ' — ' + t('holdTitle')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            {badge}
            <Text style={s.title} maxFontSizeMultiplier={1.3}>{t('holdTitle')}</Text>
          </View>
          <View style={[s.chev, open && { transform: [{ rotate: '90deg' }] }]}><Icon name="chevron" size={15} color={C.amberText} /></View>
        </Pressable>
        {open ? (
          <Animated.View entering={FadeIn.duration(300)}>
            <Body muted small style={{ marginTop: 10 }}>{t('holdText')}</Body>
            <Text style={s.sign}>{t('holdSign')}</Text>
          </Animated.View>
        ) : null}
      </Animated.View>
    );
  }
  return (
    <View style={s.card} accessibilityRole="summary">
      <View style={s.bar} />
      {badge}
      <H2 style={{ marginTop: 12 }}>{t('holdTitle')}</H2>
      <Body muted style={{ marginTop: 6 }}>{t('holdText')}</Body>
      <Text style={s.sign}>{t('holdSign')}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  card: { borderRadius: R.lg, borderWidth: 1, borderColor: C.goldLine, backgroundColor: '#14110a', padding: 20, paddingLeft: 22, overflow: 'hidden' },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: C.gold },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: 'rgba(232,184,74,0.1)', borderWidth: 1, borderColor: 'rgba(232,184,74,0.3)' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.amber },
  badgeText: { fontFamily: F.semibold, fontSize: 10, letterSpacing: 2.4, textTransform: 'uppercase', color: C.amberText },
  title: { fontFamily: F.display, fontSize: 22, letterSpacing: 0.8, color: C.text, marginTop: 8 },
  chev: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(232,184,74,0.1)' },
  sign: { fontFamily: F.regular, fontStyle: 'italic', color: '#e8c46a', fontSize: 13, marginTop: 10 },
});
