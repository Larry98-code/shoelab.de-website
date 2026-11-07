import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { abs, api, market } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { errText } from '../../lib/errors';
import { parseEuro } from '../../lib/money';
import type { ListingCard as Card } from '../../lib/types';
import { ListingCard } from '../../components/ListingCard';
import { Icon } from '../../components/Icon';
import { Body, Button, Card as Box, Chip, Empty, Eyebrow, H1, H3, Row, Screen, tap } from '../../components/ui';
import { C, F, R, S } from '../../theme';

type Order = { id: number; title: string; photo: string | null; status: string; total: number; payout?: number; role: string; createdAt: string };
type Offer = { id: number; listingId: number; title: string; size: string; listPrice: number; amount: number; counter: number | null; message: string | null; status: string; expiresAt: string; buyer?: string };
type MeData = {
  user: { name: string; email: string; verified: boolean };
  standing: { status: string; until: string | null; noSell: string | null; noBuy: string | null; hidden: boolean };
  seller: null | { connected: boolean; ready: boolean; payouts: boolean };
  selling: { listings: (Card & { openOffers: number })[]; offers: Offer[]; orders: Order[] };
  buying: { bids: (Card & { myMax: number; leading: boolean })[]; offers: Offer[]; orders: Order[] };
  watching: Card[];
};
const OS_TONE: Record<string, 'ok' | 'warn' | 'bad' | 'gold' | ''> = { awaiting_payment: 'warn', paid: 'gold', shipped: 'gold', delivered: 'ok', disputed: 'bad', failed: 'bad' };

