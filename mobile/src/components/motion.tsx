// Motion: a soft press, a calm entrance, and shimmering placeholders while
// things load — the small details that make the app feel solid.
import { useEffect, type ReactNode } from 'react';
import { Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { C, R } from '../theme';

const APressable = Animated.createAnimatedComponent(Pressable);

// Shrinks a touch when pressed and springs back, like a physical button.
export function PressableScale({ children, style, scaleTo = 0.97, ...rest }: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; scaleTo?: number; children: ReactNode }) {
  const k = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: k.value }] }));
  return (
    <APressable {...rest}
      onPressIn={(e) => { k.set(withTiming(scaleTo, { duration: 90, easing: Easing.out(Easing.quad) })); rest.onPressIn?.(e); }}
      onPressOut={(e) => { k.set(withTiming(1, { duration: 180, easing: Easing.out(Easing.back(2)) })); rest.onPressOut?.(e); }}
      style={[style, a]}>
      {children}
    </APressable>
  );
}

// Fades and lifts content in; `i` staggers a list.
export function Appear({ children, i = 0, style }: { children: ReactNode; i?: number; style?: StyleProp<ViewStyle> }) {
  return <Animated.View entering={FadeInDown.duration(420).delay(Math.min(i, 8) * 55).easing(Easing.out(Easing.cubic))} style={style}>{children}</Animated.View>;
}

// A gently pulsing placeholder block.
export function Skeleton({ w, h, r = R.md, style }: { w?: number | `${number}%`; h: number; r?: number; style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(0.45);
  useEffect(() => { o.set(withRepeat(withTiming(0.9, { duration: 850, easing: Easing.inOut(Easing.quad) }), -1, true)); }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: w ?? '100%', height: h, borderRadius: r, backgroundColor: C.card2 }, a, style]} />;
}

// The shape of a listing card, shown while the Vault loads.
export function SkeletonCard({ width }: { width: number }) {
  return (
    <View style={{ width }}>
      <Skeleton h={width * 0.86} r={R.lg} />
      <Skeleton h={13} w="85%" r={6} style={{ marginTop: 11 }} />
      <Skeleton h={11} w="55%" r={6} style={{ marginTop: 7 }} />
      <Skeleton h={20} w="40%" r={6} style={{ marginTop: 9 }} />
    </View>
  );
}

