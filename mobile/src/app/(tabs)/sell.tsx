import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { market } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { errText } from '../../lib/errors';
import { parseEuro } from '../../lib/money';
import { GuidedCamera, type Shot } from '../../components/GuidedCamera';
import { HoldCard } from '../../components/HoldCard';
import { Icon } from '../../components/Icon';
import { Body, Button, Card, Chip, Empty, Eyebrow, H1, H3, Row, Screen, tap } from '../../components/ui';
import { C, F, R, S } from '../../theme';

type Tier = 'photo' | 'lab';
const STEPS = ['sellStepTier', 'sellStepPhotos', 'sellStepDetails', 'sellStepPrice'];

// Selling in four steps; every listing is checked by a ShoeLab specialist before it goes live.
export default function Sell() {
  const i18n = useI18n();
  const { t, tn, money } = i18n;
  const { me, config } = useAuth();
  const { width } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const [tier, setTier] = useState<Tier>('photo');
  const [shots, setShots] = useState<Record<string, Shot>>({});
  const [camKind, setCamKind] = useState('');
  const [f, setF] = useState({ brand: '', model: '', size: '', cond: '', description: '' });
  const [fmt, setFmt] = useState<'fixed' | 'auction'>('fixed');
  const [price, setPrice] = useState(''), [offers, setOffers] = useState(true), [minOffer, setMinOffer] = useState('');
  const [duration, setDuration] = useState(7);
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState(''), [gate, setGate] = useState(false), [done, setDone] = useState<number | null>(null);

  const required: string[] = (config?.required && config.required[tier]) || (tier === 'photo' ? ['side_out', 'side_in', 'sole', 'size_tag', 'box_label', 'insole'] : ['side_out', 'side_in', 'size_tag']);
  const kinds: string[] = useMemo(() => {
    const all: string[] = (config?.photoKinds as string[]) || ['side_out', 'side_in', 'sole', 'size_tag', 'box_label', 'insole', 'heel', 'toe', 'other'];
    return required.concat(all.filter((k) => required.indexOf(k) === -1));
  }, [config, tier]);
  const missing = required.filter((k) => !shots[k]).length;
  const cents = parseEuro(price);
  const rate = (config?.commission as number) ?? 0.08, ship = (config?.shipping as number) ?? 699;
  const comm = cents > 0 ? Math.round(cents * rate) : 0;
  const payout = cents > 0 ? cents - comm + (tier === 'photo' ? ship : 0) : 0;
  const paused = config?.paused;
  const slotW = (Math.min(width, 640) - S.lg * 2 - 12) / 2;

  if (!me) return <Screen><Eyebrow color={C.red}>{t('sellEyebrow')}</Eyebrow><H1 style={{ marginTop: 6 }}>{t('homeSellT')}</H1>
    <Body muted style={{ marginTop: 8 }}>{t('homeSellP')}</Body><Button title={t('signIn')} onPress={() => router.push('/auth')} style={{ marginTop: S.xl }} /></Screen>;
  if (paused && (paused.hold || paused.trading || paused.listings)) return <Screen>{paused.hold ? <HoldCard /> : <Empty icon="clock" title={t(paused.trading ? 'pausedTrading' : 'pausedListings')} text={paused.notice || ''} />}</Screen>;
  if (done) return (
    <Screen><Empty icon="check" title={t('sellDoneT')} text={t('sellDoneP')}>
      <Button title={t('sellView')} onPress={() => router.push('/listing/' + done)} />
      <Button title={t('sellAnother')} kind="ghost" style={{ marginTop: S.md }} onPress={() => { setDone(null); setStep(0); setShots({}); setF({ brand: '', model: '', size: '', cond: '', description: '' }); setPrice(''); }} />
    </Empty></Screen>
  );

  const next = () => {
    setMsg('');
    if (step === 1 && missing) return setMsg(t('sellRequiredLeft', { n: missing }));
    if (step === 2) {
      if (!f.brand.trim() || !f.model.trim()) return setMsg(t('e_brand_model'));
      if (!/^\d{2}(\.5)?$/.test(f.size.trim().replace(',', '.'))) return setMsg(t('e_size'));
      if (!f.cond) return setMsg(t('e_cond'));
    }
    tap('select'); setStep(step + 1);
  };
  const submit = async () => {
    setMsg('');
    if (!(cents > 0)) return setMsg(t('e_priceInput'));
    setBusy(true);
    const body: Record<string, unknown> = {
      brand: f.brand.trim(), model: f.model.trim(), size: f.size.trim().replace(',', '.'), cond: f.cond, description: f.description.trim(), tier, format: fmt,
      photos: kinds.filter((k) => shots[k]).map((k) => ({ kind: k, data: shots[k].data, thumb: shots[k].thumb })),
    };
    if (fmt === 'fixed') { body.buyNow = cents / 100; body.acceptOffers = offers; if (offers && parseEuro(minOffer) > 0) body.minOffer = parseEuro(minOffer) / 100; }
    else { body.startPrice = cents / 100; body.duration = duration; }
    const r = await market('listings', { body });
    setBusy(false);
    if (r.ok) { tap('success'); setDone(r.data.id); return; }
    tap('warn');
    if (r.data?.code === 'seller_unverified') { setGate(true); return; }
    setMsg(errText(i18n, r));
  };
  const field = (k: keyof typeof f, label: string, ph?: string, opts?: { kb?: 'decimal-pad'; multi?: boolean }) => (
    <View style={{ marginBottom: S.md }}>
      <Text style={s.k}>{label}</Text>
      <TextInput value={f[k]} onChangeText={(v) => setF({ ...f, [k]: v })} placeholder={ph} placeholderTextColor={C.muted} keyboardType={opts?.kb} multiline={opts?.multi}
        maxLength={opts?.multi ? 2000 : 90} style={[s.input, opts?.multi && { minHeight: 110, textAlignVertical: 'top' }]} accessibilityLabel={label} />
    </View>
  );

  return (
    <Screen>
      <Eyebrow color={C.red}>{t('sellEyebrow')}</Eyebrow>
      <H1 style={{ marginTop: 6 }}>{t(STEPS[step])}</H1>
      <View style={s.steps}>{STEPS.map((_, i) => <View key={i} style={[s.stepBar, i <= step && { backgroundColor: i === step ? C.red : C.goldHi }]} />)}</View>

      {gate ? (
        <Card gold style={{ marginBottom: S.lg }}>
          <H3>{t('sellerGateT')}</H3><Body small muted style={{ marginTop: 4 }}>{t('sellerGateP')}</Body>
          <Button kind="gold" title={t('mePayoutsBtn')} style={{ marginTop: S.md }} onPress={async () => { const r = await market('payouts/setup', { body: {} }); if (r.ok && r.data.url) await WebBrowser.openBrowserAsync(r.data.url); }} />
        </Card>
      ) : null}

      {step === 0 ? (
        <View style={{ gap: S.md }}>
          {(['photo', 'lab'] as Tier[]).map((k) => (
            <Card key={k} gold={tier === k} onPress={() => setTier(k)} style={tier === k ? { backgroundColor: '#17140b' } : undefined}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row gap={10}><Icon name={k === 'lab' ? 'shield' : 'camera'} size={22} color={tier === k ? C.goldHi : C.muted2} /><H3>{t(k === 'lab' ? 'tierLab' : 'tierPhoto')}</H3></Row>
                <View style={[s.radio, tier === k && s.radioOn]}>{tier === k ? <View style={s.radioDot} /> : null}</View>
              </Row>
              <Body small muted style={{ marginTop: 8 }}>{t(k === 'lab' ? 'sellTierLab' : 'sellTierPhoto')}</Body>
              <View style={{ marginTop: 10 }}><Chip text={t('sellTierFee', { fee: money(((config?.fees as Record<string, number>) || {})[k] ?? (k === 'lab' ? 1290 : 490), true) })} tone="gold" /></View>
            </Card>
          ))}
          <Body small muted>{t('sellFreeNote')}</Body>
        </View>
      ) : step === 1 ? (
        <View>
          <Body small muted>{t('photosNeed', { n: required.length, tier: t(tier === 'lab' ? 'tierLab' : 'tierPhoto') })}</Body>
          <View style={s.grid}>
            {kinds.slice(0, (config?.maxPhotos as number) || 8).map((k) => {
              const sh = shots[k], req = required.indexOf(k) !== -1;
              return (
                <Pressable key={k} onPress={() => { tap('select'); setCamKind(k); }} style={[s.slot, { width: slotW, height: slotW * 0.82 }, !sh && s.slotEmpty, req && !sh && { borderColor: C.goldLine }]}
                  accessibilityRole="button" accessibilityLabel={t('kind_' + k)}>
                  {sh ? <Image source={{ uri: sh.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : (
                    <View style={{ alignItems: 'center', paddingHorizontal: 8 }}>
                      <Icon name="camera" size={24} color={req ? C.goldHi : C.muted} />
                      <Text style={s.slotT}>{t('kind_' + k)}</Text>
                      <Text style={s.slotS} numberOfLines={2}>{t('kindTip_' + k)}</Text>
                    </View>
                  )}
                  <View style={s.slotTag}><Text style={s.slotTagT}>{sh ? '✓ ' + t('kind_' + k) : req ? t('required') : t('optional')}</Text></View>
                </Pressable>
              );
            })}
          </View>
          {missing ? <Text style={s.left}>{t('sellRequiredLeft', { n: missing })}</Text> : null}
        </View>
      ) : step === 2 ? (
        <View>
          {field('brand', t('fBrand'), 'Nike')}
          {field('model', t('modelLabel'), t('modelPh'))}
          {field('size', t('fSize'), '42.5', { kb: 'decimal-pad' })}
          <Text style={s.k}>{t('fCond')}</Text>
          <View style={{ gap: 8, marginBottom: S.md }}>
            {((config?.conditions as string[]) || ['new', 'like_new', 'good', 'fair']).map((c) => (
              <Pressable key={c} onPress={() => { tap('select'); setF({ ...f, cond: c }); }} style={[s.cond, f.cond === c && s.condOn]} accessibilityRole="radio" accessibilityState={{ checked: f.cond === c }}>
                <Text style={[s.condT, f.cond === c && { color: C.goldHi }]}>{t('cond_' + c)}</Text>
                <Text style={s.condD}>{t('condD_' + c)}</Text>
              </Pressable>
            ))}
          </View>
          {field('description', t('description') + ' · ' + t('optional'), t('descPh'), { multi: true })}
        </View>
      ) : (
        <View>
          <View style={s.seg}>
            {(['fixed', 'auction'] as const).map((k) => (
              <Pressable key={k} onPress={() => { tap('select'); setFmt(k); }} style={[s.segB, fmt === k && s.segOn]} accessibilityRole="tab" accessibilityState={{ selected: fmt === k }}>
                <Text style={[s.segT, fmt === k && { color: '#111' }]}>{t(k === 'fixed' ? 'fFixed' : 'fAuction1')}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.k}>{fmt === 'fixed' ? t('price') : t('startPrice')}</Text>
          <View style={s.amount}><Text style={s.euro}>€</Text>
            <TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.muted} style={s.amountIn} accessibilityLabel={t('price')} /></View>
          {fmt === 'fixed' ? (
            <View>
              <Row style={{ justifyContent: 'space-between', marginTop: S.md }}><View style={{ flex: 1, paddingRight: 12 }}><H3>{t('acceptOffers')}</H3><Body small muted>{t('acceptOffersHelp')}</Body></View>
                <Switch value={offers} onValueChange={setOffers} trackColor={{ false: C.card3, true: C.gold }} thumbColor="#fff" /></Row>
              {offers ? <View style={{ marginTop: S.md }}><Text style={s.k}>{t('minOffer')} · {t('optional')}</Text>
                <TextInput value={minOffer} onChangeText={setMinOffer} keyboardType="decimal-pad" placeholder="€" placeholderTextColor={C.muted} style={s.input} /></View> : null}
            </View>
          ) : (
            <View>
              <Text style={[s.k, { marginTop: S.md }]}>{t('duration')}</Text>
              <Row gap={8} style={{ flexWrap: 'wrap' }}>{((config?.durations as number[]) || [3, 5, 7, 10]).map((d) => (
                <Pressable key={d} onPress={() => { tap('select'); setDuration(d); }} style={[s.dur, duration === d && s.durOn]}><Text style={[s.durT, duration === d && { color: '#111' }]}>{tn('days', d)}</Text></Pressable>
              ))}</Row>
            </View>
          )}
          <Card style={{ marginTop: S.xl }}>
            {cents > 0 ? <>
              <Body small muted>{t(fmt === 'auction' ? 'payoutIfStart' : 'payoutIfSold', { price: money(cents) })}</Body>
              <Line k={t('salePrice')} v={money(cents, true)} />
              <Line k={t('commissionPct', { pct: Math.round(rate * 1000) / 10 })} v={'−' + money(comm, true)} />
              {tier === 'photo' ? <Line k={t('postageBack')} v={'+' + money(ship, true)} /> : null}
              <Line k={t('youReceive')} v={money(payout, true)} bold />
            </> : <Body small muted>{t('payoutEmpty')}</Body>}
          </Card>
        </View>
      )}

      {msg ? <Text style={s.err}>{msg}</Text> : null}
      <Row gap={S.md} style={{ marginTop: S.xl }}>
        {step > 0 ? <Button title={t('sellBack')} kind="ghost" onPress={() => { setMsg(''); setStep(step - 1); }} style={{ flex: 1 }} /> : null}
        {step < 3 ? <Button title={t('sellNext')} onPress={next} style={{ flex: 2 }} /> : <Button title={t('submitReview')} busy={busy} onPress={submit} style={{ flex: 2 }} />}
      </Row>
      <GuidedCamera kind={camKind} open={!!camKind} onClose={() => setCamKind('')} onShot={(sh) => { setMsg(''); setShots((x) => ({ ...x, [sh.kind]: sh })); }} />
    </Screen>
  );
}

function Line({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <Row style={{ justifyContent: 'space-between', paddingVertical: 5 }}><Text style={[s.lineK, bold && { color: C.text, fontFamily: F.semibold }]}>{k}</Text><Text style={[s.lineV, bold && { fontFamily: F.bold, color: C.goldHi }]}>{v}</Text></Row>;
}

const s = StyleSheet.create({
  steps: { flexDirection: 'row', gap: 6, marginTop: S.md, marginBottom: S.xl },
  stepBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: C.card3 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.borderHi, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: C.goldHi }, radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.goldHi },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: S.lg },
  slot: { borderRadius: R.md, overflow: 'hidden', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  slotEmpty: { borderStyle: 'dashed' },
  slotT: { fontFamily: F.semibold, fontSize: 13, color: C.text, marginTop: 6 },
  slotS: { fontFamily: F.regular, fontSize: 11, color: C.muted, marginTop: 2, textAlign: 'center' },
  slotTag: { position: 'absolute', left: 6, top: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  slotTagT: { fontFamily: F.semibold, fontSize: 9.5, color: '#eee', letterSpacing: 0.6, textTransform: 'uppercase' },
  left: { fontFamily: F.medium, fontSize: 13, color: C.goldHi, marginTop: S.md },
  k: { fontFamily: F.medium, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: C.muted2, marginBottom: 7 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.borderHi, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 13, fontFamily: F.regular, fontSize: 15.5, color: C.text },
  cond: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 13 },
  condOn: { borderColor: C.goldLine, backgroundColor: '#17140b' },
  condT: { fontFamily: F.semibold, fontSize: 14.5, color: C.text }, condD: { fontFamily: F.regular, fontSize: 12.5, color: C.muted, marginTop: 2 },
  seg: { flexDirection: 'row', backgroundColor: C.card, borderRadius: R.pill, padding: 4, marginBottom: S.lg, borderWidth: 1, borderColor: C.border },
  segB: { flex: 1, paddingVertical: 10, borderRadius: R.pill, alignItems: 'center' }, segOn: { backgroundColor: C.goldHi },
  segT: { fontFamily: F.semibold, fontSize: 13.5, color: C.muted2 },
  amount: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.goldLine, borderRadius: R.md, paddingHorizontal: 16 },
  euro: { fontFamily: F.display, fontSize: 32, color: C.goldHi, marginRight: 8 },
  amountIn: { flex: 1, minWidth: 0, fontFamily: F.display, fontSize: 38, color: C.text, paddingVertical: 10 },
  dur: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: R.pill, borderWidth: 1, borderColor: C.borderHi },
  durOn: { backgroundColor: C.goldHi, borderColor: C.goldHi }, durT: { fontFamily: F.medium, fontSize: 13, color: '#ddd' },
  lineK: { fontFamily: F.regular, fontSize: 13.5, color: C.muted2 }, lineV: { fontFamily: F.medium, fontSize: 13.5, color: C.text },
  err: { fontFamily: F.medium, fontSize: 13.5, color: '#ff9a9a', marginTop: S.md },
});
