// What a signed-out visitor sees: how it works, step by step, and a clear way in.
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useI18n } from '../lib/i18n';
import { C, F, MAX_SCALE, R, S } from '../theme';
import { Icon } from './Icon';
import { Appear } from './motion';
import { Button } from './ui';

export type Step = { title: string; text?: string; icon?: string };

// A numbered timeline (or icons, when given).
export function Steps({ items, accent = C.gold, start = 0 }: { items: Step[]; accent?: string; start?: number }) {
  return (
    <View style={{ marginTop: S.xl }}>
      {items.map((it, i) => (
        <Appear key={i} i={start + i} style={s.row}>
          <View style={{ alignItems: 'center' }}>
            <View style={[s.dot, { borderColor: accent }]}>
              {it.icon ? <Icon name={it.icon} size={16} color={accent} /> : <Text style={[s.no, { color: accent }]} maxFontSizeMultiplier={1.2}>{i + 1}</Text>}
            </View>
            {i < items.length - 1 ? <View style={s.line} /> : null}
          </View>
          <View style={{ flex: 1, paddingBottom: i < items.length - 1 ? S.lg : 0 }}>
            <Text style={s.t} maxFontSizeMultiplier={MAX_SCALE.text}>{it.title}</Text>
            {it.text ? <Text style={s.p} maxFontSizeMultiplier={MAX_SCALE.text}>{it.text}</Text> : null}
          </View>
        </Appear>
      ))}
    </View>
  );
}

// Sign in, or create an account.
export function AuthButtons({ why, i = 0 }: { why?: string; i?: number }) {
  const { t } = useI18n();
  return (
    <Appear i={i} style={{ marginTop: S.xl, gap: 10 }}>
      <Button title={t('signIn')} icon="user" onPress={() => router.push({ pathname: '/auth', params: why ? { why } : {} })} />
      <Button title={t('createAccount')} kind="ghost" onPress={() => router.push({ pathname: '/auth', params: { mode: 'up', ...(why ? { why } : {}) } })} />
    </Appear>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14 },
  dot: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
  no: { fontFamily: F.display, fontSize: 18, marginTop: 1 },
  line: { width: 1.5, flex: 1, backgroundColor: C.borderHi, marginVertical: 4, borderRadius: R.pill },
  t: { fontFamily: F.semibold, fontSize: 15.5, lineHeight: 21, color: C.text, marginTop: 6 },
  p: { fontFamily: F.regular, fontSize: 13.5, lineHeight: 20, color: C.muted2, marginTop: 3 },
});
