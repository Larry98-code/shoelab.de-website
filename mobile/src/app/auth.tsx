import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { Body, Button, Eyebrow, H1, Screen, tap } from '../components/ui';
import { Icon } from '../components/Icon';
import { C, F, R, S } from '../theme';

// Sign in or create an account: one account for bookings, the Vault and the Legit Check.
export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const { t } = useI18n();
  const [mode, setMode] = useState<'in' | 'up'>('in');
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
    if (r.ok) { tap('success'); router.back(); return; }
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
        <View style={s.head}>
          <Pressable onPress={() => router.back()} accessibilityLabel={t('close')} hitSlop={12} style={s.x}><Icon name="x" size={20} color={C.text} /></Pressable>
        </View>
        <Eyebrow color={C.red}>ShoeLab</Eyebrow>
        <H1 style={{ marginTop: 8 }}>{mode === 'up' ? t('createAccount') : t('signIn')}</H1>
        <Body muted style={{ marginTop: 6, marginBottom: S.xl }}>{t('authLead')}</Body>
        {mode === 'up' ? <Field label={t('authName')} value={name} onChange={setName} auto="name" /> : null}
        <Field label={t('email')} value={email} onChange={setEmail} auto="email" keyboard="email-address" />
        <Field label={t('password')} value={pw} onChange={setPw} auto={mode === 'up' ? 'new-password' : 'password'} secure onSubmit={go} />
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

function Field({ label, value, onChange, auto, keyboard, secure, onSubmit }: {
  label: string; value: string; onChange: (v: string) => void; auto?: 'name' | 'email' | 'password' | 'new-password'; keyboard?: 'email-address'; secure?: boolean; onSubmit?: () => void;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: S.md }}>
      <Text style={s.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} autoComplete={auto} keyboardType={keyboard} secureTextEntry={secure}
        autoCapitalize={auto === 'name' ? 'words' : 'none'} autoCorrect={false} onSubmitEditing={onSubmit} returnKeyType={onSubmit ? 'go' : 'next'}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} placeholderTextColor={C.muted}
        style={[s.input, focus && { borderColor: C.goldLine }]} accessibilityLabel={label} />
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: S.lg },
  x: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: F.medium, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: C.muted2, marginBottom: 7 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.borderHi, borderRadius: R.md, paddingHorizontal: 15, paddingVertical: 14, fontFamily: F.regular, fontSize: 16, color: C.text },
  msg: { fontFamily: F.medium, fontSize: 13.5, color: '#ff9a9a', marginBottom: S.sm },
  link: { fontFamily: F.semibold, fontSize: 13, color: C.goldHi, textAlign: 'center' },
  switch: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: S.xxl, flexWrap: 'wrap' },
  switchQ: { fontFamily: F.regular, fontSize: 13, color: C.muted2 },
});
