// The building blocks every screen uses: the same black, red and gold, the
// same Bebas Neue headlines and calm cards as the website.
import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { C, CONTENT_MAX, F, GOLD_GRAD, MAX_SCALE, R, S } from '../theme';
import { Icon } from './Icon';
import { PressableScale } from './motion';

export function tap(kind: 'light' | 'select' | 'success' | 'warn' = 'light') {
  try {
    if (kind === 'select') Haptics.selectionAsync();
    else if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === 'warn') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch { /* no haptics (web) */ }
}

export function Screen({ children, scroll = true, refreshing, onRefresh, edges = ['top'], pad = true, style }: {
  children: ReactNode; scroll?: boolean; refreshing?: boolean; onRefresh?: () => void; edges?: Edge[]; pad?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView edges={edges} style={[st.screen, style]}>
      {scroll ? (
        <ScrollView contentContainerStyle={[st.column, pad && st.pad, { paddingBottom: 120 }]} keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl tintColor={C.gold} colors={[C.gold]} progressBackgroundColor={C.card2} refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}>
          {children}
        </ScrollView>
      ) : <View style={[{ flex: 1 }, st.column, pad && st.pad]}>{children}</View>}
    </SafeAreaView>
  );
}

export const H1 = ({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) => <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_SCALE.display} style={[st.h1, style]}>{children}</Text>;
export const H2 = ({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) => <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_SCALE.display} style={[st.h2, style]}>{children}</Text>;
export const H3 = ({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) => <Text maxFontSizeMultiplier={MAX_SCALE.text} style={[st.h3, style]}>{children}</Text>;
export const Eyebrow = ({ children, color = C.gold, style }: { children: ReactNode; color?: string; style?: StyleProp<TextStyle> }) =>
  <Text maxFontSizeMultiplier={MAX_SCALE.display} style={[st.eyebrow, { color }, style]}>{children}</Text>;
export const Body = ({ children, style, muted, small, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean; small?: boolean; numberOfLines?: number }) =>
  <Text numberOfLines={numberOfLines} maxFontSizeMultiplier={MAX_SCALE.text} style={[st.body, muted && { color: C.muted2 }, small && { fontSize: 13, lineHeight: 19 }, style]}>{children}</Text>;

type BtnKind = 'red' | 'gold' | 'ghost' | 'danger' | 'ok';
export function Button({ title, onPress, kind = 'red', busy, disabled, icon, small, tight, style }: {
  title: string; onPress?: () => void; kind?: BtnKind; busy?: boolean; disabled?: boolean; icon?: string; small?: boolean; tight?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const fg = kind === 'gold' ? '#111' : kind === 'danger' ? '#ff9a9a' : '#fff';
  const inner = (
    <View style={[st.btnIn, small && st.btnSmall, tight && st.btnTight]}>
      {busy ? <ActivityIndicator color={fg} /> : <>
        {icon ? <Icon name={icon} size={small ? 16 : 18} color={fg} /> : null}
        <Text maxFontSizeMultiplier={MAX_SCALE.display} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[st.btnText, small && { fontSize: 15 }, tight && { letterSpacing: 1.2, flexShrink: 1 }, { color: fg }]}>{title}</Text>
      </>}
    </View>
  );
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }} disabled={disabled || busy}
      onPress={() => { tap(); onPress?.(); }}
      style={[st.btn, kind === 'red' && st.btnRed, kind === 'ok' && { backgroundColor: C.ok },
        kind === 'ghost' && st.btnGhost, kind === 'danger' && { borderWidth: 1, borderColor: 'rgba(255,77,77,0.45)' },
        (disabled && !busy) && { opacity: 0.45 }, style]}>
      {kind === 'gold' ? <LinearGradient colors={GOLD_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.fill} /> : null}
      {kind === 'red' ? <LinearGradient colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={st.fill} /> : null}
      {inner}
    </PressableScale>
  );
}

export function Card({ children, style, onPress, gold }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; gold?: boolean }) {
  const s = [st.card, gold && { borderColor: C.goldLine }, style];
  if (!onPress) return <View style={s}>{children}</View>;
  return <PressableScale accessibilityRole="button" scaleTo={0.985} onPress={() => { tap('select'); onPress(); }} style={s}>{children}</PressableScale>;
}

