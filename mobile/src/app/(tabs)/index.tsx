import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { API } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import studio from '../../i18n/studio.json';
import { Body, Button, Eyebrow, H1, Row, Screen, tap } from '../../components/ui';
import { Appear, PressableScale } from '../../components/motion';
import { Showcase } from '../../components/Showcase';
import { MenuButton } from '../../components/Menu';
import { HoldCard } from '../../components/HoldCard';
import { Icon } from '../../components/Icon';
import { C, CONTENT_MAX, F, MAX_SCALE, NUM, R, S } from '../../theme';

const MARK = require('../../../assets/mark.png');

// Home: the studio. The pairs turning like on the website, booking a cleaning,
// quick ways in, and the three treatments. Listings live in the Vault tab;
// contact, the Impressum and the rest are in the menu (☰).
export default function Home() {
  const { me, config, reload } = useAuth();
  const { t, lang, money } = useI18n();
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);
  const hold = !!config?.paused?.hold;
  const refresh = async () => { setRefreshing(true); await reload(); setRefreshing(false); };
  const svcText = (studio.text as Record<string, Record<string, string>>)[lang] || studio.text.en;
  const inner = Math.min(width, CONTENT_MAX) - S.lg * 2;
  const book = () => { tap(); WebBrowser.openBrowserAsync(API + '/booking.html'); };
  const go = (path: '/(tabs)/vault' | '/(tabs)/sell' | '/(tabs)/legit') => { tap('select'); router.push(path); };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} pad={false}>
      <View style={st.top}>
        <Row gap={10}>
          <Image source={MARK} style={st.logo} accessibilityIgnoresInvertColors />
          <Text style={st.word} maxFontSizeMultiplier={1.1} accessibilityRole="header">SHOE<Text style={{ color: C.red }}>LAB</Text></Text>
        </Row>
        <Row gap={10}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('meNotifications')} onPress={() => { tap('select'); router.push('/(tabs)/me'); }} hitSlop={10} style={st.round}>
            <Icon name="bell" size={19} color={C.text} />
          </Pressable>
          <MenuButton />
        </Row>
      </View>

      {hold ? <Appear style={[st.pad, { marginBottom: S.lg }]}><HoldCard compact /></Appear> : null}

      {/* the pairs, turning like on the website */}
      <Appear i={1}><Showcase size={Math.min(inner, 520)} /></Appear>

      {/* book a cleaning */}
      <Appear i={2} style={[st.pad, { marginTop: S.xxl }]}>
        <View style={st.book}>
          <LinearGradient colors={['#220909', '#121212']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Eyebrow color={C.redText}>{me ? t('homeHi', { name: me.name.split(' ')[0] }) : t('homeWelcome')}</Eyebrow>
          <H1 style={{ marginTop: 8, fontSize: 40, lineHeight: 42 }}>{t('homeBook')}</H1>
          <Body muted style={{ marginTop: 4 }}>{t('homeBookP')}</Body>
          {!hold ? <Button title={t('homeBookBtn')} icon="calendar" style={{ marginTop: S.lg }} onPress={book} /> : null}
        </View>
      </Appear>

      {/* quick ways in */}
      <Appear i={3} style={[st.pad, st.quick]}>
        {([['vault', 'heroBrowse', C.goldHi, '/(tabs)/vault'], ['tag', 'heroSell', C.redText, '/(tabs)/sell'], ['shield', 'navLegit', C.goldHi, '/(tabs)/legit']] as const).map(([icon, label, color, path]) => (
          <PressableScale key={label} onPress={() => go(path)} style={st.qa} accessibilityRole="button" accessibilityLabel={t(label)}>
            <View style={[st.qaIco, { backgroundColor: color === C.redText ? C.redSoft : C.goldSoft }]}><Icon name={icon} size={20} color={color} /></View>
            <Text style={st.qaText} numberOfLines={2} maxFontSizeMultiplier={1.3}>{t(label)}</Text>
          </PressableScale>
        ))}
      </Appear>

      {/* the three treatments, as a short price list */}
      <Appear i={4} style={[st.pad, { marginTop: S.xxl }]}>
        <Eyebrow>{t('homeServices')}</Eyebrow>
        <View style={st.list}>
          {studio.services.map((sv, i) => (
            <PressableScale key={sv.id} onPress={hold ? undefined : book} disabled={hold} scaleTo={0.985}
              style={[st.svc, i > 0 && st.svcLine]} accessibilityRole="button" accessibilityLabel={sv.name + ', ' + money(sv.once * 100)}>
              <Text style={st.svcNo} maxFontSizeMultiplier={1.2}>{'0' + (i + 1)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.svcName} maxFontSizeMultiplier={MAX_SCALE.text}>{sv.name}</Text>
                <Text style={st.svcTag} maxFontSizeMultiplier={MAX_SCALE.text}>{svcText['svcTag' + i]}</Text>
              </View>
              <Text style={st.price} maxFontSizeMultiplier={1.2}>{money(sv.once * 100)}</Text>
              {!hold ? <Icon name="chevron" size={15} color={C.muted} /> : null}
            </PressableScale>
          ))}
        </View>
      </Appear>

      <View style={st.foot}>
        <Text style={st.footWord}>SHOE<Text style={{ color: C.red }}>LAB</Text></Text>
        <Text style={st.footText}>{t('homeLead')}</Text>
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.lg, paddingTop: 6, paddingBottom: S.md },
  logo: { width: 34, height: 34, borderRadius: 8 },
  word: { fontFamily: F.display, fontSize: 26, color: C.text, letterSpacing: 2 },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  pad: { paddingHorizontal: S.lg },
  book: { borderRadius: R.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,80,80,0.16)', padding: S.xl },
  quick: { flexDirection: 'row', gap: 10, marginTop: S.md },
  qa: { flex: 1, backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center', gap: 9 },
  qaIco: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  qaText: { fontFamily: F.semibold, fontSize: 12.5, lineHeight: 16, color: C.text, textAlign: 'center' },
  list: { marginTop: S.md, backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  svc: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: S.lg },
  svcLine: { borderTopWidth: 1, borderTopColor: C.border },
  svcNo: { fontFamily: F.display, fontSize: 20, color: C.gold, letterSpacing: 1 },
  svcName: { fontFamily: F.semibold, fontSize: 15, lineHeight: 20, color: C.text },
  svcTag: { fontFamily: F.medium, fontSize: 12, color: C.redText, marginTop: 2, letterSpacing: 0.3 },
  price: { fontFamily: F.display, fontSize: 26, color: C.text, letterSpacing: 0.5, ...NUM },
  foot: { alignItems: 'center', marginTop: 44, paddingHorizontal: S.xl, gap: 4 },
  footWord: { fontFamily: F.display, fontSize: 18, color: '#4a4a4a', letterSpacing: 3 },
  footText: { fontFamily: F.regular, fontSize: 12, lineHeight: 17, color: '#5c5c5c', textAlign: 'center', maxWidth: 300 },
});
