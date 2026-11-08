// The first screen for anyone not signed in: three pairs floating in ShoeLab
// red light, the name, and the way in: sign in or create an account.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, FadeIn, FadeInDown } from 'react-native-reanimated';
import { useAuth } from '../lib/auth';
import { LANGS, LANG_NAMES, useI18n } from '../lib/i18n';
import { Button, Row, tap } from '../components/ui';
import { Showcase } from '../components/Showcase';
import { Sheet } from '../components/Sheet';
import { Icon } from '../components/Icon';
import { C, F, R, S } from '../theme';

const ease = Easing.out(Easing.cubic);

export default function Welcome() {
  const { t, lang, setLang } = useI18n();
  const { setGuest } = useAuth();
  const { width, height } = useWindowDimensions();
  const [langOpen, setLangOpen] = useState(false);
  // the showcase takes what is left above the name and the buttons
  const stage = Math.min(width - S.lg * 2, 480, Math.max(230, height - 430) * 1.18);

  return (
    <View style={s.screen}>
      <LinearGradient colors={['#000', '#140707', '#000']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <Row style={s.top}>
          <Image source={require('../../assets/mark.png')} style={s.mark} accessibilityIgnoresInvertColors />
          <Pressable onPress={() => { tap('select'); setLangOpen(true); }} style={s.lang} accessibilityRole="button" accessibilityLabel={t('meLanguage')} hitSlop={8}>
            <Icon name="globe" size={16} color={C.text} />
            <Text style={s.langT}>{lang.toUpperCase()}</Text>
          </Pressable>
        </Row>

        {/* the pairs, turning like on the website */}
        <Animated.View entering={FadeIn.duration(900).delay(100)} style={{ marginTop: S.md }}>
          <Showcase size={stage} caption="short" />
        </Animated.View>

        <View style={s.bottom}>
          <Animated.View entering={FadeIn.duration(700).delay(650)} style={{ alignItems: 'center' }}>
            <Text style={s.word} maxFontSizeMultiplier={1} accessibilityRole="header">SHOE<Text style={{ color: C.red }}>LAB</Text></Text>
            <Text style={s.lead} maxFontSizeMultiplier={1.4}>{t('homeLead')}</Text>
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(650).delay(850).easing(ease)} style={{ gap: 10, marginTop: S.xl, alignSelf: 'stretch' }}>
            <Button title={t('signIn')} icon="user" onPress={() => router.push('/auth')} />
            <Button title={t('createAccount')} kind="ghost" onPress={() => router.push({ pathname: '/auth', params: { mode: 'up' } })} />
            <Pressable onPress={() => { tap('select'); setGuest(true); }} style={s.guest} accessibilityRole="button" hitSlop={8}>
              <Text style={s.guestT}>{t('welcomeGuest')}</Text>
              <Icon name="right" size={14} color={C.muted2} />
            </Pressable>
          </Animated.View>
        </View>
      </SafeAreaView>

      <Sheet open={langOpen} onClose={() => setLangOpen(false)} title={t('meLanguage')}>
        {LANGS.map((l) => (
          <Pressable key={l} onPress={() => { tap('select'); setLang(l); setLangOpen(false); }} style={s.langRow} accessibilityRole="radio" accessibilityState={{ checked: l === lang }}>
            <Text style={[s.langText, l === lang && { color: C.goldHi }]}>{LANG_NAMES[l]}</Text>
            {l === lang ? <Icon name="check" size={18} color={C.goldHi} /> : null}
          </Pressable>
        ))}
        <View style={{ height: S.lg }} />
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  top: { justifyContent: 'space-between', paddingHorizontal: S.lg, paddingTop: 6 },
  mark: { width: 36, height: 36, borderRadius: 9 },
  lang: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: R.pill, borderWidth: 1, borderColor: C.borderHi, backgroundColor: 'rgba(255,255,255,0.04)' },
  langT: { fontFamily: F.semibold, fontSize: 12, letterSpacing: 1, color: C.text },
  stage: { marginTop: S.md, overflow: 'visible' },
  abs: { position: 'absolute' },
  fill: { width: '100%', height: '100%' },
  bottom: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: S.xl, paddingBottom: S.md, width: '100%', maxWidth: 520, alignSelf: 'center' },
  word: { fontFamily: F.display, fontSize: 50, lineHeight: 52, letterSpacing: 5, color: '#fff',
    textShadowColor: 'rgba(204,17,17,0.55)', textShadowRadius: 28, textShadowOffset: { width: 0, height: 0 } },
  lead: { fontFamily: F.regular, fontSize: 14.5, lineHeight: 21, color: C.muted2, textAlign: 'center', marginTop: 6, maxWidth: 320 },
  guest: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  guestT: { fontFamily: F.medium, fontSize: 13.5, color: C.muted2 },
  langRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: C.border },
  langText: { fontFamily: F.medium, fontSize: 16, color: C.text },
});
