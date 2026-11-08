import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { abs, API, market } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { errText } from '../../lib/errors';
import { GuidedCamera, type Shot } from '../../components/GuidedCamera';
import { HoldCard } from '../../components/HoldCard';
import { Icon } from '../../components/Icon';
import { Body, Button, Card, Chip, Empty, Eyebrow, H1, H3, Row, Screen, tap } from '../../components/ui';
import { Appear } from '../../components/motion';
import { AuthButtons, Steps } from '../../components/Guest';
import { C, F, R, S } from '../../theme';

type Check = { id: number; ref: string; mode: 'buy' | 'sell'; title: string; size: string; status: string; verdict: string | null; resultNote: string | null;
  cert: string | null; createdAt: string; photos: { url: string; kind: string }[] };
const SELL_KINDS = ['side_out', 'side_in', 'sole', 'size_tag', 'box_label', 'insole'];
const BUY_KINDS = ['side_out', 'side_in', 'sole', 'size_tag', 'box_label', 'insole', 'other', 'heel'];
const VERDICT_TONE: Record<string, 'ok' | 'bad' | 'warn'> = { authentic: 'ok', not_authentic: 'bad', inconclusive: 'warn' };

// Real or fake? Photos of a pair from another app (or your own, for a certificate), checked by the lab.
export default function Legit() {
  const i18n = useI18n();
  const { t, money, date } = i18n;
  const { me, config } = useAuth();
  const { width } = useWindowDimensions();
  const [mine, setMine] = useState<Check[] | null>(null);
  const [form, setForm] = useState(false);
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [f, setF] = useState({ link: '', asked: '', brand: '', model: '', size: '', note: '' });
  const [shots, setShots] = useState<Record<string, Shot>>({}), [cam, setCam] = useState('');
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  const load = useCallback(async () => { if (!me) return; const r = await market<{ legit: Check[] }>('me'); if (r.ok) setMine(r.data.legit || []); }, [me]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const fee = (config?.legit as number) ?? 990;
  const hold = config?.paused?.hold;
  const kinds = mode === 'sell' ? SELL_KINDS : BUY_KINDS;
  const need = mode === 'sell' ? SELL_KINDS.length : 3;
  const have = mode === 'sell' ? SELL_KINDS.filter((k) => shots[k]).length : Object.keys(shots).length;
  const slotW = (Math.min(width, 640) - S.lg * 2 - 24) / 3;

  const send = async () => {
    setMsg('');
    if (!f.brand.trim() || !f.model.trim() || !f.size.trim()) return setMsg(t('e_brand_model'));
    if (have < need) return setMsg(t('lgMinPhotos', { n: need }));
    if (!consent) return setMsg(t('lgConsentNeeded'));
    setBusy(true);
    const r = await market('legit', { body: {
      mode, link: f.link.trim() || undefined, askedPrice: f.asked.trim() || undefined, brand: f.brand.trim(), model: f.model.trim(), size: f.size.trim(),
      note: f.note.trim(), consent: true, photos: Object.values(shots).map((x) => ({ kind: x.kind, data: x.data, thumb: x.thumb })),
    } });
    setBusy(false);
    if (!r.ok) { tap('warn'); return setMsg(errText(i18n, r)); }
    tap('success');
    if (r.data.url) await WebBrowser.openBrowserAsync(r.data.url);
    setForm(false); setShots({}); setF({ link: '', asked: '', brand: '', model: '', size: '', note: '' }); setConsent(false);
    load();
  };

  const head = (
    <View>
      <Eyebrow>{t('lgEyebrow')}</Eyebrow>
      <H1 style={{ marginTop: 6 }}>{t('lgTitleA')}</H1>
      <H1 style={{ color: C.goldHi }}>{t('lgTitleB')}</H1>
      <Body muted style={{ marginTop: 8 }}>{t('lgLead')}</Body>
    </View>
  );
  if (hold) return <Screen>{head}<View style={{ marginTop: S.xl }}><HoldCard /></View></Screen>;
  if (!me) return (
    <Screen>
      <Appear>{head}</Appear>
      <Steps start={1} items={[1, 2, 3, 4].map((n) => ({ title: t('lgHow' + n + 'T'), text: t('lgHow' + n) }))} />
      <AuthButtons why="authNeeded" i={5} />
    </Screen>
  );

  if (form) {
    const input = (k: keyof typeof f, label: string, ph?: string, kb?: 'decimal-pad' | 'url') => (
      <View style={{ marginBottom: S.md }}>
        <Text style={s.k}>{label}</Text>
        <TextInput value={f[k]} onChangeText={(v) => setF({ ...f, [k]: v })} placeholder={ph} placeholderTextColor={C.muted} keyboardType={kb} autoCapitalize={kb === 'url' ? 'none' : 'sentences'} style={s.input} accessibilityLabel={label} />
      </View>
    );
    return (
      <Screen>
        <Pressable onPress={() => setForm(false)} style={{ marginBottom: S.md }} accessibilityRole="button"><Icon name="left" size={22} color={C.text} /></Pressable>
        <H1>{t('lgStart')}</H1>
        <View style={s.seg}>
          {(['buy', 'sell'] as const).map((k) => (
            <Pressable key={k} onPress={() => { tap('select'); setMode(k); setShots({}); }} style={[s.segB, mode === k && s.segOn]} accessibilityRole="tab" accessibilityState={{ selected: mode === k }}>
              <Text style={[s.segT, mode === k && { color: '#111' }]}>{t(k === 'buy' ? 'lgBuyT' : 'lgSellT')}</Text>
            </Pressable>
          ))}
        </View>
        <Body small muted style={{ marginBottom: S.lg }}>{t(mode === 'buy' ? 'lgBuyP' : 'lgSellP')}</Body>
        {mode === 'buy' ? <>{input('link', t('lgLink'), 'https://', 'url')}{input('asked', t('lgAsked') + ' · ' + t('optional'), '€', 'decimal-pad')}</> : null}
        {input('brand', t('fBrand'), 'Nike')}
        {input('model', t('modelLabel'), t('modelPh'))}
        {input('size', t('fSize'), '42.5', 'decimal-pad')}
        <Text style={s.k}>{t(mode === 'buy' ? 'lgPhotosBuy' : 'lgPhotosSell', { n: need })}</Text>
        <View style={s.grid}>
          {kinds.map((k) => (
            <Pressable key={k} onPress={() => setCam(k)} style={[s.slot, { width: slotW, height: slotW }, !shots[k] && s.slotEmpty]} accessibilityRole="button" accessibilityLabel={t('kind_' + k)}>
              {shots[k] ? <Image source={{ uri: shots[k].uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> :
                <View style={{ alignItems: 'center' }}><Icon name="camera" size={20} color={mode === 'sell' ? C.goldHi : C.muted} /><Text style={s.slotT}>{t('kind_' + k)}</Text></View>}
            </Pressable>
          ))}
        </View>
        <Body small muted style={{ marginTop: S.md }}>{t(mode === 'buy' ? 'lgBuyTip' : 'lgSellTip')}</Body>
        {input('note', t('lgNote') + ' · ' + t('optional'))}
        <Pressable onPress={() => { tap('select'); setConsent(!consent); }} style={s.check} accessibilityRole="checkbox" accessibilityState={{ checked: consent }}>
          <View style={[s.box, consent && s.boxOn]}>{consent ? <Icon name="check" size={14} color="#111" stroke={2.6} /> : null}</View>
          <Text style={s.checkT}>{t('lgConsent')}</Text>
        </Pressable>
        {msg ? <Text style={s.err}>{msg}</Text> : null}
        <Button title={t('lgGoPay', { amount: money(fee, true) })} busy={busy} onPress={send} style={{ marginTop: S.lg }} />
        <GuidedCamera kind={cam} open={!!cam} onClose={() => setCam('')} onShot={(x) => setShots((o) => ({ ...o, [x.kind]: x }))} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={load} refreshing={false}>
      {head}
      <Row gap={10} style={{ marginTop: S.xl }}>
        <Card style={{ flex: 1 }} onPress={() => { setMode('buy'); setForm(true); }}><Icon name="search" size={22} color={C.goldHi} /><H3 style={{ marginTop: 8 }}>{t('lgBuyT')}</H3><Body small muted>{t('lgModeBuy')}</Body></Card>
        <Card style={{ flex: 1 }} gold onPress={() => { setMode('sell'); setForm(true); }}><Icon name="shield" size={22} color={C.goldHi} /><H3 style={{ marginTop: 8 }}>{t('lgSellT')}</H3><Body small muted>{t('lgModeSell')}</Body></Card>
      </Row>
      <Text style={[s.k, { marginTop: S.xl }]}>{t('tabLegit')}</Text>
      {!mine ? <ActivityIndicator color={C.gold} /> : mine.length ? mine.map((g) => (
        <Card key={g.id} style={{ marginBottom: S.md }}>
          <Row gap={12}>
            <View style={s.thumb}>{g.photos[0] ? <Image source={{ uri: abs(g.photos[0].url) }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
            <View style={{ flex: 1 }}>
              <Text style={s.title} numberOfLines={1}>{g.title}</Text>
              <Text style={s.sub}>{g.ref} · EU {g.size} · {date(g.createdAt)}</Text>
              <Row gap={6} style={{ marginTop: 6, flexWrap: 'wrap' }}>
                <Chip text={t('ls_' + g.status)} tone={g.status === 'done' ? 'ok' : g.status === 'awaiting_payment' ? 'warn' : 'gold'} />
                {g.verdict ? <Chip text={t('lv_' + g.verdict)} tone={VERDICT_TONE[g.verdict] || ''} /> : null}
              </Row>
            </View>
          </Row>
          {g.resultNote ? <Body small muted style={{ marginTop: S.md }}>{g.resultNote}</Body> : null}
          {g.cert ? <Button small kind="gold" icon="shield" title={t('lgCertT') + ' ' + g.cert} style={{ marginTop: S.md }} onPress={() => WebBrowser.openBrowserAsync(API + '/verified.html?c=' + encodeURIComponent(g.cert!))} /> : null}
          {g.status === 'awaiting_payment' ? <Button small title={t('lgPayBtn', { amount: money(fee, true) })} style={{ marginTop: S.md }}
            onPress={async () => { const r = await market('legit/pay', { body: { id: g.id } }); if (r.ok && r.data.url) await WebBrowser.openBrowserAsync(r.data.url); load(); }} /> : null}
        </Card>
      )) : <Empty icon="shield" title={t('lgEmptyT')} text={t('lgEmpty')} />}
    </Screen>
  );
}

const s = StyleSheet.create({
  k: { fontFamily: F.medium, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: C.muted2, marginBottom: 8 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.borderHi, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 13, fontFamily: F.regular, fontSize: 15.5, color: C.text },
  seg: { flexDirection: 'row', backgroundColor: C.card, borderRadius: R.pill, padding: 4, marginVertical: S.lg, borderWidth: 1, borderColor: C.border },
  segB: { flex: 1, paddingVertical: 10, borderRadius: R.pill, alignItems: 'center' }, segOn: { backgroundColor: C.goldHi },
  segT: { fontFamily: F.semibold, fontSize: 13.5, color: C.muted2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  slot: { borderRadius: R.md, overflow: 'hidden', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  slotEmpty: { borderStyle: 'dashed' },
  slotT: { fontFamily: F.medium, fontSize: 11.5, color: C.text, marginTop: 5, textAlign: 'center' },
  check: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: S.md },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: C.borderHi, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: C.goldHi, borderColor: C.goldHi },
  checkT: { flex: 1, fontFamily: F.regular, fontSize: 13.5, lineHeight: 19, color: C.text },
  err: { fontFamily: F.medium, fontSize: 13.5, color: '#ff9a9a', marginTop: S.md },
  thumb: { width: 60, height: 60, borderRadius: 12, overflow: 'hidden', backgroundColor: C.card2 },
  title: { fontFamily: F.semibold, fontSize: 15, color: C.text }, sub: { fontFamily: F.regular, fontSize: 12, color: C.muted, marginTop: 2 },
});
