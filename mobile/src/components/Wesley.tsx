// Wesley's face (the website's illustrated avatar) and the floating button that opens him.
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { SvgXml } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useI18n } from '../lib/i18n';
import { C, F, SHADOW } from '../theme';
import { WESLEY_SVG } from './wesleyAvatar';
import { tap } from './ui';

export function WesleyAvatar({ size = 40, online, style }: { size?: number; online?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <SvgXml xml={WESLEY_SVG} width={size} height={size} />
      {online ? <View style={[s.dot, { width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14 }]} /> : null}
    </View>
  );
}

// Bottom right, above the tab bar: Wesley, with a soft ring that breathes.
export function WesleyFab({ bottom = 100 }: { bottom?: number }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const k = useSharedValue(0);
  useEffect(() => { if (!reduced) k.set(withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1, false)); }, [k, reduced]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - k.value), transform: [{ scale: 1 + k.value * 0.45 }] }));
  return (
    <View style={[s.fabWrap, { bottom }]} pointerEvents="box-none">
      <Animated.View style={[s.ring, ring]} pointerEvents="none" />
      <Pressable onPress={() => { tap(); router.push('/wesley'); }} style={({ pressed }) => [s.fab, SHADOW.red, pressed && { transform: [{ scale: 0.94 }] }]}
        accessibilityRole="button" accessibilityLabel={t('wesAsk')}>
        <WesleyAvatar size={50} />
        <View style={s.ai}><Text style={s.aiT}>AI</Text></View>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  dot: { position: 'absolute', right: 0, bottom: 0, backgroundColor: '#22c55e', borderWidth: 2, borderColor: C.black },
  fabWrap: { position: 'absolute', right: 16, width: 58, height: 58, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: C.red },
  fab: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#111', borderWidth: 2, borderColor: C.red, alignItems: 'center', justifyContent: 'center' },
  ai: { position: 'absolute', top: -4, right: -6, backgroundColor: C.red, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1.5, borderColor: C.black },
  aiT: { fontFamily: F.bold, fontSize: 9, color: '#fff', letterSpacing: 0.6 },
});