const TONES: Record<string, [string, string, string]> = {
  ok: [C.okSoft, '#6ee7a0', 'rgba(34,197,94,0.35)'], warn: [C.warnSoft, '#fcc46b', 'rgba(245,158,11,0.35)'],
  bad: [C.badSoft, '#ff9a9a', 'rgba(255,77,77,0.35)'], gold: [C.goldSoft, C.goldHi, 'rgba(212,175,55,0.35)'], '': ['rgba(255,255,255,0.05)', '#d6d6d6', C.border],
};
export function Chip({ text, tone = '', icon }: { text: string; tone?: 'ok' | 'warn' | 'bad' | 'gold' | ''; icon?: string }) {
  const [bg, fg, bd] = TONES[tone];
  return (
    <View style={[st.chip, { backgroundColor: bg, borderColor: bd }]}>
      {icon ? <Icon name={icon} size={12} color={fg} /> : null}
      <Text style={[st.chipText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function Empty({ icon = 'vault', title, text, children }: { icon?: string; title: string; text?: string; children?: ReactNode }) {
  return (
    <View style={st.empty}>
      <View style={st.emptyIco}><Icon name={icon} size={26} color={C.gold} /></View>
      <H3 style={{ textAlign: 'center' }}>{title}</H3>
      {text ? <Body muted style={{ textAlign: 'center', marginTop: 6 }}>{text}</Body> : null}
      {children ? <View style={{ marginTop: S.lg, alignSelf: 'stretch' }}>{children}</View> : null}
    </View>
  );
}

export function Row({ children, style, gap = S.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function ListItem({ icon, title, sub, onPress, right, danger }: { icon?: string; title: string; sub?: string; onPress?: () => void; right?: ReactNode; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress ? () => { tap('select'); onPress(); } : undefined}
      style={({ pressed }) => [st.li, pressed && onPress && { backgroundColor: C.card2 }]}>
      {icon ? <View style={st.liIco}><Icon name={icon} size={18} color={danger ? C.bad : C.goldHi} /></View> : null}
      <View style={{ flex: 1 }}>
        <Text style={[st.liTitle, danger && { color: '#ff9a9a' }]}>{title}</Text>
        {sub ? <Text style={st.liSub}>{sub}</Text> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron" size={16} color={C.muted} /> : null)}
    </Pressable>
  );
}

export const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.black },
  pad: { paddingHorizontal: S.lg, paddingTop: S.md },
  column: { width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center' },
  h1: { fontFamily: F.display, fontSize: 44, lineHeight: 44, letterSpacing: 1, color: C.text },
  h2: { fontFamily: F.display, fontSize: 30, lineHeight: 32, letterSpacing: 0.8, color: C.text },
  h3: { fontFamily: F.semibold, fontSize: 17, lineHeight: 23, color: C.text },
  eyebrow: { fontFamily: F.medium, fontSize: 11, letterSpacing: 3.2, textTransform: 'uppercase' },
  body: { fontFamily: F.regular, fontSize: 15, lineHeight: 23, color: C.text },
  btn: { borderRadius: R.md, minHeight: 52, justifyContent: 'center' },
  fill: { ...StyleSheet.absoluteFill, borderRadius: R.md },
  btnIn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: S.xl, paddingVertical: 14 },
  btnSmall: { paddingHorizontal: S.lg, paddingVertical: 9 },
  btnTight: { paddingHorizontal: 12, gap: 6 },
  btnText: { fontFamily: F.display, fontSize: 19, letterSpacing: 2.2 },
  btnRed: { backgroundColor: C.red, shadowColor: C.red, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  btnGhost: { borderWidth: 1, borderColor: C.borderHi, backgroundColor: 'rgba(255,255,255,0.03)' },
  card: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, padding: S.lg },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: R.pill, borderWidth: 1 },
  chipText: { fontFamily: F.semibold, fontSize: 11, letterSpacing: 0.3 },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: S.lg },
  emptyIco: { width: 58, height: 58, borderRadius: 29, backgroundColor: C.goldSoft, alignItems: 'center', justifyContent: 'center', marginBottom: S.md },
  li: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: 14, paddingHorizontal: S.lg },
  liIco: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.goldSoft, alignItems: 'center', justifyContent: 'center' },
  liTitle: { fontFamily: F.medium, fontSize: 15, color: C.text },
  liSub: { fontFamily: F.regular, fontSize: 12.5, color: C.muted, marginTop: 2, lineHeight: 17 },
});
