import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { Body, Button, Eyebrow, H1, Row, Screen, tap } from '../components/ui';
import { Appear } from '../components/motion';
import { Icon } from '../components/Icon';
import { C, F, R, S } from '../theme';

// Sign in or create an account: one account for bookings, the Vault and the Legit Check.
export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const { t } = useI18n();
  const p = useLocalSearchParams<{ mode?: string; why?: string }>();
  const [mode, setMode] = useState<'in' | 'up'>(p.mode === 'up' ? 'up' : 'in');
  const why = p.why && t(p.why) !== p.why ? t(p.why) : '';
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState(''), [note, setNote] = useState('');
  const go = async () => {
    setMsg('');
    if (mode === 'up' && !name.trim()) return setMsg(t('e_name'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setMsg(t('e_email'));
    if (mode === 'up' ? pw.length < 8 : !pw) return setMsg(t(mode === 'up' ? 'e_pwShort' : 'e_pw'));
    setBusy(true);
    const r = mode === 'up' ? await signUp(name.trim(), email.trim(), pw) : await signIn(email.trim(), pw);
    setBusy(false);
    // back to where they were; from the welcome screen, into the app
    if (r.ok) { tap('success'); if (router.canDismiss()) router.dismiss(); else router.replace('/'); return; }
    tap('warn');
    if (r.status === 401) return setMsg(t('e_login'));
    if (r.status === 409) return setMsg(t('e_exists'));
    if (r.status === 0) return setMsg(t('e_network'));
    setMsg(r.data && r.data.code && t('e_' + r.data.code) !== 'e_' + r.data.code ? t('e_' + r.data.code) : (r.data.error || t('e_generic')));
  };
  // a reset link by email; the same answer whether or not the account exists
  const forgot = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setMsg(t('authResetEmail'));
    await api('/api/account/forgot', { body: { email: email.trim() } });
    tap('success'); setMsg(''); setNote(t('authResetSent'));
  };
  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Row style={s.head}>
          <Image source={require('../../assets/mark.png')} style={s.mark} accessibilityIgnoresInvertColors />
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('close')} hitSlop={12} style={s.x}><Icon name="x" size={20} color={C.text} /></Pressable>
        </Row>
        <Appear>
          <Eyebrow color={C.redText}>ShoeLab</Eyebrow>
          <H1 style={{ marginTop: 8 }}>{mode === 'up' ? t('createAccount') : t('signIn')}</H1>
          <Body muted style={{ marginTop: 6 }}>{t('authLead')}</Body>
          {why ? <Row style={s.why} gap={10}><Icon name="info" size={16} color={C.goldHi} /><Text style={s.whyText}>{why}</Text></Row> : null}
        </Appear>
        <Appear i={1} style={{ marginTop: S.xl }}>
          {mode === 'up' ? <Field icon="user" label={t('authName')} value={name} onChange={setName} auto="name" /> : null}
          <Field icon="mail" label={t('email')} value={email} onChange={setEmail} auto="email" keyboard="email-address" />
          <Field icon="lock" label={t('password')} value={pw} onChange={setPw} auto={mode === 'up' ? 'new-password' : 'password'} secure onSubmit={go} />
        </Appear>
        {msg ? <Text style={s.msg} accessibilityRole="alert">{msg}</Text> : null}
        {note ? <Text style={[s.msg, { color: '#6ee7a0' }]}>{note}</Text> : null}
        <Button title={mode === 'up' ? t('createAccount') : t('signIn')} busy={busy} onPress={go} style={{ marginTop: S.md }} />
        {mode === 'in' ? (
          <Pressable onPress={forgot} style={{ marginTop: S.lg }}>
            <Text style={s.link}>{t('forgotPw')}</Text>
          </Pressable>
        ) : <Body muted small style={{ marginTop: S.md, textAlign: 'center' }}>{t('authTerms')}</Body>}
        <View style={s.switch}>
          <Text style={s.switchQ}>{mode === 'in' ? t('authNoAccount') : t('authHaveAccount')}</Text>
          <Pressable onPress={() => { tap('select'); setMsg(''); setMode(mode === 'in' ? 'up' : 'in'); }} hitSlop={8}>
            <Text style={s.link}>{mode === 'in' ? t('createAccount') : t('signIn')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Field({ label, value, onChange, auto, keyboard, secure, onSubmit, icon }: {
  label: string; value: string; onChange: (v: string) => void; auto?: 'name' | 'email' | 'password' | 'new-password'; keyboard?: 'email-address'; secure?: boolean; onSubmit?: () => void; icon: string;
}) {
  const { t } = useI18n();
  const [focus, setFocus] = useState(false), [show, setShow] = useState(false);
  return (
    <View style={{ marginBottom: S.md }}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.box, focus && s.boxOn]}>
        <Icon name={icon} size={18} color={focus ? C.goldHi : C.muted} />
        <TextInput value={value} onChangeText={onChange} autoComplete={auto} keyboardType={keyboard} secureTextEntry={secure && !show}
          autoCapitalize={auto === 'name' ? 'words' : 'none'} autoCorrect={false} onSubmitEditing={onSubmit} returnKeyType={onSubmit ? 'go' : 'next'}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} placeholderTextColor={C.muted} selectionColor={C.gold}
          style={s.input} accessibilityLabel={label} />
        {secure ? (
          <Pressable onPress={() => { tap('select'); setShow(!show); }} hitSlop={10} accessibilityRole="button" accessibilityLabel={t(show ? 'authHidePw' : 'authShowPw')}>
            <Icon name={show ? 'eyeOff' : 'eye'} size={19} color={C.muted2} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  head: { justifyContent: 'space-between', marginBottom: S.xl },
  mark: { width: 38, height: 38, borderRadius: 9 },
  why: { marginTop: S.md, backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldLine, borderRadius: R.md, padding: 12, alignItems: 'flex-start' },
  whyText: { flex: 1, fontFamily: F.medium, fontSize: 13.5, lineHeight: 19, color: C.amberText },
  box: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: C.card, borderWidth: 1, borderColor: C.borderHi, borderRadius: R.md, paddingHorizontal: 14 },
  boxOn: { borderColor: C.goldLine, backgroundColor: '#17150f' },
  x: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: F.medium, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: C.muted2, marginBottom: 7 },
  input: { flex: 1, paddingVertical: 14, fontFamily: F.regular, fontSize: 16, color: C.text },
  msg: { fontFamily: F.medium, fontSize: 13.5, color: '#ff9a9a', marginBottom: S.sm },
  link: { fontFamily: F.semibold, fontSize: 13, color: C.goldHi, textAlign: 'center' },
  switch: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: S.xxl, flexWrap: 'wrap' },
  switchQ: { fontFamily: F.regular, fontSize: 13, color: C.muted2 },
});
