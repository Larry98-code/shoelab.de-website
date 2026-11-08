import { useCallback, useEffect, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { API, market } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import type { ListingCard as Card } from '../../lib/types';
import studio from '../../i18n/studio.json';
import { Body, Button, Eyebrow, H1, H2, Row, Screen, tap } from '../../components/ui';
import { Appear, PressableScale, SkeletonCard } from '../../components/motion';
import { HoldCard } from '../../components/HoldCard';
import { ListingCard } from '../../components/ListingCard';
import { Icon } from '../../components/Icon';
import { C, F, MAX_SCALE, NUM, R, S, SHADOW } from '../../theme';

const WHATSAPP = 'https://wa.me/491772258878';
const EMAIL = 'mailto:Shoelab.de@gmail.com';
const HERO = require('../../../assets/img/hero-jordan1.webp');
const PROMO_LEGIT = require('../../../assets/img/promo-1080.webp');
const PROMO_SELL = require('../../../assets/img/promo-9060.webp');
const MARK = require('../../../assets/mark.png');

// A soft light behind a sneaker.
function Glow({ size, color, opacity = 0.55, style }: { size: number; color: string; opacity?: number; style?: object }) {
  return (
    <Svg width={size} height={size} style={[{ position: 'absolute' }, style]} pointerEvents="none">
      <Defs>
        <RadialGradient id="g" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#g)" />
    </Svg>
  );
}

// The hero sneaker floats gently.
function Floating({ children, style }: { children: React.ReactNode; style?: object }) {
  const y = useSharedValue(0);
  useEffect(() => { y.set(withRepeat(withTiming(-7, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true)); }, [y]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { rotate: '-9deg' }] }));
  return <Animated.View style={[style, a]} pointerEvents="none">{children}</Animated.View>;
}

