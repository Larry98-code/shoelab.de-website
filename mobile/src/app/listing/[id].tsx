import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native';
import { API, market } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { errText } from '../../lib/errors';
import { parseEuro } from '../../lib/money';
import type { Listing } from '../../lib/types';
import { Gallery } from '../../components/Gallery';
import { Countdown, TierBadge } from '../../components/ListingCard';
import { Sheet } from '../../components/Sheet';
import { ReportSheet } from '../../components/ReportSheet';
import { Icon } from '../../components/Icon';
import { Body, Button, Card, Chip, Empty, Eyebrow, H1, H3, Row, tap } from '../../components/ui';
import { C, F, R, S } from '../../theme';

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const i18n = useI18n();
  const { t, tn, money, date, ago } = i18n;
  const { me, config } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [L, setL] = useState<Listing | null>(null);
  const [gone, setGone] = useState(false);
  const [sheet, setSheet] = useState<'' | 'bid' | 'buy' | 'offer' | 'report'>('');
  const [amount, setAmount] = useState(''), [note, setNote] = useState('');
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState(''), [flash, setFlash] = useState('');

  const load = useCallback(async () => {
    const r = await market<{ listing: Listing }>('listing?id=' + encodeURIComponent(String(id)));
    if (r.ok) { setL(r.data.listing); setGone(false); } else if (r.status === 404) setGone(true);
  }, [id]);
  useEffect(() => { load(); }, [load]);
  // a live auction refreshes itself
  useEffect(() => {
    if (!L || L.status !== 'live' || L.format !== 'auction') return;
    const h = setInterval(load, 15000);
    return () => clearInterval(h);
  }, [L, load]);

  const needMe = (why: string) => { if (me) return true; router.push({ pathname: '/auth', params: { why } }); return false; };
  const open = (k: 'bid' | 'buy' | 'offer' | 'report') => {
    if (k !== 'report' && !needMe(k === 'bid' ? 'authBid' : k === 'buy' ? 'authBuy' : 'authOffer')) return;
    setMsg(''); setAmount(k === 'bid' && L?.minNext ? String(L.minNext / 100) : ''); setNote(''); setSheet(k);
  };
  const watch = async () => {
    if (!L || !needMe('authWatch')) return;
    const on = !L.viewer?.watching;
    tap('select');
    const r = await market('watch', { body: { id: L.id, on } });
    if (r.ok) { setL({ ...L, watchers: r.data.watchers, viewer: { ...(L.viewer || {}), watching: on } }); setFlash(t(on ? 'watchAdded' : 'watchRemoved')); setTimeout(() => setFlash(''), 2200); }
  };
  const share = () => { if (L) Share.share({ message: L.title + ' — ' + API + '/vault-item.html?id=' + L.id, url: API + '/vault-item.html?id=' + L.id }); };

  const bid = async () => {
    const c = parseEuro(amount);
    if (!(c > 0)) return setMsg(t('e_bid_input') !== 'e_bid_input' ? t('e_bid_input') : t('e_generic'));
    setBusy(true);
    const r = await market('bid', { body: { id: L!.id, max: c / 100 } });
    setBusy(false);
    if (!r.ok) { tap('warn'); return setMsg(errText(i18n, r)); }
    tap(r.data.leading ? 'success' : 'warn');
    setSheet(''); setFlash(t(r.data.leading ? 'bidLeading' : 'bidOutbid')); setTimeout(() => setFlash(''), 3500);
    load();
  };
  const buy = async () => {
    setBusy(true);
    const r = await market('buy', { body: { id: L!.id } });
    setBusy(false);
    if (!r.ok) { tap('warn'); return setMsg(errText(i18n, r)); }
    tap('success'); setSheet('');
    router.push('/order/' + r.data.orderId);
  };
  const offer = async () => {
    const c = parseEuro(amount);
    if (!(c > 0)) return setMsg(t('e_generic'));
    setBusy(true);
    const r = await market('offer', { body: { id: L!.id, amount: c / 100, message: note.trim() } });
    setBusy(false);
    if (!r.ok) { tap('warn'); return setMsg(errText(i18n, r)); }
    tap('success'); setSheet(''); setFlash(t('offerSent')); setTimeout(() => setFlash(''), 3500);
    load();
  };

  const top = (
    <View style={[s.topBar, { top: insets.top + 6 }]}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/vault'))} style={s.round} accessibilityRole="button" accessibilityLabel={t('backToVault')}>
        <Icon name="left" size={20} color="#fff" />
      </Pressable>
      {L ? (
        <Row gap={10}>
          <Pressable onPress={share} style={s.round} accessibilityRole="button" accessibilityLabel={t('congShare')}><Icon name="upload" size={18} color="#fff" /></Pressable>
          <Pressable onPress={watch} style={s.round} accessibilityRole="button" accessibilityLabel={t(L.viewer?.watching ? 'watching' : 'watch')}>
            <Icon name="heart" size={19} color={L.viewer?.watching ? C.red : '#fff'} stroke={L.viewer?.watching ? 2.4 : 1.8} />
          </Pressable>
        </Row>
      ) : null}
    </View>
  );

  if (gone) return <SafeAreaView style={s.screen}>{top}<View style={{ marginTop: 90 }}><Empty icon="vault" title={t('goneT')} text={t('gone')}>
    <Button title={t('backToVault')} kind="ghost" onPress={() => router.replace('/(tabs)/vault')} /></Empty></View></SafeAreaView>;
  if (!L) return <View style={[s.screen, { justifyContent: 'center' }]}>{top}<ActivityIndicator color={C.gold} /></View>;

  const auction = L.format === 'auction', live = L.status === 'live';
  const own = L.viewer?.role === 'seller';
  const paused = config?.paused;
  const r = L.seller.rating || { pos: 0, neu: 0, neg: 0, score: null };
  const nr = r.pos + r.neu + r.neg;

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 150 }}>
        <View style={{ paddingTop: insets.top }}><Gallery photos={L.photos} height={Math.min(width * 0.86, 520)} /></View>
        <View style={s.pad}>
          <Eyebrow>{L.brand}</Eyebrow>
          <H1 style={{ marginTop: 6, fontSize: 38, lineHeight: 40 }}>{L.model}</H1>
          <Row style={{ flexWrap: 'wrap', marginTop: S.md }} gap={7}>
            <Chip text={'EU ' + L.size} /><Chip text={t('cond_' + L.cond)} /><TierBadge tier={L.tier} />
            {!live ? <Chip text={t('st_' + L.status)} tone={L.status === 'sold' ? 'ok' : L.status === 'review' ? 'warn' : ''} /> : null}
            {L.watchers ? <Chip text={tn('watchers', L.watchers)} icon="heart" /> : null}
          </Row>

          {flash ? <View style={s.flash}><Icon name="check" size={16} color="#6ee7a0" /><Text style={s.flashText}>{flash}</Text></View> : null}

          <Card style={{ marginTop: S.lg }} gold={L.tier === 'lab'}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View>
                <Text style={s.k}>{auction ? (L.bids ? t('currentBid') : t('startingBid')) : t('price')}</Text>
                <Text style={s.price}>{money(L.price)}</Text>
                {auction ? <Text style={s.sub}>{tn('bids', L.bids)}</Text> : L.acceptOffers ? <Text style={s.sub}>{t('orBestOffer')}</Text> : null}
              </View>
              {auction && live && L.endsAt ? <View style={{ alignItems: 'flex-end' }}><Text style={s.k}>{t('timeLeft')}</Text><Countdown endsAt={L.endsAt} style={{ marginTop: 6 }} /></View> : null}
            </Row>
            {auction && L.viewer?.highBidder ? <View style={[s.flash, { marginTop: S.md }]}><Icon name="check" size={16} color="#6ee7a0" />
              <Text style={s.flashText}>{t('youLead')} {L.viewer.myMax ? t('yourMaxIs', { amount: money(L.viewer.myMax, true) }) : ''}</Text></View> : null}
            {own ? <Body muted small style={{ marginTop: S.md }}>{t('ownLive')}</Body> : null}
            {live && !own ? (
              paused ? <Body small muted style={{ marginTop: S.md }}>{t(paused.hold ? 'pausedHold' : 'pausedTrading')}</Body> : (
                <View style={{ gap: 10, marginTop: S.lg }}>
                  {auction ? <Button title={t('placeBid')} icon="gavel" onPress={() => open('bid')} /> : null}
                  {L.binAvailable && L.buyNow ? <Button title={t('buyNowFor', { amount: money(L.buyNow) })} kind={auction ? 'ghost' : 'red'} onPress={() => open('buy')} /> : null}
                  {!auction && L.acceptOffers ? <Button title={t('makeOffer')} kind="ghost" onPress={() => open('offer')} /> : null}
                </View>
              )
            ) : null}
            <View style={s.lines}>
              <Line k={t('lineAuth') + ' · ' + t(L.tier === 'lab' ? 'tierLab' : 'tierPhoto')} v={money(L.fees.auth, true)} />
              <Line k={t('lineShip')} v={money(L.fees.shipping, true)} />
            </View>
            <Row style={{ marginTop: S.md, alignItems: 'flex-start' }} gap={8}>
              <Icon name="shield" size={15} color={C.goldHi} />
              <Body small muted style={{ flex: 1 }}>{t('sellerProtect')}</Body>
            </Row>
          </Card>

          {L.description ? <View style={{ marginTop: S.xl }}><H3>{t('description')}</H3><Body muted style={{ marginTop: 6 }}>{L.description}</Body></View> : null}

          <Card style={{ marginTop: S.xl }}>
            <H3>{t('seller')}</H3>
            <Row style={{ marginTop: S.md }} gap={12}>
              <View style={s.avatar}><Text style={s.avatarText}>{(L.seller.name || '?').split(' ').map((x) => x[0]).join('').slice(0, 2)}</Text></View>
              <View style={{ flex: 1 }}>
                <Row gap={8} style={{ flexWrap: 'wrap' }}><Text style={s.sellerName}>{L.seller.name}</Text>{L.seller.verified ? <Chip text={t('verifiedSeller')} tone="ok" icon="shield" /> : null}</Row>
                <Text style={s.sub}>{t('memberSince', { date: date(L.seller.since) })} · {tn('sales', L.seller.sales || 0)}</Text>
                <Text style={s.sub}>{nr ? t('positive', { pct: r.score == null ? '—' : r.score, n: nr }) : t('noRatings')}</Text>
              </View>
            </Row>
          </Card>

          {auction ? (
            <View style={{ marginTop: S.xl }}>
              <H3>{t('bidHistory')}</H3>
              {L.bidHistory.length ? L.bidHistory.slice(0, 12).map((h, k) => (
                <Row key={k} style={s.hist}><Text style={s.histWho}>{h.who}{h.auto ? ' · auto' : ''}</Text><Text style={s.histAmt}>{money(h.amount, true)}</Text><Text style={s.histAt}>{ago(h.at)}</Text></Row>
              )) : <Body muted small style={{ marginTop: 6 }}>{t('noBids', { amount: money(L.startPrice ?? L.price, true) })}</Body>}
            </View>
          ) : null}

          {!own && ['review', 'rejected', 'removed'].indexOf(L.status) === -1 ? (
            <Pressable onPress={() => open('report')} style={s.report} accessibilityRole="button">
              <Icon name="flag" size={14} color={C.muted} /><Text style={s.reportText}>{t('rpListing')}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
      {top}

      <Sheet open={sheet === 'bid'} onClose={() => setSheet('')} title={t('placeBid')}>
        <Body muted small>{t('confirmBidNote')}</Body>
        <Text style={[s.k, { marginTop: S.lg }]}>{t('yourMaxBid')}</Text>
        <AmountInput value={amount} onChange={setAmount} />
        {L.minNext ? <Body small muted>{t('e_bid_low', { amount: money(L.minNext, true) })}</Body> : null}
        {msg ? <Text style={s.err}>{msg}</Text> : null}
        <Button title={t('confirmBid')} busy={busy} onPress={bid} style={{ marginTop: S.lg, marginBottom: S.md }} />
      </Sheet>
      <Sheet open={sheet === 'buy'} onClose={() => setSheet('')} title={t('buyTitle')}>
        <Body>{L.title}</Body>
        <View style={s.lines}>
          <Line k={t('lineItem')} v={money(L.buyNow || L.price, true)} />
          <Line k={t('lineAuth')} v={money(L.fees.auth, true)} />
          <Line k={t('lineShip')} v={money(L.fees.shipping, true)} />
          <Line k={t('lineTotal')} v={money((L.buyNow || L.price) + L.fees.auth + L.fees.shipping, true)} bold />
        </View>
        <Body small muted style={{ marginTop: S.md }}>{t('payWithin')}</Body>
        {msg ? <Text style={s.err}>{msg}</Text> : null}
        <Button title={t('buyNowFor', { amount: money(L.buyNow || L.price) })} busy={busy} onPress={buy} style={{ marginTop: S.lg, marginBottom: S.md }} />
      </Sheet>
      <Sheet open={sheet === 'offer'} onClose={() => setSheet('')} title={t('offerT')}>
        <Body muted small>{t('offerLead', { price: money(L.buyNow || L.price) })}</Body>
        <Text style={[s.k, { marginTop: S.lg }]}>{t('yourOffer')}</Text>
        <AmountInput value={amount} onChange={setAmount} />
        <Text style={[s.k, { marginTop: S.md }]}>{t('offerMsg')}</Text>
        <TextInput value={note} onChangeText={setNote} placeholder={t('offerMsgPh')} placeholderTextColor={C.muted} multiline maxLength={300} style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]} />
        <Body small muted>{t('offerNote')}</Body>
        {msg ? <Text style={s.err}>{msg}</Text> : null}
        <Button title={t('sendOffer')} busy={busy} onPress={offer} style={{ marginTop: S.lg, marginBottom: S.md }} />
      </Sheet>
      <ReportSheet open={sheet === 'report'} onClose={() => setSheet('')} kind="listing" id={L.id} title={L.title + ' · EU ' + L.size} />
    </View>
  );
}

