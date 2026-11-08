// The menu behind ☰ in the header: talk to the studio, reviews, the certificate
// check, language, settings and the legal pages (Impressum and the rest).
// It unfolds from the button, over a dimmed screen.
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../lib/api';
import { LANGS, LANG_NAMES, useI18n } from '../lib/i18n';
import { C, F, R, SHADOW } from '../theme';
import { Icon } from './Icon';
import { tap } from './ui';

export const WHATSAPP = 'https://wa.me/491772258878';
export const EMAIL = 'mailto:Shoelab.de@gmail.com';

export function MenuButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => { tap('select'); setOpen(true); }} hitSlop={10} style={s.btn} accessibilityRole="button" accessibilityLabel={t('menu')} accessibilityState={{ expanded: open }}>
        <Icon name="menu" size={20} color={C.text} />
      </Pressable>
      {open ? <Menu onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function MenuItem({ icon, label, sub, onPress, color = C.goldHi, right }: { icon: string; label: string; sub?: string; onPress: () => void; color?: string; right?: ReactNode }) {
  return (
    <Pressable onPress={() => { tap('select'); onPress(); }} style={({ pressed }) => [s.item, pressed && { backgroundColor: 'rgba(255,255,255,0.06)' }]} accessibilityRole="button" accessibilityLabel={label}>
      <View style={s.ico}><Icon name={icon} size={17} color={color} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.label} maxFontSizeMultiplier={1.3}>{label}</Text>
        {sub ? <Text style={s.sub} maxFontSizeMultiplier={1.3}>{sub}</Text> : null}
      </View>
      {right ?? <Icon name="chevron" size={14} color={C.muted} />}
    </Pressable>
  );
}

function Menu({ onClose }: { onClose: () => void }) {
  const { t, lang, setLang } = useI18n();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [langs, setLangs] = useState(false);
  const p = useSharedValue(0);
  useEffect(() => { p.set(withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) })); }, [p]);
  const panel = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * -10 }, { scale: 0.94 + p.value * 0.06 }] }));
  const scrim = useAnimatedStyle(() => ({ opacity: p.value }));
  const close = (then?: () => void) => { p.set(withTiming(0, { duration: 160 })); setTimeout(() => { onClose(); then?.(); }, 150); };
  const web = (path: string) => close(() => WebBrowser.openBrowserAsync(API + path));
  const W = Math.min(320, width - 28);

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => close()} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, s.scrim, scrim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessibilityLabel={t('close')} />
      </Animated.View>
      <Animated.View style={[s.panel, SHADOW.card, { top: insets.top + 54, width: W, maxHeight: height - insets.top - insets.bottom - 80, transformOrigin: 'top right' }, panel]} accessibilityViewIsModal>
        {Platform.OS === 'ios' ? <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} /> : null}
        <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
          <View style={s.head}>
            <Image source={require('../../assets/mark.png')} style={s.mark} />
            <View style={{ flex: 1 }}>
              <Text style={s.word}>SHOE<Text style={{ color: C.red }}>LAB</Text></Text>
              <Text style={s.sub}>Bremen · shoelabonline.de</Text>
            </View>
          </View>

          <Text style={s.group}>{t('homeContact')}</Text>
          <MenuItem icon="chat" label={t('homeWhatsApp')} sub="+49 177 2258878" color="#4ade80" onPress={() => close(() => Linking.openURL(WHATSAPP))} />
          <MenuItem icon="mail" label={t('homeEmail')} sub="Shoelab.de@gmail.com" onPress={() => close(() => Linking.openURL(EMAIL))} />

          <View style={s.rule} />
          <MenuItem icon="star" label={t('footReviews')} onPress={() => web('/reviews.html')} />
          <MenuItem icon="shield" label={t('footVerify')} onPress={() => web('/verified.html')} />
          <MenuItem icon="globe" label={t('meLanguage')} sub={LANG_NAMES[lang]} onPress={() => setLangs(!langs)}
            right={<Icon name={langs ? 'x' : 'chevron'} size={14} color={C.muted} />} />
          {langs ? (
            <View style={s.langs}>
              {LANGS.map((l) => (
                <Pressable key={l} onPress={() => { tap('select'); setLang(l); }} style={[s.lang, l === lang && s.langOn]} accessibilityRole="radio" accessibilityState={{ checked: l === lang }} accessibilityLabel={LANG_NAMES[l]}>
                  <Text style={[s.langT, l === lang && { color: '#111' }]}>{l.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <MenuItem icon="settings" label={t('meSettings')} onPress={() => close(() => router.push('/settings'))} />

          <View style={s.rule} />
          <Text style={s.group}>{t('meLegal')}</Text>
          <View style={s.legal}>
            {([['meImprint', '/impressum.html'], ['mePrivacy', '/datenschutz.html'], ['meTerms', '/vault-terms.html']] as const).map(([k, path]) => (
              <Pressable key={k} onPress={() => { tap('select'); web(path); }} style={({ pressed }) => [s.chip, pressed && { backgroundColor: 'rgba(255,255,255,0.1)' }]} accessibilityRole="link">
                <Text style={s.chipT} maxFontSizeMultiplier={1.3}>{t(k)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.ver}>{t('meVersion', { v: Constants.expoConfig?.version || '1.0.0' })}</Text>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  btn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  scrim: { backgroundColor: 'rgba(0,0,0,0.55)' },
  panel: { position: 'absolute', right: 14, borderRadius: 22, borderWidth: 1, borderColor: C.borderHi, overflow: 'hidden',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(22,22,22,0.78)' : '#161616' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  mark: { width: 38, height: 38, borderRadius: 10 },
  word: { fontFamily: F.display, fontSize: 22, letterSpacing: 2, color: C.text },
  group: { fontFamily: F.medium, fontSize: 10, letterSpacing: 2.6, textTransform: 'uppercase', color: C.gold, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  ico: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: F.medium, fontSize: 14.5, color: C.text },
  sub: { fontFamily: F.regular, fontSize: 11.5, color: C.muted, marginTop: 1 },
  rule: { height: 1, backgroundColor: C.border, marginVertical: 6, marginHorizontal: 16 },
  langs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingLeft: 60, paddingBottom: 8 },
  lang: { minWidth: 42, paddingVertical: 6, paddingHorizontal: 8, borderRadius: R.pill, borderWidth: 1, borderColor: C.borderHi, alignItems: 'center' },
  langOn: { backgroundColor: C.goldHi, borderColor: C.goldHi },
  langT: { fontFamily: F.semibold, fontSize: 11.5, letterSpacing: 1, color: C.text },
  legal: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: R.pill, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: C.border },
  chipT: { fontFamily: F.medium, fontSize: 12, color: C.muted2 },
  ver: { fontFamily: F.regular, fontSize: 11, color: '#5c5c5c', textAlign: 'center', paddingTop: 6, paddingBottom: 6 },
});
