import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { abs, market } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { errText } from '../../lib/errors';
import { store } from '../../lib/storage';
import { ReportSheet } from '../../components/ReportSheet';
import { Sheet } from '../../components/Sheet';
import { Icon } from '../../components/Icon';
import { Body, Button, Card, Chip, Empty, H2, H3, Row, tap } from '../../components/ui';
import { C, F, R, S } from '../../theme';

type Order = Record<string, any> & { id: number; role: 'buyer' | 'seller'; status: string; title: string; total: number; payout?: number; events: { kind: string; note: string | null; at: string }[] };
const TONE: Record<string, 'ok' | 'warn' | 'bad' | 'gold' | ''> = { awaiting_payment: 'warn', paid: 'gold', to_lab: 'gold', in_lab: 'gold', verified: 'ok', shipped: 'gold', delivered: 'ok', disputed: 'bad', refunded: '', failed: 'bad', cancelled: '' };
type Addr = { name: string; line1: string; line2: string; postal: string; city: string };

// One order, as the buyer or the seller sees it: what happens now, the next step, the history.
export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const i18n = useI18n();
  const { t, money, dateTime } = i18n;
  const [o, setO] = useState<Order | null>(null), [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(''), [msg, setMsg] = useState(''), [flash, setFlash] = useState('');
  const [sheet, setSheet] = useState<'' | 'pay' | 'problem' | 'report'>('');
  const [addr, setAddr] = useState<Addr>({ name: '', line1: '', line2: '', postal: '', city: '' });
  const [tracking, setTracking] = useState(''), [note, setNote] = useState(''), [comment, setComment] = useState('');

  const load = useCallback(async () => {
    const r = await market<{ buying: { orders: Order[] }; selling: { orders: Order[] } }>('me');
    if (!r.ok) { if (r.status === 401) router.replace('/auth'); return; }
    const all = r.data.buying.orders.concat(r.data.selling.orders);
    const hit = all.find((x) => String(x.id) === String(id));
    if (hit) setO(hit); else setMissing(true);
  }, [id]);
  useEffect(() => { load(); store.get('addr').then((v) => { if (v) try { setAddr(JSON.parse(v)); } catch { /* old */ } }); }, [load]);

  const say = (k: string) => { setFlash(t(k)); setTimeout(() => setFlash(''), 3000); };
  const act = async (key: string, route: string, body: object, ok: string) => {
    setBusy(key); setMsg('');
    const r = await market(route, { body });
    setBusy('');
    if (!r.ok) { tap('warn'); setMsg(errText(i18n, r)); return false; }
    tap('success'); say(ok); await load(); return true;
  };
  const pay = async () => {
    if (!addr.name.trim() || !addr.line1.trim() || !addr.postal.trim() || !addr.city.trim()) return setMsg(t('e_address') !== 'e_address' ? t('e_address') : t('e_generic'));
    setBusy('pay'); setMsg('');
    await store.set('addr', JSON.stringify(addr));
    const r = await market('order/pay', { body: { orderId: o!.id, address: { ...addr, country: 'DE' } } });
    setBusy('');
    if (!r.ok) { tap('warn'); return setMsg(errText(i18n, r)); }
    setSheet('');
    // card payments happen on Stripe's own page; back in the app, the order shows the result
    if (r.data.url) await WebBrowser.openBrowserAsync(r.data.url);
    await load();
  };

  if (missing) return <SafeAreaView style={s.screen}><Back /><Empty icon="box" title={t('orderMissingT')} /></SafeAreaView>;
  if (!o) return <SafeAreaView style={[s.screen, { justifyContent: 'center' }]}><ActivityIndicator color={C.gold} /></SafeAreaView>;
  const buyer = o.role === 'buyer';

  const step = () => {
    switch (o.status) {
      case 'awaiting_payment':
        if (!buyer) return <Note icon="clock" text={t('sellerAwaitPay')} />;
        return o.payMode === 'manual' ? <Note icon="info" tone="gold" text={t('payManualWaiting', { amount: money(o.total, true) })} /> : (
          <View style={{ gap: S.md }}><Note icon="clock" tone="warn" text={t('payWithin')} />
            <Button title={t('payAmount', { amount: money(o.total, true) })} onPress={() => { setMsg(''); setSheet('pay'); }} /></View>);
      case 'paid':
        if (buyer) return <Note icon="box" text={t(o.tier === 'lab' ? 'buyerPaidLab' : 'buyerPaid')} />;
        return (
          <View style={{ gap: S.md }}>
            <Note icon="box" tone="gold" text={t(o.tier === 'lab' ? 'shipToLab' : 'shipToBuyer')} />
            {o.shipTo && o.shipTo.address ? <Card><Text style={s.k}>{t(o.shipTo.lab ? 'sendToLab' : 'sendToBuyer')}</Text><Body style={{ marginTop: 6 }}>{o.shipTo.address}</Body>
              {o.shipTo.lab ? <Body small muted style={{ marginTop: 6 }}>{t('labNoteInside', { n: o.id })}</Body> : null}</Card> : o.shipTo?.lab ? <Body small muted>{t('labAddrLater')}</Body> : null}
            <TextInput value={tracking} onChangeText={setTracking} placeholder={t('trackingPh')} placeholderTextColor={C.muted} autoCapitalize="characters" style={s.input} />
            <Button title={t('markShipped')} kind="gold" busy={busy === 'ship'} onPress={() => tracking.trim() ? act('ship', 'order/ship', { orderId: o.id, tracking: tracking.trim() }, 'shippedToast') : setMsg(t('e_tracking'))} />
          </View>
        );
      case 'to_lab': return <Note icon="truck" text={t(buyer ? 'buyerToLab' : 'sellerToLab')} />;
      case 'in_lab': return <Note icon="shield" tone="gold" text={t(buyer ? 'buyerInLab' : 'sellerInLab')} />;
      case 'verified': return <Note icon="shield" tone="ok" text={t(buyer ? 'buyerVerified' : 'sellerVerified')} />;
      case 'shipped':
        if (!buyer) return <Note icon="truck" text={t('sellerShipped')} />;
        return (
          <View style={{ gap: S.md }}><Note icon="truck" text={t('buyerShipped')} />
            <Button title={t('confirmDelivery')} kind="ok" busy={busy === 'recv'} onPress={() => act('recv', 'order/received', { orderId: o.id }, 'receivedToast')} />
            <Button title={t('reportProblem')} kind="danger" onPress={() => { setMsg(''); setNote(''); setSheet('problem'); }} />
            <Body small muted>{t('confirmDeliveryNote')}</Body></View>
        );
      case 'delivered':
        if (!buyer) {
          const ps = o.payoutStatus;
          const k = ps === 'sent' ? 'payoutSentLine' : ps === 'sending' ? 'payoutSendingLine' : ps === 'failed' ? 'payoutFailedLine' : ps === 'waiting' ? 'payoutWaitingLine' : 'sellerDelivered';
          return <Note icon="euro" tone="ok" text={t(k, { amount: money(o.payout ?? 0, true) })} />;
        }
        if (o.feedback) return <Note icon="star" tone="ok" text={t('youRated', { rating: t(o.feedback.rating > 0 ? 'ratePos' : o.feedback.rating < 0 ? 'rateNeg' : 'rateNeu') })} />;
        return (
          <View style={{ gap: S.md }}>
            <H3>{t('rateSeller')}</H3>
            <TextInput value={comment} onChangeText={setComment} placeholder={t('rateCommentPh')} placeholderTextColor={C.muted} maxLength={300} style={s.input} />
            <Row gap={8}>
              {[[1, 'ratePos'], [0, 'rateNeu'], [-1, 'rateNeg']].map(([v, k]) => (
                <Button key={k} small kind="ghost" title={t(k as string)} busy={busy === 'rate' + v} style={{ flex: 1 }}
                  onPress={() => act('rate' + v, 'order/feedback', { orderId: o.id, rating: v, comment: comment.trim() }, 'ratedToast')} />
              ))}
            </Row>
          </View>
        );
      case 'disputed': return <Note icon="flag" tone="bad" text={t(buyer ? 'buyerDisputed' : 'sellerDisputed')} />;
      case 'refunded': return <Note icon="refresh" text={t(buyer ? 'buyerRefunded' : 'sellerRefunded') + (buyer && o.refunded ? ' ' + t('refundCardNote') : '')} />;
      case 'failed': return <Note icon="alert" tone="bad" text={t(buyer ? 'buyerFailed' : 'sellerFailed')} />;
      case 'cancelled': return <Note icon="x" text={t('orderCancelled')} />;
    }
    return null;
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <Back />
      <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: 120 }}>
        <Row gap={14} style={{ marginTop: S.sm }}>
          <Pressable onPress={() => router.push('/listing/' + o.listingId)} style={s.thumb}>{o.photo ? <Image source={{ uri: abs(o.photo) }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.k}>{t('orderNo', { n: o.id })}</Text>
            <H2 style={{ fontSize: 26, lineHeight: 28 }}>{o.title}</H2>
            <Row gap={6} style={{ marginTop: 6, flexWrap: 'wrap' }}><Chip text={t('os_' + o.status)} tone={TONE[o.status] || ''} /><Chip text={'EU ' + (o.size || '')} /></Row>
          </View>
        </Row>
        {flash ? <View style={s.flash}><Icon name="check" size={16} color="#6ee7a0" /><Text style={s.flashText}>{flash}</Text></View> : null}
        <View style={{ marginTop: S.xl }}>{step()}</View>
        {msg && !sheet ? <Text style={s.err}>{msg}</Text> : null}

        <Card style={{ marginTop: S.xl }}>
          <Line k={t('lineItem')} v={money(o.itemPrice, true)} />
          <Line k={t('lineAuth')} v={money(o.authFee, true)} />
          <Line k={t('lineShip')} v={money(o.shipFee, true)} />
          {o.addon ? <Line k={t('addon_' + o.addon)} v={money(o.addonFee, true)} /> : null}
          <Line k={t('lineTotal')} v={money(o.total, true)} bold />
          {!buyer && o.payout != null ? <Line k={t('youReceive')} v={money(o.payout, true)} bold /> : null}
          {o.refundedAmount ? <Line k={t('refundL')} v={money(o.refundedAmount, true)} /> : null}
        </Card>

        <H3 style={{ marginTop: S.xl }}>{t('history')}</H3>
        {o.events.map((e, k) => (
          <Row key={k} style={s.ev}><View style={s.evDot} /><View style={{ flex: 1 }}><Text style={s.evT}>{t('ev_' + e.kind)}{e.note && !/^[a-z_]+$/.test(e.note) ? ' — ' + e.note : ''}</Text><Text style={s.evAt}>{dateTime(e.at)}</Text></View></Row>
        ))}
        {o.otherId && o.status !== 'awaiting_payment' ? (
          <Pressable onPress={() => setSheet('report')} style={s.report} accessibilityRole="button"><Icon name="flag" size={14} color={C.muted} /><Text style={s.reportText}>{t(buyer ? 'rpSeller' : 'rpBuyer')}</Text></Pressable>
        ) : null}
      </ScrollView>

      <Sheet open={sheet === 'pay'} onClose={() => setSheet('')} title={t('payTitle')}>
        <Text style={s.k}>{t('deliveryTo')}</Text>
        {([['name', 'addrName', 'name'], ['line1', 'addrLine1', 'street-address'], ['line2', 'addrLine2', undefined], ['postal', 'addrPostal', 'postal-code'], ['city', 'addrCity', undefined]] as const).map(([f, label, ac]) => (
          <TextInput key={f} value={addr[f]} onChangeText={(v) => setAddr({ ...addr, [f]: v })} placeholder={t(label)} placeholderTextColor={C.muted}
            autoComplete={ac as any} style={[s.input, { marginTop: 8 }]} accessibilityLabel={t(label)} />
        ))}
        <Body small muted style={{ marginTop: 8 }}>{t('addrGermany')}</Body>
        <Body small muted style={{ marginTop: 8 }}>{t('payNoteOnline')}</Body>
        {msg ? <Text style={s.err}>{msg}</Text> : null}
        <Button title={t('payAmount', { amount: money(o.total, true) })} busy={busy === 'pay'} onPress={pay} style={{ marginVertical: S.lg }} />
      </Sheet>
      <Sheet open={sheet === 'problem'} onClose={() => setSheet('')} title={t('problemT')}>
        <Body small muted>{t('problemLead')}</Body>
        <TextInput value={note} onChangeText={setNote} multiline maxLength={1000} placeholder={t('problemPh')} placeholderTextColor={C.muted} style={[s.input, { minHeight: 110, marginTop: S.md, textAlignVertical: 'top' }]} />
        {msg ? <Text style={s.err}>{msg}</Text> : null}
        <Button title={t('reportProblem')} kind="danger" busy={busy === 'prob'} style={{ marginVertical: S.lg }}
          onPress={async () => { if (note.trim().length < 5) return setMsg(t('e_note_needed')); if (await act('prob', 'order/problem', { orderId: o.id, note: note.trim() }, 'problemSent')) setSheet(''); }} />
      </Sheet>
      {o.otherId ? <ReportSheet open={sheet === 'report'} onClose={() => setSheet('')} kind="user" id={o.otherId} orderId={o.id} title={o.title} /> : null}
    </SafeAreaView>
  );
}

