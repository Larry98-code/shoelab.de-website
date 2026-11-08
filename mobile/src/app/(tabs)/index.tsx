import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { API } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import studio from '../../i18n/studio.json';
import { Body, Button, Eyebrow, H1, Row, Screen, tap } from '../../components/ui';
import { Appear, PressableScale } from '../../components/motion';
import { Floating, Glow, SNEAKERS } from '../../components/Stage';
import { HoldCard } from '../../components/HoldCard';
import { Icon } from '../../components/Icon';
import { C, F, MAX_SCALE, NUM, R, S, SHADOW } from '../../theme';

const WHATSAPP = 'https://wa.me/491772258878';
const EMAIL = 'mailto:Shoelab.de@gmail.com';
const MARK = require('../../../assets/mark.png');

// Home: the studio. Book a cleaning, the three treatments, and quick ways
// into the Vault, selling and the Legit Check. Listings live in the Vault tab.
export default function Home() {
  const { me, config, reload } = useAuth();
  const { t, lang, money } = useI18n();
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);
  const hold = !!config?.paused?.hold;
  const refresh = async () => { setRefreshing(true); await reload(); setRefreshing(false); };
  const svcText = (studio.text as Record<string, Record<string, string>>)[lang] || studio.text.en;
  const W = Math.min(width, 640) - S.lg * 2;
  const book = () => { tap(); WebBrowser.openBrowserAsync(API + '/booking.html'); };
  const go = (path: '/(tabs)/vault' | '/(tabs)/sell' | '/(tabs)/legit') => { tap('select'); router.push(path); };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} pad={false}>
      <View style={st.top}>
        <Row gap={10}>
          <Image source={MARK} style={st.logo} accessibilityIgnoresInvertColors />
          <Text style={st.word} maxFontSizeMultiplier={1.1} accessibilityRole="header">SHOE<Text style={{ color: C.red }}>LAB</Text></Text>
        </Row>
        <Pressable accessibilityRole="button" accessibilityLabel={t('meNotifications')} onPress={() => { tap('select'); router.push('/(tabs)/me'); }} hitSlop={10} style={st.bell}>
          <Icon name="bell" size={20} color={C.text} />
        </Pressable>
      </View>

      {hold ? <View style={[st.pad, { marginBottom: S.xl }]}><HoldCard /></View> : null}

      {/* Hero: the studio's main service, a pair floating in ShoeLab red light */}
      <Appear style={st.pad}>
        <View style={[st.hero, SHADOW.card]}>
          <LinearGradient colors={['#2a0909', '#140808', '#0d0d0d']} locations={[0, 0.45, 1]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
          <Glow size={W * 0.95} color={C.red} opacity={0.5} style={{ right: -W * 0.28, top: -W * 0.3 }} />
          <Floating style={{ position: 'absolute', right: -W * 0.08, top: 4, width: W * 0.78, height: W * 0.5 }}>
            <Image source={SNEAKERS.jordan1} style={{ width: '100%', height: '100%' }} contentFit="contain" accessibilityIgnoresInvertColors />
          </Floating>
          <View style={{ paddingTop: W * 0.42 }}>
            <Eyebrow color={C.redText}>{me ? t('homeHi', { name: me.name.split(' ')[0] }) : t('homeWelcome')}</Eyebrow>
            <H1 style={{ marginTop: 8 }}>{t('homeBook')}</H1>
            <Body muted style={{ marginTop: 4 }}>{t('homeBookP')}</Body>
            {!hold ? <Button title={t('homeBookBtn')} icon="calendar" style={{ marginTop: S.lg }} onPress={book} /> : null}
          </View>
        </View>
      </Appear>

      {/* Quick ways in */}
      <Appear i={1} style={[st.pad, st.quick]}>
        {([['vault', 'heroBrowse', C.goldHi, '/(tabs)/vault'], ['tag', 'heroSell', C.redText, '/(tabs)/sell'], ['shield', 'navLegit', C.goldHi, '/(tabs)/legit']] as const).map(([icon, label, color, path]) => (
          <PressableScale key={label} onPress={() => go(path)} style={st.qa} accessibilityRole="button" accessibilityLabel={t(label)}>
            <View style={[st.qaIco, { backgroundColor: color === C.redText ? C.redSoft : C.goldSoft }]}><Icon name={icon} size={20} color={color} /></View>
            <Text style={st.qaText} numberOfLines={2} maxFontSizeMultiplier={1.3}>{t(label)}</Text>
          </PressableScale>
        ))}
      </Appear>

      {/* The three treatments, as a short price list */}
      <Appear i={2} style={[st.pad, { marginTop: S.xxl }]}>
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

      {/* Talk to the studio */}
      <Appear i={3} style={[st.pad, { marginTop: S.xxl }]}>
        <Eyebrow>{t('homeContact')}</Eyebrow>
        <Row style={{ marginTop: S.md }} gap={S.md}>
          <Button title={t('homeWhatsApp')} kind="ghost" icon="chat" small style={{ flex: 1 }} onPress={() => Linking.openURL(WHATSAPP)} />
          <Button title={t('homeEmail')} kind="ghost" icon="mail" small style={{ flex: 1 }} onPress={() => Linking.openURL(EMAIL)} />
        </Row>
      </Appear>

      <View style={st.foot}>
        <Image source={MARK} style={{ width: 28, height: 28, borderRadius: 7 }} />
        <Text style={st.footWord}>SHOE<Text style={{ color: C.red }}>LAB</Text></Text>
        <Text style={st.footText}>{t('homeLead')}</Text>
        <Text style={st.footVer}>{t('meVersion', { v: Constants.expoConfig?.version || '1.0.0' })}</Text>
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.lg, paddingTop: 6, paddingBottom: S.lg },
  logo: { width: 34, height: 34, borderRadius: 8 },
  word: { fontFamily: F.display, fontSize: 26, color: C.text, letterSpacing: 2 },
  bell: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  pad: { paddingHorizontal: S.lg },
  hero: { borderRadius: R.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,80,80,0.16)', padding: S.xl, backgroundColor: '#100909' },
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
  foot: { alignItems: 'center', marginTop: 48, paddingHorizontal: S.xl, gap: 6 },
  footWord: { fontFamily: F.display, fontSize: 20, color: C.text, letterSpacing: 2, marginTop: 4 },
  footText: { fontFamily: F.regular, fontSize: 12.5, lineHeight: 18, color: C.muted, textAlign: 'center', maxWidth: 300 },
  footVer: { fontFamily: F.regular, fontSize: 11, color: '#5c5c5c', marginTop: 2 },
});
