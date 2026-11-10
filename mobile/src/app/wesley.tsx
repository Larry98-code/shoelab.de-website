// Wesley in the app: the studio, the Vault, the Legit Check and your orders,
// photos of a pair ("which treatment does it need?"), and a ShoeLab
// specialist when something needs a person. The server is the Vault's support
// chat (/api/market/support/chat with app: true).
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import Animated, { Easing, FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { market } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { errText } from '../lib/errors';
import { store } from '../lib/storage';
import { WHATSAPP } from '../lib/links';
import { Body, Button, tap } from '../components/ui';
import { Sheet } from '../components/Sheet';
import { Icon } from '../components/Icon';
import { WesleyAvatar } from '../components/Wesley';
import { C, F, R, S } from '../theme';

type Msg = { id: number; role: 'user' | 'assistant' | 'note' | 'whatsapp'; text: string; photo?: string; warn?: boolean };
const KEY = 'wesleyChat';
let seq = Date.now();

const bounce = (i: number) => withDelay(i * 160, withRepeat(withSequence(withTiming(-4, { duration: 260, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 260 })), -1, false));
function Dots() {
  const a0 = useSharedValue(0), a1 = useSharedValue(0), a2 = useSharedValue(0);
  useEffect(() => { a0.set(bounce(0)); a1.set(bounce(1)); a2.set(bounce(2)); }, [a0, a1, a2]);
  const st = [useAnimatedStyle(() => ({ transform: [{ translateY: a0.value }] })), useAnimatedStyle(() => ({ transform: [{ translateY: a1.value }] })), useAnimatedStyle(() => ({ transform: [{ translateY: a2.value }] }))];
  return <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 6 }}>{st.map((x, i) => <Animated.View key={i} style={[s.dot, x]} />)}</View>;
}

