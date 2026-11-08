// A soft round light — behind the turning pairs and wherever a glow is wanted.
import { type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

export function Glow({ size, color, opacity = 0.55, style }: { size: number; color: string; opacity?: number; style?: StyleProp<ViewStyle> }) {
  const id = 'g' + color.replace(/[^a-z0-9]/gi, '');
  return (
    <Svg width={size} height={size} style={[{ position: 'absolute' }, style]} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={'url(#' + id + ')'} />
    </Svg>
  );
}
