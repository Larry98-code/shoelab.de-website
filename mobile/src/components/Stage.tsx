// Sneakers floating in ShoeLab red light — the welcome screen and the home hero.
import { useEffect, type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

export const SNEAKERS = {
  jordan1: require('../../assets/img/hero-jordan1.webp'),
  nb9060: require('../../assets/img/promo-9060.webp'),
  nb1080: require('../../assets/img/promo-1080.webp'),
};

// A soft round light.
export function Glow({ size, color, opacity = 0.55, style }: { size: number; color: string; opacity?: number; style?: StyleProp<ViewStyle> }) {
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

// Bobs gently up and down; `delay` and `lift` keep several pairs out of step.
export function Floating({ children, style, rotate = -9, lift = 7, delay = 0, duration = 2600 }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; rotate?: number; lift?: number; delay?: number; duration?: number;
}) {
  const y = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!reduced) y.set(withDelay(delay, withRepeat(withTiming(-lift, { duration, easing: Easing.inOut(Easing.sin) }), -1, true)));
  }, [y, reduced, delay, lift, duration]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { rotate: rotate + 'deg' }] }));
  return <Animated.View style={[style, a]} pointerEvents="none">{children}</Animated.View>;
}