export default function Home() {
  const { me, config, reload } = useAuth();
  const { t, lang, money } = useI18n();
  const { width } = useWindowDimensions();
  const [fresh, setFresh] = useState<Card[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const hold = !!config?.paused?.hold;
  const load = useCallback(async () => {
    const r = await market<{ items: Card[] }>('listings?sort=new&per=8');
    if (r.ok) setFresh(r.data.items || []);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const refresh = async () => { setRefreshing(true); await Promise.all([load(), reload()]); setRefreshing(false); };
  const svcText = (studio.text as Record<string, Record<string, string>>)[lang] || studio.text.en;
  const cardW = Math.min(170, width * 0.42);
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

      {/* Hero: the studio's main service, with a pair floating in ShoeLab red light */}
      <Appear style={st.pad}>
        <View style={[st.hero, SHADOW.card]}>
          <LinearGradient colors={['#2a0909', '#140808', '#0d0d0d']} locations={[0, 0.45, 1]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
          <Glow size={W * 0.95} color={C.red} opacity={0.5} style={{ right: -W * 0.28, top: -W * 0.3 }} />
          <Floating style={{ position: 'absolute', right: -W * 0.08, top: 4, width: W * 0.78, height: W * 0.5 }}>
            <Image source={HERO} style={{ width: '100%', height: '100%' }} contentFit="contain" accessibilityIgnoresInvertColors />
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

      {/* The three treatments */}
      <View style={[st.pad, { marginTop: S.xxl }]}>
        <Appear i={2}><Eyebrow>{t('homeServices')}</Eyebrow></Appear>
        {studio.services.map((sv, i) => (
          <Appear key={sv.id} i={3 + i}>
            <PressableScale onPress={hold ? undefined : book} disabled={hold} scaleTo={0.985} style={st.svc} accessibilityRole="button" accessibilityLabel={sv.name + ', ' + money(sv.once * 100)}>
              <Text style={st.svcNo} maxFontSizeMultiplier={1.2}>{'0' + (i + 1)}</Text>
              <View style={{ flex: 1 }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={st.svcName} maxFontSizeMultiplier={MAX_SCALE.text}>{sv.name}</Text>
                    <Text style={st.svcTag} maxFontSizeMultiplier={MAX_SCALE.text}>{svcText['svcTag' + i]}</Text>
                  </View>
                  <Text style={st.price} maxFontSizeMultiplier={1.2}>{money(sv.once * 100)}</Text>
                </Row>
                <Body muted small style={{ marginTop: 8 }}>{svcText['svcDesc' + i]}</Body>
              </View>
            </PressableScale>
          </Appear>
        ))}
      </View>

      {/* New in the Vault */}
      <View style={{ marginTop: S.xxl }}>
        <Row style={[st.pad, { justifyContent: 'space-between' }]}>
          <Eyebrow>{t('homeVaultT')}</Eyebrow>
          <Pressable onPress={() => go('/(tabs)/vault')} hitSlop={8} accessibilityRole="link"><Text style={st.link}>{t('homeSeeAll')} →</Text></Pressable>
        </Row>
        <FlatList horizontal data={fresh || []} keyExtractor={(x) => String(x.id)} showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: S.lg, gap: 14, paddingTop: S.md }}
          snapToInterval={cardW + 14} decelerationRate="fast"
          renderItem={({ item, index }) => <Appear i={index}><ListingCard it={item} width={cardW} /></Appear>}
          ListEmptyComponent={fresh ? <Body muted>{t('empty')}</Body> : <Row gap={14}>{[0, 1, 2].map((k) => <SkeletonCard key={k} width={cardW} />)}</Row>} />
        <View style={[st.pad, { marginTop: S.lg }]}>
          <View style={st.trust}>
            {(['trust1', 'trust2', 'trust3'] as const).map((k, i) => (
              <View key={k} style={[st.trustItem, i > 0 && st.trustLine]}>
                <Icon name={i === 0 ? 'shield' : i === 1 ? 'gavel' : 'lock'} size={17} color={C.goldHi} />
                <Text style={st.trustText} maxFontSizeMultiplier={1.3}>{t(k)}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Legit Check and selling */}
      <View style={[st.pad, { marginTop: S.xxl, gap: S.md }]}>
        <Promo img={PROMO_LEGIT} glow={C.gold} grad={['#1f190b', '#111']} icon="shield" iconColor={C.goldHi} title={t('homeLegitT')} text={t('homeLegitP')}
          cta={t('homeLegitBtn')} ctaColor={C.goldHi} onPress={() => go('/(tabs)/legit')} W={W} />
        <Promo img={PROMO_SELL} glow={C.red} grad={['#220b0b', '#111']} icon="tag" iconColor={C.redText} title={t('homeSellT')} text={t('homeSellP')}
          cta={t('homeSellBtn')} ctaColor={C.redText} onPress={() => go('/(tabs)/sell')} W={W} />
      </View>

      {/* Talk to the studio */}
      <View style={[st.pad, { marginTop: S.xxl }]}>
        <Eyebrow>{t('homeContact')}</Eyebrow>
        <Row style={{ marginTop: S.md }} gap={S.md}>
          <Button title={t('homeWhatsApp')} kind="ghost" icon="chat" small style={{ flex: 1 }} onPress={() => Linking.openURL(WHATSAPP)} />
          <Button title={t('homeEmail')} kind="ghost" icon="mail" small style={{ flex: 1 }} onPress={() => Linking.openURL(EMAIL)} />
        </Row>
      </View>

      <View style={st.foot}>
        <Image source={MARK} style={{ width: 28, height: 28, borderRadius: 7 }} />
        <Text style={st.footWord}>SHOE<Text style={{ color: C.red }}>LAB</Text></Text>
        <Text style={st.footText}>{t('homeLead')}</Text>
        <Text style={st.footVer}>{t('meVersion', { v: Constants.expoConfig?.version || '1.0.0' })}</Text>
      </View>
    </Screen>
  );
}

function Promo({ img, glow, grad, icon, iconColor, title, text, cta, ctaColor, onPress, W }: {
  img: number; glow: string; grad: [string, string]; icon: string; iconColor: string; title: string; text: string; cta: string; ctaColor: string; onPress: () => void; W: number;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} style={st.promo} accessibilityRole="button" accessibilityLabel={title}>
      <LinearGradient colors={grad} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <Glow size={W * 0.7} color={glow} opacity={0.32} style={{ right: -W * 0.2, top: -W * 0.22 }} />
      <Image source={img} style={st.promoImg} contentFit="contain" />
      <View style={{ width: '62%' }}>
        <View style={st.promoIco}><Icon name={icon} size={20} color={iconColor} /></View>
        <H2 style={{ marginTop: 12 }}>{title}</H2>
        <Body muted small style={{ marginTop: 4 }}>{text}</Body>
      </View>
      <Text style={[st.link, { marginTop: 14, color: ctaColor }]}>{cta} →</Text>
    </PressableScale>
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
  svc: { flexDirection: 'row', gap: 14, marginTop: S.md, backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, padding: S.lg },
  svcNo: { fontFamily: F.display, fontSize: 22, color: C.gold, letterSpacing: 1, marginTop: 1 },
  svcName: { fontFamily: F.semibold, fontSize: 16.5, lineHeight: 22, color: C.text },
  svcTag: { fontFamily: F.medium, fontSize: 12, color: C.redText, marginTop: 3, letterSpacing: 0.3 },
  price: { fontFamily: F.display, fontSize: 30, color: C.text, letterSpacing: 0.5, ...NUM },
  link: { fontFamily: F.semibold, fontSize: 12.5, color: C.goldHi, letterSpacing: 1.2, textTransform: 'uppercase' },
  trust: { flexDirection: 'row', backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, paddingVertical: 14 },
  trustItem: { flex: 1, alignItems: 'center', gap: 7, paddingHorizontal: 8 },
  trustLine: { borderLeftWidth: 1, borderLeftColor: C.border },
  trustText: { fontFamily: F.medium, fontSize: 11.5, lineHeight: 15, color: C.muted2, textAlign: 'center' },
  promo: { borderRadius: R.xl, borderWidth: 1, borderColor: C.border, padding: S.xl, overflow: 'hidden', minHeight: 190 },
  promoImg: { position: 'absolute', right: -26, top: 22, width: '52%', height: 120, transform: [{ rotate: '-8deg' }] },
  promoIco: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  foot: { alignItems: 'center', marginTop: 48, paddingHorizontal: S.xl, gap: 6 },
  footWord: { fontFamily: F.display, fontSize: 20, color: C.text, letterSpacing: 2, marginTop: 4 },
  footText: { fontFamily: F.regular, fontSize: 12.5, lineHeight: 18, color: C.muted, textAlign: 'center', maxWidth: 300 },
  footVer: { fontFamily: F.regular, fontSize: 11, color: '#5c5c5c', marginTop: 2 },
});