export default function WesleyScreen() {
  const i18n = useI18n();
  const { t } = i18n;
  const { me } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState(''), [photo, setPhoto] = useState<{ uri: string; data: string } | null>(null);
  const [busy, setBusy] = useState(false), [pick, setPick] = useState(false), [form, setForm] = useState(false);
  const [fMsg, setFMsg] = useState(''), [fEmail, setFEmail] = useState(''), [fBusy, setFBusy] = useState(false), [fErr, setFErr] = useState('');
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  // the conversation is kept on the phone (without the photos)
  useEffect(() => { store.get(KEY).then((v) => { try { const m = JSON.parse(v || '[]'); if (Array.isArray(m)) setMsgs(m.slice(-40)); } catch { /* none */ } }); }, []);
  const save = useCallback((m: Msg[]) => { store.set(KEY, JSON.stringify(m.slice(-40).map((x) => ({ ...x, photo: undefined, text: x.text })))); }, []);
  const push = useCallback((add: Msg[]) => setMsgs((m) => { const n = m.concat(add); save(n); return n; }), [save]);
  const reset = () => { tap('select'); setMsgs([]); save([]); setPhoto(null); setText(''); };

  const send = async (q?: string) => {
    const words = (q ?? text).trim() || (photo ? t('wesPhotoQ') : '');
    if (!words || busy) return;
    tap();
    const mine: Msg = { id: ++seq, role: 'user', text: words, photo: photo?.uri };
    const history = msgs.filter((m) => m.role === 'user' || m.role === 'assistant').concat(mine).slice(-16).map((m) => ({ role: m.role, text: m.text }));
    const shot = photo?.data;
    push([mine]); setText(''); setPhoto(null); setBusy(true);
    const r = await market<{ reply: string; ticket?: { id: number } | null; needContact?: boolean; whatsapp?: boolean; failed?: boolean }>('support/chat', { body: { app: true, page: 'app:wesley', messages: history, photo: shot } });
    setBusy(false);
    // Wesley could not help at all: the team on WhatsApp is the way out
    if (!r.ok) { tap('warn'); push([{ id: ++seq, role: 'assistant', text: t((r.data as { code?: string } | null)?.code === 'support_limit' ? 'helpLimit' : 'helpError'), warn: true }, { id: ++seq, role: 'whatsapp', text: '' }]); return; }
    const add: Msg[] = [{ id: ++seq, role: 'assistant', text: r.data.reply }];
    if (r.data.ticket?.id) add.push({ id: ++seq, role: 'note', text: t('helpTicket', { n: r.data.ticket.id }) });
    // the toughest cases: Wesley offers the team on WhatsApp
    if (r.data.whatsapp || r.data.failed) add.push({ id: ++seq, role: 'whatsapp', text: '' });
    push(add);
    if (r.data.needContact) setTimeout(() => setForm(true), 600);
  };

  const shrink = async (uri: string, w?: number, h?: number) => {
    const big = (w || 0) >= (h || 0) ? { width: Math.min(1024, w || 1024) } : { height: Math.min(1024, h || 1024) };
    const out = await manipulateAsync(uri, [{ resize: big }], { compress: 0.72, format: SaveFormat.JPEG, base64: true });
    setPhoto({ uri: out.uri, data: 'data:image/jpeg;base64,' + out.base64 });
  };
  const camera = async () => {
    setPick(false);
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) return;
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!r.canceled && r.assets[0]) await shrink(r.assets[0].uri, r.assets[0].width, r.assets[0].height);
  };
  const library = async () => {
    setPick(false);
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!r.canceled && r.assets[0]) await shrink(r.assets[0].uri, r.assets[0].width, r.assets[0].height);
  };

  const ticket = async () => {
    setFErr('');
    setFBusy(true);
    const r = await market<{ ticket: { id: number } }>('support/ticket', { body: {
      message: fMsg.trim(), email: me ? undefined : fEmail.trim(), page: 'app:wesley',
      transcript: msgs.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-16).map((m) => ({ role: m.role, text: m.text })),
    } });
    setFBusy(false);
    if (!r.ok) { tap('warn'); return setFErr(errText(i18n, r)); }
    tap('success'); setForm(false); setFMsg('');
    push([{ id: ++seq, role: 'note', text: t('helpTicket', { n: r.data.ticket.id }) }]);
  };

  const fresh = msgs.length === 0;
  const chips: [string, () => void][] = [
    [t('wesQPhoto'), () => { tap('select'); setPick(true); }],
    [t('wesQBook'), () => send(t('wesQBook'))],
    [t('helpQ4'), () => send(t('helpQ4'))],
    [t('helpQ3'), () => send(t('helpQ3'))],
  ];

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.round} accessibilityRole="button" accessibilityLabel={t('close')}><Icon name="x" size={19} color={C.text} /></Pressable>
        <WesleyAvatar size={40} online />
        <View style={{ flex: 1 }}>
          <Text style={s.name}>Wesley <Text style={s.badge}> AI </Text></Text>
          <Text style={s.sub} numberOfLines={2}>{t('helpSub')}</Text>
        </View>
        {!fresh ? <Pressable onPress={reset} hitSlop={10} style={s.round} accessibilityRole="button" accessibilityLabel={t('wesNew')}><Icon name="refresh" size={17} color={C.text} /></Pressable> : null}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <ScrollView ref={scroll} contentContainerStyle={s.list} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          <Animated.View entering={FadeIn.duration(400)} style={s.row}>
            <WesleyAvatar size={28} style={s.mini} />
            <View style={[s.bubble, s.them]}><Text style={s.txt}>{t('wesHello')}</Text></View>
          </Animated.View>
          {fresh ? (
            <Animated.View entering={FadeInUp.duration(450).delay(150)} style={s.chips}>
              {chips.map(([label, go], i) => (
                <Pressable key={i} onPress={go} style={({ pressed }) => [s.chip, pressed && { backgroundColor: C.card3 }]} accessibilityRole="button">
                  {i === 0 ? <Icon name="camera" size={14} color={C.goldHi} /> : null}
                  <Text style={s.chipT}>{label}</Text>
                </Pressable>
              ))}
            </Animated.View>
          ) : null}
          {msgs.map((m) => m.role === 'whatsapp' ? (
            <Animated.View key={m.id} entering={FadeInUp.duration(320)} style={s.waWrap}>
              <Pressable onPress={() => { tap(); Linking.openURL(WHATSAPP); }} style={({ pressed }) => [s.wa, pressed && { opacity: 0.85 }]} accessibilityRole="link" accessibilityLabel={t('wesWaT')}>
                <View style={s.waIco}><Icon name="chat" size={18} color="#062b14" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.waT}>{t('wesWaT')}</Text>
                  <Text style={s.waP}>{t('wesWaP')}</Text>
                </View>
                <Icon name="right" size={16} color="#86efac" />
              </Pressable>
            </Animated.View>
          ) : m.role === 'note' ? (
            <Animated.View key={m.id} entering={FadeIn.duration(300)} style={s.note}>
              <Icon name="check" size={15} color={C.goldHi} /><Text style={s.noteT}>{m.text}</Text>
            </Animated.View>
          ) : (
            <Animated.View key={m.id} entering={FadeInUp.duration(280)} style={[s.row, m.role === 'user' && { justifyContent: 'flex-end' }]}>
              {m.role === 'assistant' ? <WesleyAvatar size={28} style={s.mini} /> : null}
              <View style={[s.bubble, m.role === 'user' ? s.mine : s.them, m.warn && { borderColor: 'rgba(245,158,11,0.4)' }]}>
                {m.photo ? <Image source={{ uri: m.photo }} style={s.shot} contentFit="cover" /> : null}
                <Text style={[s.txt, m.role === 'user' && { color: '#fff' }]} selectable>{m.text}</Text>
              </View>
            </Animated.View>
          ))}
          {busy ? (
            <Animated.View entering={FadeIn.duration(200)} style={s.row}>
              <WesleyAvatar size={28} style={s.mini} />
              <View style={[s.bubble, s.them]} accessibilityLabel={t('helpTyping')}><Dots /></View>
            </Animated.View>
          ) : null}
          <Pressable onPress={() => { tap('select'); setFErr(''); setForm(true); }} style={s.human} accessibilityRole="button">
            <Icon name="user" size={14} color={C.muted2} /><Text style={s.humanT}>{t('helpHuman')}</Text>
          </Pressable>
        </ScrollView>

        {photo ? (
          <View style={s.attach}>
            <Image source={{ uri: photo.uri }} style={s.attachImg} contentFit="cover" />
            <Text style={s.attachT} numberOfLines={2}>{t('wesPhotoQ')}</Text>
            <Pressable onPress={() => setPhoto(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')}><Icon name="x" size={16} color={C.muted2} /></Pressable>
          </View>
        ) : null}
        <View style={s.composer}>
          <Pressable onPress={() => { tap('select'); setPick(true); }} style={s.cam} accessibilityRole="button" accessibilityLabel={t('wesPhoto')}><Icon name="camera" size={20} color={C.goldHi} /></Pressable>
          <TextInput value={text} onChangeText={setText} placeholder={t('helpPh')} placeholderTextColor={C.muted} multiline maxLength={1500}
            style={s.input} selectionColor={C.gold} accessibilityLabel={t('helpPh')} />
          <Pressable onPress={() => send()} disabled={busy || (!text.trim() && !photo)} accessibilityRole="button" accessibilityLabel={t('helpSend')}
            style={[s.send, (busy || (!text.trim() && !photo)) && { opacity: 0.4 }]}>
            <Icon name="right" size={20} color="#fff" stroke={2.4} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Sheet open={pick} onClose={() => setPick(false)} title={t('wesPhoto')}>
        <View style={{ gap: 10, paddingBottom: S.lg }}>
          <Button title={t('sellTakePhoto')} icon="camera" onPress={camera} />
          <Button title={t('sellFromLibrary')} icon="image" kind="ghost" onPress={library} />
        </View>
      </Sheet>
      <Sheet open={form} onClose={() => setForm(false)} title={t('helpFormT')}>
        {me ? <Body muted small>{t('helpFormMember', { email: me.email })}</Body> : (
          <TextInput value={fEmail} onChangeText={setFEmail} placeholder={t('email')} placeholderTextColor={C.muted} keyboardType="email-address" autoCapitalize="none" autoComplete="email"
            style={s.field} accessibilityLabel={t('email')} />
        )}
        <TextInput value={fMsg} onChangeText={setFMsg} placeholder={t('helpFormPh')} placeholderTextColor={C.muted} multiline maxLength={2000}
          style={[s.field, { minHeight: 110, textAlignVertical: 'top' }]} accessibilityLabel={t('helpFormT')} />
        {fErr ? <Text style={s.err}>{fErr}</Text> : null}
        <Button title={t('helpFormSend')} busy={fBusy} onPress={ticket} style={{ marginTop: S.md, marginBottom: S.lg }} />
      </Sheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.black },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: S.lg, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  round: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: F.semibold, fontSize: 16, color: C.text },
  badge: { fontFamily: F.bold, fontSize: 10, color: '#fff', backgroundColor: C.red, overflow: 'hidden', borderRadius: 6, letterSpacing: 0.6 },
  sub: { fontFamily: F.regular, fontSize: 11.5, lineHeight: 15, color: C.muted, marginTop: 1 },
  list: { padding: S.lg, gap: 12, paddingBottom: 24, width: '100%', maxWidth: 720, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  mini: { marginBottom: 2 },
  bubble: { maxWidth: '82%', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1 },
  them: { backgroundColor: C.card, borderColor: C.border, borderBottomLeftRadius: 6 },
  mine: { backgroundColor: C.red, borderColor: C.red, borderBottomRightRadius: 6 },
  txt: { fontFamily: F.regular, fontSize: 15, lineHeight: 22, color: C.text },
  shot: { width: 200, height: 200, borderRadius: 14, marginBottom: 8, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 36 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 9, borderRadius: R.pill, borderWidth: 1, borderColor: C.borderHi, backgroundColor: C.card },
  chipT: { fontFamily: F.medium, fontSize: 13, color: C.text },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', maxWidth: '92%', backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldLine, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 9 },
  noteT: { flex: 1, fontFamily: F.medium, fontSize: 13, lineHeight: 18, color: C.amberText },
  waWrap: { paddingLeft: 36 },
  wa: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.45)', maxWidth: 420 },
  waIco: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center' },
  waT: { fontFamily: F.semibold, fontSize: 14.5, color: '#dcfce7' },
  waP: { fontFamily: F.regular, fontSize: 12, lineHeight: 16, color: '#a7f3c4', marginTop: 2 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.muted2 },
  human: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingVertical: 8, marginTop: 4 },
  humanT: { fontFamily: F.medium, fontSize: 12.5, color: C.muted2, textDecorationLine: 'underline' },
  attach: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: S.lg, marginBottom: 8, padding: 8, borderRadius: R.md, backgroundColor: C.card, borderWidth: 1, borderColor: C.goldLine },
  attachImg: { width: 44, height: 44, borderRadius: 10 },
  attachT: { flex: 1, fontFamily: F.medium, fontSize: 13, color: C.text },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: S.md, paddingTop: 8, paddingBottom: 10, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: '#0b0b0b' },
  cam: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.goldSoft, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 42, maxHeight: 120, borderRadius: 21, backgroundColor: C.card, borderWidth: 1, borderColor: C.borderHi, paddingHorizontal: 15, paddingTop: 11, paddingBottom: 11, fontFamily: F.regular, fontSize: 15, color: C.text },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  field: { backgroundColor: C.black, borderWidth: 1, borderColor: C.borderHi, borderRadius: R.md, padding: 12, fontFamily: F.regular, fontSize: 15, color: C.text, marginTop: 10 },
  err: { fontFamily: F.medium, fontSize: 13.5, color: '#ff9a9a', marginTop: S.sm },
});