function Back() {
  return (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/me'))} style={s.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10}>
      <Icon name="left" size={22} color={C.text} />
    </Pressable>
  );
}
function Note({ icon, text, tone = '' }: { icon: string; text: string; tone?: 'ok' | 'warn' | 'bad' | 'gold' | '' }) {
  const c = tone === 'ok' ? ['rgba(34,197,94,0.1)', 'rgba(34,197,94,0.35)', '#6ee7a0'] : tone === 'warn' ? ['rgba(245,158,11,0.1)', 'rgba(245,158,11,0.35)', '#fcc46b']
    : tone === 'bad' ? ['rgba(255,77,77,0.1)', 'rgba(255,77,77,0.35)', '#ff9a9a'] : tone === 'gold' ? [C.goldSoft, C.goldLine, C.goldHi] : [C.card, C.border, C.muted2];
  return <Row gap={10} style={[s.note, { backgroundColor: c[0], borderColor: c[1] }]}><Icon name={icon} size={18} color={c[2]} /><Text style={s.noteText}>{text}</Text></Row>;
}
function Line({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <Row style={{ justifyContent: 'space-between', paddingVertical: 5 }}><Text style={[s.lineK, bold && { color: C.text, fontFamily: F.semibold }]}>{k}</Text><Text style={[s.lineV, bold && { fontFamily: F.bold }]}>{v}</Text></Row>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.black },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  thumb: { width: 84, height: 74, borderRadius: R.md, overflow: 'hidden', backgroundColor: C.card2 },
  k: { fontFamily: F.medium, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: C.muted2 },
  note: { borderRadius: R.md, borderWidth: 1, padding: 14, alignItems: 'flex-start' },
  noteText: { flex: 1, fontFamily: F.regular, fontSize: 14.5, lineHeight: 21, color: C.text },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.borderHi, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 13, fontFamily: F.regular, fontSize: 15.5, color: C.text },
  flash: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.okSoft, borderColor: 'rgba(34,197,94,0.35)', borderWidth: 1, borderRadius: R.md, padding: 12, marginTop: S.lg },
  flashText: { fontFamily: F.medium, fontSize: 13.5, color: '#bff5d2', flex: 1 },
  err: { fontFamily: F.medium, fontSize: 13.5, color: '#ff9a9a', marginTop: S.md },
  lineK: { fontFamily: F.regular, fontSize: 13.5, color: C.muted2 }, lineV: { fontFamily: F.medium, fontSize: 13.5, color: C.text },
  ev: { alignItems: 'flex-start', paddingVertical: 9 },
  evDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.gold, marginTop: 6 },
  evT: { fontFamily: F.regular, fontSize: 14, color: C.text, lineHeight: 20 }, evAt: { fontFamily: F.regular, fontSize: 12, color: C.muted, marginTop: 2 },
  report: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: S.xl, padding: 8 },
  reportText: { fontFamily: F.medium, fontSize: 12.5, color: C.muted },
});