export default function Me() {
  const i18n = useI18n();
  const { t, money, ago, date } = i18n;
  const { me } = useAuth();
  const { width } = useWindowDimensions();
  const [d, setD] = useState<MeData | null>(null);
  const [tab, setTab] = useState<'buying' | 'selling' | 'watch'>('buying');
  const [refreshing, setRefreshing] = useState(false), [msg, setMsg] = useState(''), [sent, setSent] = useState(false);
  const [counter, setCounter] = useState<Record<number, string>>({}), [busy, setBusy] = useState('');
  const load = useCallback(async () => { if (!me) { setD(null); return; } const r = await market<MeData>('me'); if (r.ok) setD(r.data); }, [me]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const header = (
    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <View style={{ flex: 1 }}>
        <Eyebrow color={C.gold}>{t('navMine')}</Eyebrow>
        <H1 style={{ marginTop: 6 }}>{me ? me.name.split(' ')[0] : t('meGuestT')}</H1>
      </View>
      <Pressable onPress={() => router.push('/settings')} style={s.gear} accessibilityRole="button" accessibilityLabel={t('meSettings')}><Icon name="settings" size={20} color={C.text} /></Pressable>
    </Row>
  );
  if (!me) {
    return (
      <Screen>
        {header}
        <Box style={{ marginTop: S.xl }} gold>
          <Body muted>{t('meGuestP')}</Body>
          <Button title={t('signIn')} onPress={() => router.push('/auth')} style={{ marginTop: S.lg }} />
        </Box>
      </Screen>
    );
  }
  const respond = async (o: Offer, action: string) => {
    let amount: number | undefined;
    if (action === 'counter') { const c = parseEuro(counter[o.id] || ''); if (!(c > 0)) return setMsg(t('e_counter_range')); amount = c / 100; }
    setBusy(o.id + action); setMsg('');
    const r = await market('offer/respond', { body: { offerId: o.id, action, amount } });
    setBusy('');
    if (!r.ok) { tap('warn'); return setMsg(errText(i18n, r)); }
    tap('success');
    if (r.data.orderId) router.push('/order/' + r.data.orderId); else load();
  };
  const payouts = async () => {
    const r = await market(d?.seller?.connected ? 'payouts/dashboard' : 'payouts/setup', { body: {} });
    if (r.ok && r.data.url) { await WebBrowser.openBrowserAsync(r.data.url); load(); } else setMsg(errText(i18n, r));
  };
  const st = d?.standing;
  const orderRow = (o: Order) => (
    <Pressable key={'o' + o.id} onPress={() => { tap('select'); router.push('/order/' + o.id); }} style={s.row} accessibilityRole="button">
      <View style={s.thumb}>{o.photo ? <Image source={{ uri: abs(o.photo) }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowT} numberOfLines={1}>{o.title}</Text>
        <Row gap={6} style={{ marginTop: 5 }}><Chip text={t('os_' + o.status)} tone={OS_TONE[o.status] || ''} /><Text style={s.rowS}>{t('orderNo', { n: o.id })}</Text></Row>
      </View>
      <Text style={s.amt}>{money(o.role === 'seller' ? o.payout ?? o.total : o.total, true)}</Text>
    </Pressable>
  );

  return (
    <Screen refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      {header}
      <Text style={s.email}>{me.email}</Text>
      {d && !d.user.verified ? (
        <Box style={{ marginTop: S.lg }}>
          <Row gap={10} style={{ alignItems: 'flex-start' }}><Icon name="mail" size={18} color={C.goldHi} /><Body small style={{ flex: 1 }}>{t(sent ? 'verifySent' : 'verifyBar', { email: me.email })}</Body></Row>
          {!sent ? <Button small kind="gold" title={t('verifyResend')} style={{ marginTop: S.md }} onPress={async () => { await api('/api/account/resend-verification', { body: { next: '/vault-me.html' } }); setSent(true); }} /> : null}
        </Box>
      ) : null}
      {st && (st.status === 'suspended' || st.noSell || st.noBuy || st.hidden) ? (
        <View style={s.standing}><Icon name="alert" size={18} color="#ff9a9a" /><Body small style={{ flex: 1 }}>
          {st.status === 'suspended' ? (st.until ? t('standSuspendedUntil', { date: date(st.until) }) : t('standSuspended')) :
            [st.noSell ? (st.noSell !== 'open' ? t('standNoSellUntil', { date: date(st.noSell) }) : t('standNoSell')) : '', st.noBuy ? (st.noBuy !== 'open' ? t('standNoBuyUntil', { date: date(st.noBuy) }) : t('standNoBuy')) : '', st.hidden ? t('standHidden') : ''].filter(Boolean).join(' ')}
          {' '}{t('standEmail')}</Body></View>
      ) : null}

      <View style={s.seg}>
        {([['buying', 'tabBuying'], ['selling', 'tabSelling'], ['watch', 'watchlist']] as const).map(([k, label]) => (
          <Pressable key={k} onPress={() => { tap('select'); setTab(k); }} style={[s.segB, tab === k && s.segOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}>
            <Text style={[s.segT, tab === k && { color: '#111' }]}>{t(label)}</Text>
          </Pressable>
        ))}
      </View>
      {msg ? <Text style={s.err}>{msg}</Text> : null}
      {!d ? <ActivityIndicator color={C.gold} style={{ marginTop: 30 }} /> : tab === 'buying' ? (
        <View>
          {!d.buying.orders.length && !d.buying.bids.length && !d.buying.offers.length ? <Empty icon="box" title={t('emptyBuyingT')} text={t('emptyBuying')}>
            <Button title={t('navBrowse')} kind="ghost" onPress={() => router.push('/(tabs)/vault')} /></Empty> : null}
          {d.buying.orders.length ? <><H3 style={s.h}>{t('mePurchases')}</H3>{d.buying.orders.map(orderRow)}</> : null}
          {d.buying.bids.length ? <><H3 style={s.h}>{t('bidsTitle')}</H3>{d.buying.bids.map((b) => (
            <Pressable key={'b' + b.id} onPress={() => router.push('/listing/' + b.id)} style={s.row}>
              <View style={s.thumb}>{b.photo ? <Image source={{ uri: abs(b.photo) }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
              <View style={{ flex: 1 }}><Text style={s.rowT} numberOfLines={1}>{b.title}</Text>
                <Row gap={6} style={{ marginTop: 5 }}><Chip text={t(b.status !== 'live' ? (b.leading ? 'bidWon' : 'bidLost') : b.leading ? 'bidWinning' : 'bidOutbidChip')} tone={b.leading ? 'ok' : 'bad'} />
                  <Text style={s.rowS}>{t('yourMaxIs', { amount: money(b.myMax, true) })}</Text></Row></View>
              <Text style={s.amt}>{money(b.price)}</Text>
            </Pressable>))}</> : null}
          {d.buying.offers.length ? <><H3 style={s.h}>{t('offersSent')}</H3>{d.buying.offers.map((o) => (
            <Box key={'f' + o.id} style={{ marginBottom: S.md }}>
              <Pressable onPress={() => router.push('/listing/' + o.listingId)}><Text style={s.rowT}>{o.title}</Text></Pressable>
              <Row gap={6} style={{ marginTop: 6 }}><Chip text={t('of_' + o.status)} tone={o.status === 'accepted' ? 'ok' : o.status === 'countered' ? 'gold' : ''} />
                <Text style={s.rowS}>{money(o.amount, true)}{o.counter ? ' → ' + money(o.counter, true) : ''}</Text></Row>
              {o.status === 'countered' ? <Row gap={8} style={{ marginTop: S.md }}>
                <Button small kind="ok" title={t('acceptAmount', { amount: money(o.counter!) })} busy={busy === o.id + 'accept'} onPress={() => respond(o, 'accept')} style={{ flex: 1 }} />
                <Button small kind="ghost" title={t('decline')} busy={busy === o.id + 'decline'} onPress={() => respond(o, 'decline')} /></Row> : null}
              {o.status === 'pending' ? <Button small kind="ghost" title={t('withdrawOffer')} busy={busy === o.id + 'withdraw'} onPress={() => respond(o, 'withdraw')} style={{ marginTop: S.md }} /> : null}
            </Box>))}</> : null}
        </View>
      ) : tab === 'selling' ? (
        <View>
          {d.seller && !d.seller.payouts ? (
            <Box gold style={{ marginBottom: S.lg }}>
              <H3>{t('mePayoutsT')}</H3><Body small muted style={{ marginTop: 4 }}>{t('mePayoutsP')}</Body>
              <Button small kind="gold" title={t(d.seller.connected ? 'mePayoutsContinue' : 'mePayoutsBtn')} onPress={payouts} style={{ marginTop: S.md }} />
            </Box>
          ) : null}
          {d.selling.offers.filter((o) => o.status === 'pending').length ? <><H3 style={s.h}>{t('offersToAnswer')}</H3>
            {d.selling.offers.filter((o) => o.status === 'pending').map((o) => (
              <Box key={'r' + o.id} gold style={{ marginBottom: S.md }}>
                <Text style={s.rowT}>{o.title}</Text>
                <Text style={[s.amt, { marginTop: 4, textAlign: 'left' }]}>{money(o.amount, true)} <Text style={s.rowS}>{o.buyer ? t('offerFrom', { name: o.buyer }) : ''} · {ago(o.expiresAt)}</Text></Text>
                {o.message ? <Body small muted style={{ marginTop: 4 }}>“{o.message}”</Body> : null}
                <Row gap={8} style={{ marginTop: S.md }}>
                  <Button small kind="ok" title={t('accept')} busy={busy === o.id + 'accept'} onPress={() => respond(o, 'accept')} style={{ flex: 1 }} />
                  <Button small kind="ghost" title={t('decline')} busy={busy === o.id + 'decline'} onPress={() => respond(o, 'decline')} style={{ flex: 1 }} />
                </Row>
                <Row gap={8} style={{ marginTop: 8 }}>
                  <TextInput value={counter[o.id] || ''} onChangeText={(v) => setCounter({ ...counter, [o.id]: v })} keyboardType="decimal-pad" placeholder={t('counterPh')} placeholderTextColor={C.muted} style={s.input} />
                  <Button small kind="gold" title={t('counter')} busy={busy === o.id + 'counter'} onPress={() => respond(o, 'counter')} />
                </Row>
              </Box>))}</> : null}
          {d.selling.orders.length ? <><H3 style={s.h}>{t('sales')}</H3>{d.selling.orders.map(orderRow)}</> : null}
          <H3 style={s.h}>{t('yourListings')}</H3>
          {d.selling.listings.length ? d.selling.listings.map((l) => (
            <Pressable key={'l' + l.id} onPress={() => router.push('/listing/' + l.id)} style={s.row}>
              <View style={s.thumb}>{l.photo ? <Image source={{ uri: abs(l.photo) }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
              <View style={{ flex: 1 }}><Text style={s.rowT} numberOfLines={1}>{l.title}</Text>
                <Row gap={6} style={{ marginTop: 5 }}><Chip text={t('st_' + l.status)} tone={l.status === 'live' ? 'ok' : l.status === 'review' ? 'warn' : l.status === 'sold' ? 'gold' : ''} />
                  <Text style={s.rowS}>EU {l.size}</Text></Row></View>
              <Text style={s.amt}>{money(l.price)}</Text>
            </Pressable>
          )) : <Empty icon="tag" title={t('emptySellingT')} text={t('emptySelling')}><Button title={t('homeSellBtn')} onPress={() => router.push('/(tabs)/sell')} /></Empty>}
        </View>
      ) : (
        d.watching.length ? <View style={s.grid}>{d.watching.map((w) => <ListingCard key={w.id} it={w} width={(Math.min(width, 640) - S.lg * 2 - 14) / 2} />)}</View>
          : <Empty icon="heart" title={t('emptyWatchT')} text={t('emptyWatch')} />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  gear: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  email: { fontFamily: F.regular, fontSize: 13.5, color: C.muted, marginTop: 4 },
  standing: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: S.lg, padding: 14, borderRadius: R.md, backgroundColor: C.badSoft, borderWidth: 1, borderColor: 'rgba(255,77,77,0.3)' },
  seg: { flexDirection: 'row', backgroundColor: C.card, borderRadius: R.pill, padding: 4, marginTop: S.xl, marginBottom: S.md, borderWidth: 1, borderColor: C.border },
  segB: { flex: 1, paddingVertical: 10, borderRadius: R.pill, alignItems: 'center' },
  segOn: { backgroundColor: C.goldHi },
  segT: { fontFamily: F.semibold, fontSize: 13, color: C.muted2 },
  h: { marginTop: S.lg, marginBottom: S.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border },
  thumb: { width: 58, height: 52, borderRadius: 12, overflow: 'hidden', backgroundColor: C.card2 },
  rowT: { fontFamily: F.semibold, fontSize: 14.5, color: C.text },
  rowS: { fontFamily: F.regular, fontSize: 12, color: C.muted },
  amt: { fontFamily: F.display, fontSize: 21, color: C.text, textAlign: 'right' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, rowGap: 22 },
  input: { flex: 1, minWidth: 0, backgroundColor: C.black, borderWidth: 1, borderColor: C.borderHi, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 9, fontFamily: F.regular, fontSize: 14.5, color: C.text },
  err: { fontFamily: F.medium, fontSize: 13.5, color: '#ff9a9a', marginBottom: S.sm },
});
