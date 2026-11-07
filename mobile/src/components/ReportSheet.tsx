import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { market } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { errText } from '../lib/errors';
import { C, F, R, S } from '../theme';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Body, Button, Empty, tap } from './ui';

const REASONS = ['counterfeit', 'misleading', 'prohibited', 'offplatform', 'fraud', 'abuse', 'other'];

// Report a listing, or the other side of an order (EU Digital Services Act, Art. 16):
// the same form as the website; the team answers by email.
export function ReportSheet({ open, onClose, kind, id, orderId, title }: { open: boolean; onClose: () => void; kind: 'listing' | 'user'; id: number; orderId?: number; title: string }) {
  const i18n = useI18n();
  const { t } = i18n;
  const { me } = useAuth();
  const [reason, setReason] = useState(''), [details, setDetails] = useState(''), [name, setName] = useState(''), [email, setEmail] = useState('');
  const [accurate, setAccurate] = useState(false), [busy, setBusy] = useState(false), [msg, setMsg] = useState(''), [done, setDone] = useState(false);
  const close = () => { onClose(); setTimeout(() => { setDone(false); setReason(''); setDetails(''); setAccurate(false); setMsg(''); }, 300); };
  const send = async () => {
    if (!reason) return setMsg(t('e_rp_reason'));
    if (details.trim().length < 15) return setMsg(t('e_rp_details'));
    if (!me && !name.trim()) return setMsg(t('e_name'));
    if (!me && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setMsg(t('e_email'));
    if (!accurate) return setMsg(t('e_rp_accurate'));
    setBusy(true);
    const r = await market('report', { body: { kind, id, orderId, reason, details: details.trim(), accurate, name: name.trim(), email: email.trim(), lang: i18n.lang } });
    setBusy(false);
    if (!r.ok) return setMsg(errText(i18n, r));
    tap('success'); setDone(true);
  };
  return (
    <Sheet open={open} onClose={close} title={t(kind === 'listing' ? 'rpTitleListing' : 'rpTitleMember')}>
      {done ? <Empty icon="check" title={t('rpThanksT')} text={t('rpThanksP')}><Button title={t('close')} kind="ghost" onPress={close} /></Empty> : (
        <View style={{ paddingBottom: S.lg }}>
          <Body muted small>{t(kind === 'listing' ? 'rpLeadListing' : 'rpLeadMember', { what: title })}</Body>
          <Text style={s.k}>{t('rpReason')}</Text>
          <View style={s.reasons}>
            {REASONS.map((k) => (
              <Pressable key={k} onPress={() => { tap('select'); setReason(k); }} style={[s.reason, reason === k && s.reasonOn]} accessibilityRole="radio" accessibilityState={{ checked: reason === k }}>
                <Text style={[s.reasonText, reason === k && { color: '#111' }]}>{t('rp_' + k)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.k}>{t('rpDetails')}</Text>
          <TextInput value={details} onChangeText={setDetails} multiline maxLength={2000} placeholder={t('rpDetailsPh')} placeholderTextColor={C.muted} style={[s.input, { minHeight: 96, textAlignVertical: 'top' }]} />
          {!me ? <>
            <Text style={s.k}>{t('rpName')}</Text>
            <TextInput value={name} onChangeText={setName} autoComplete="name" style={s.input} />
            <Text style={s.k}>{t('rpEmail')}</Text>
            <TextInput value={email} onChangeText={setEmail} autoComplete="email" keyboardType="email-address" autoCapitalize="none" style={s.input} />
          </> : null}
          <Pressable onPress={() => { tap('select'); setAccurate(!accurate); }} style={s.check} accessibilityRole="checkbox" accessibilityState={{ checked: accurate }}>
            <View style={[s.box, accurate && s.boxOn]}>{accurate ? <Icon name="check" size={14} color="#111" stroke={2.6} /> : null}</View>
            <Text style={s.checkText}>{t('rpAccurate')}</Text>
          </Pressable>
          <Body small muted style={{ marginTop: S.md }}>{t('rpPrivacy')}</Body>
          {msg ? <Text style={s.err}>{msg}</Text> : null}
          <Button title={t('rpSend')} kind="danger" busy={busy} onPress={send} style={{ marginTop: S.lg }} />
        </View>
      )}
    </Sheet>
  );
}
const s = StyleSheet.create({
  k: { fontFamily: F.medium, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: C.muted2, marginTop: S.lg, marginBottom: 8 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reason: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.pill, borderWidth: 1, borderColor: C.borderHi },
  reasonOn: { backgroundColor: '#f5f5f5', borderColor: '#f5f5f5' },
  reasonText: { fontFamily: F.medium, fontSize: 13, color: '#ddd' },
  input: { backgroundColor: C.black, borderWidth: 1, borderColor: C.borderHi, borderRadius: R.md, padding: 12, fontFamily: F.regular, fontSize: 15, color: C.text },
  check: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: S.lg },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: C.borderHi, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: C.goldHi, borderColor: C.goldHi },
  checkText: { flex: 1, fontFamily: F.regular, fontSize: 13.5, lineHeight: 19, color: C.text },
  err: { fontFamily: F.medium, fontSize: 13.5, color: '#ff9a9a', marginTop: S.md },
});
