// The opening screen, the same as the website's: SHOELAB glowing in the dark,
// a thin red bar and a count from 0 to 100 %. It waits at 92 % until the app
// has really loaded, then fades away.
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { C, F, NUM } from '../theme';

export function Preloader({ ready, onFull, onDone }: { ready: boolean; onFull: () => void; onDone: () => void }) {
  const [v, setV] = useState(0);
  const reduced = useReducedMotion();
  const readyRef = useRef(ready);
  useEffect(() => { readyRef.current = ready; }, [ready]);

  const pulse = useSharedValue(1), fade = useSharedValue(1), bar = useSharedValue(0);
  useEffect(() => {
    if (!reduced) pulse.set(withRepeat(withTiming(1.03, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [pulse, reduced]);

  // the count: random steps like the website, held at 92 % until loading is done
  useEffect(() => {
    const iv = setInterval(() => {
      setV((x) => {
        const cap = readyRef.current ? 100 : 92;
        return Math.min(cap, x + Math.random() * 18 + 7);
      });
    }, 120);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { bar.set(withTiming(v, { duration: 240, easing: Easing.out(Easing.quad) })); }, [v, bar]);
  useEffect(() => {
    if (v < 100) return;
    onFull();
    const h = setTimeout(() => {
      fade.set(withTiming(0, { duration: 650, easing: Easing.out(Easing.quad) }, (fin) => { if (fin) scheduleOnRN(onDone); }));
    }, 250);
    return () => clearTimeout(h);
  }, [v, fade, onFull, onDone]);

  const logo = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const wrap = useAnimatedStyle(() => ({ opacity: fade.value }));
  const fill = useAnimatedStyle(() => ({ width: `${bar.value}%` }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.wrap, wrap]} accessibilityRole="progressbar" accessibilityLabel="ShoeLab" accessibilityValue={{ min: 0, max: 100, now: Math.floor(v) }}>
      <Animated.Text style={[s.logo, logo]} maxFontSizeMultiplier={1}>SHOE<Text style={{ color: C.red }}>LAB</Text></Animated.Text>
      <View style={s.track}><Animated.View style={[s.fill, fill]} /></View>
      <Text style={s.pct} maxFontSizeMultiplier={1}>{Math.floor(v)}%</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: C.black, alignItems: 'center', justifyContent: 'center', gap: 26, zIndex: 100 },
  logo: { fontFamily: F.display, fontSize: 64, letterSpacing: 5, color: '#fff', lineHeight: 68,
    textShadowColor: 'rgba(204,17,17,0.6)', textShadowRadius: 30, textShadowOffset: { width: 0, height: 0 } },
  track: { width: 240, height: 2, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: C.redHi, shadowColor: C.redHi, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  pct: { fontFamily: F.medium, fontSize: 10, letterSpacing: 5, color: 'rgba(255,255,255,0.4)', marginLeft: 5, ...NUM },
});
