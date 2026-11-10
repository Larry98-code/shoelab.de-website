import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../../components/Icon';
import { tap } from '../../components/ui';
import { Pop } from '../../components/motion';
import { useI18n } from '../../lib/i18n';
import { C, F } from '../../theme';

const TABS: Record<string, { icon: string; label: string }> = {
  index: { icon: 'home', label: 'tabHome' }, vault: { icon: 'vault', label: 'tabVault' }, sell: { icon: 'plus', label: 'tabSell' },
  legit: { icon: 'shield', label: 'tabLegit' }, me: { icon: 'user', label: 'tabMe' },
};

// Five tabs; "Sell" sits raised in the middle, in ShoeLab red.
function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  return (
    <View style={[s.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {Platform.OS === 'ios' ? <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} /> : null}
      {state.routes.map((r, i) => {
        const on = state.index === i, cfg = TABS[r.name];
        if (!cfg) return null;
        const go = () => {
          const e = emitter.emit({ type: 'tabPress', target: r.key, canPreventDefault: true });
          if (!on && !e.defaultPrevented) { tap('select'); navigateToTab(r.key); }
        };
        if (r.name === 'sell') {
          return (
            <Pressable key={r.key} onPress={go} accessibilityRole="button" accessibilityLabel={t(cfg.label)} style={s.item}>
              <View style={s.sell}>
                <LinearGradient colors={['#ef2a2a', '#b30e0e']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={s.sellFill} />
                <View><Icon name="plus" size={26} color="#fff" stroke={2.2} /></View>
              </View>
              <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={[s.label, on && s.labelOn]}>{t(cfg.label)}</Text>
            </Pressable>
          );
        }
        return (
          <Pressable key={r.key} onPress={go} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t(cfg.label)} style={s.item}>
            {on ? <View style={[s.ind, r.name === 'vault' && { backgroundColor: C.goldHi }]} /> : null}
            <Pop on={on}><Icon name={cfg.icon} size={23} color={on ? (r.name === 'vault' ? C.goldHi : '#fff') : C.muted} /></Pop>
            <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={[s.label, on && s.labelOn, on && r.name === 'vault' && { color: C.goldHi }]}>{t(cfg.label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="vault" />
      <Tabs.Screen name="sell" />
      <Tabs.Screen name="legit" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(8,8,8,0.72)' : '#0a0a0a', overflow: 'visible' },
  ind: { position: 'absolute', top: -9, width: 18, height: 3, borderRadius: 2, backgroundColor: C.red },
  sellFill: { ...StyleSheet.absoluteFill, borderRadius: 26 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  label: { fontFamily: F.medium, fontSize: 10.5, color: C.muted, letterSpacing: 0.2 },
  labelOn: { color: '#fff', fontFamily: F.semibold },
  sell: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', marginTop: -20,
    borderWidth: 4, borderColor: C.black, shadowColor: C.red, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
});