function Line({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <Row style={{ justifyContent: 'space-between', paddingVertical: 5 }}><Text style={[s.lineK, bold && { color: C.text, fontFamily: F.semibold }]}>{k}</Text><Text style={[s.lineV, bold && { fontFamily: F.bold }]}>{v}</Text></Row>;
}
export function AmountInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={s.amount}>
      <Text style={s.euro}>€</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.muted} style={s.amountIn} autoFocus accessibilityLabel="€" />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.black },
  pad: { paddingHorizontal: S.lg, paddingTop: S.xl },
  topBar: { position: 'absolute', left: S.lg, right: S.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  k: { fontFamily: F.medium, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: C.muted2 },
  price: { fontFamily: F.display, fontSize: 46, color: C.text, marginTop: 2 },
  sub: { fontFamily: F.regular, fontSize: 12.5, color: C.muted, marginTop: 3 },
  lines: { marginTop: S.lg, paddingTop: S.md, borderTopWidth: 1, borderTopColor: C.border },
  lineK: { fontFamily: F.regular, fontSize: 13.5, color: C.muted2 }, lineV: { fontFamily: F.medium, fontSize: 13.5, color: C.text },
  flash: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.okSoft, borderColor: 'rgba(34,197,94,0.35)', borderWidth: 1, borderRadius: R.md, padding: 12, marginTop: S.md },
  flashText: { fontFamily: F.medium, fontSize: 13.5, color: '#bff5d2', flex: 1 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.card3, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.borderHi },
  avatarText: { fontFamily: F.bold, fontSize: 14, color: C.text },
  sellerName: { fontFamily: F.semibold, fontSize: 15.5, color: C.text },
  hist: { justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  histWho: { fontFamily: F.medium, fontSize: 13.5, color: C.text, flex: 1 }, histAmt: { fontFamily: F.semibold, fontSize: 13.5, color: C.text, width: 90, textAlign: 'right' },
  histAt: { fontFamily: F.regular, fontSize: 12, color: C.muted, width: 90, textAlign: 'right' },
  report: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: S.xxl, padding: 8 },
  reportText: { fontFamily: F.medium, fontSize: 12.5, color: C.muted },
  err: { fontFamily: F.medium, fontSize: 13.5, color: '#ff9a9a', marginTop: S.md },
  amount: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.black, borderWidth: 1, borderColor: C.goldLine, borderRadius: R.md, paddingHorizontal: 16, marginTop: 8, marginBottom: 8 },
  euro: { fontFamily: F.display, fontSize: 32, color: C.goldHi, marginRight: 8 },
  amountIn: { flex: 1, fontFamily: F.display, fontSize: 38, color: C.text, paddingVertical: 10 },
  input: { backgroundColor: C.black, borderWidth: 1, borderColor: C.borderHi, borderRadius: R.md, padding: 12, fontFamily: F.regular, fontSize: 15, color: C.text, marginTop: 8, marginBottom: 8 },
});
