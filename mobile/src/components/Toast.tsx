// A short message that slides in from the top and leaves by itself
// ("Bid placed", "Added to your watchlist").
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeOutUp, SlideInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, R, SHADOW } from '../theme';
import { Icon } from './Icon';
import { tap } from './ui';

type Tone = 'ok' | 'warn' | 'info';
type T = { id: number; text: string; tone: Tone };
const Ctx = createContext<(text: string, tone?: Tone) => void>(() => {});
export const useToast = () => useContext(Ctx);

const LOOK: Record<Tone, { icon: string; color: string; line: string }> = {
  ok: { icon: 'check', color: '#6ee7a0', line: 'rgba(34,197,94,0.4)' },
  warn: { icon: 'alert', color: '#fcc46b', line: 'rgba(245,158,11,0.4)' },
  info: { icon: 'info', color: C.goldHi, line: C.goldLine },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const show = useCallback((text: string, tone: Tone = 'ok') => {
    if (timer.current) clearTimeout(timer.current);
    tap(tone === 'warn' ? 'warn' : tone === 'ok' ? 'success' : 'light');
    setT({ id: Date.now(), text, tone });
    timer.current = setTimeout(() => setT(null), 2800);
  }, []);
  const look = t ? LOOK[t.tone] : LOOK.ok;
  return (
    <Ctx.Provider value={show}>
      {children}
      {t ? (
        <View pointerEvents="none" style={[s.wrap, { top: insets.top + 8 }]}>
          <Animated.View key={t.id} entering={SlideInUp.duration(320).easing(Easing.out(Easing.cubic))} exiting={FadeOutUp.duration(220)}
            style={[s.toast, { borderColor: look.line }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
            <View style={[s.ico, { backgroundColor: look.line }]}><Icon name={look.icon} size={15} color={look.color} stroke={2.2} /></View>
            <Text style={s.text} numberOfLines={3}>{t.text}</Text>
          </Animated.View>
        </View>
      ) : null}
    </Ctx.Provider>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14, alignItems: 'center', zIndex: 1000 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 11, maxWidth: 520, alignSelf: 'stretch', backgroundColor: 'rgba(22,22,22,0.97)',
    borderRadius: R.lg, borderWidth: 1, paddingVertical: 13, paddingHorizontal: 14, ...SHADOW.card },
  ico: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, fontFamily: F.medium, fontSize: 14, lineHeight: 19, color: C.text },
});
