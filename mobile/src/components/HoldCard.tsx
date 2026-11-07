import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../lib/i18n';
import { C, F, R } from '../theme';
import { Body, H2 } from './ui';

// ShoeLab on hold (the server says so in the config): the same message as the website.
export function HoldCard() {
  const { t } = useI18n();
  return (
    <View style={s.card} accessibilityRole="summary">
      <View style={s.bar} />
      <View style={s.badge}><View style={s.dot} /><Text style={s.badgeText}>{t('holdBadge')}</Text></View>
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
  sign: { fontFamily: F.regular, fontStyle: 'italic', color: '#e8c46a', fontSize: 13, marginTop: 10 },
});
