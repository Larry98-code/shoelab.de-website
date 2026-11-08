import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { API } from '../lib/api';
import { useAuth } from '../lib/auth';
import { LANGS, LANG_NAMES, useI18n } from '../lib/i18n';
import { errText } from '../lib/errors';
import { disablePush, enablePush, pushEnabled } from '../lib/push';
import { Sheet } from '../components/Sheet';
import { Icon } from '../components/Icon';
import { Body, Button, Eyebrow, H1, ListItem, Screen, tap } from '../components/ui';
import { C, F, R, S } from '../theme';

export default function Settings() {
  const i18n = useI18n();
  const { t, lang, setLang } = i18n;
  const { me, bioLock, setBioLock, signOut, deleteAccount } = useAuth();
  const [push, setPush] = useState(false), [pushNote, setPushNote] = useState('');
  const [langOpen, setLangOpen] = useState(false), [delOpen, setDelOpen] = useState(false);
  const [pw, setPw] = useState(''), [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  useEffect(() => { pushEnabled().then(setPush); }, []);
  const web = (p: string) => WebBrowser.openBrowserAsync(API + p);
  const togglePush = async (on: boolean) => {
    setPushNote('');
    if (!on) { await disablePush(); setPush(false); return; }
    const r = await enablePush();
    setPush(r === 'on');
    if (r === 'denied') setPushNote(t('pushDenied'));
    if (r === 'unavailable') setPushNote(t('pushUnavailable'));
  };
  const del = async () => {
    if (!pw) return setMsg(t('e_pw'));
    setBusy(true); setMsg('');
    const r = await deleteAccount(pw);
    setBusy(false);
    if (!r.ok) { tap('warn'); return setMsg(r.data?.code === 'bad_password' ? t('e_login') : errText(i18n, r)); }
    setDelOpen(false); tap('success'); router.replace('/(tabs)');
  };
  const sw = (v: boolean, fn: (on: boolean) => void, label: string) => (
    <Switch value={v} onValueChange={(on) => { tap('select'); fn(on); }} trackColor={{ false: C.card3, true: C.gold }} thumbColor="#fff" accessibilityLabel={label} />
  );
  return (
    <Screen edges={['top', 'bottom']}>
      <Pressable onPress={() => router.back()} style={s.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10}><Icon name="left" size={22} color={C.text} /></Pressable>
      <Eyebrow>ShoeLab</Eyebrow>
      <H1 style={{ marginTop: 6, marginBottom: S.lg }}>{t('meSettings')}</H1>

      <View style={s.group}>
        {me ? <ListItem icon="bell" title={t('meNotifications')} sub={pushNote || t('meNotificationsP')} right={sw(push, togglePush, t('meNotifications'))} /> : null}
        {me && Platform.OS !== 'web' ? <ListItem icon="faceid" title={t(Platform.OS === 'ios' ? 'meFaceId' : 'meFaceIdAndroid')} sub={t('meFaceIdP')}
          right={sw(bioLock, async (on) => { await setBioLock(on); }, t('meFaceId'))} /> : null}
        <ListItem icon="globe" title={t('meLanguage')} sub={LANG_NAMES[lang]} onPress={() => setLangOpen(true)} />
      </View>

      {me ? <View style={s.group}>
        <ListItem icon="euro" title={t('mePayoutsT')} sub={t('mePayoutsP')} onPress={() => web('/vault-me.html#payouts')} />
      </View> : null}

      <Text style={s.label}>{t('meLegal')}</Text>
      <View style={s.group}>
        <ListItem icon="info" title={t('meTerms')} onPress={() => web('/vault-terms.html')} />
        <ListItem icon="lock" title={t('mePrivacy')} onPress={() => web('/datenschutz.html')} />
        <ListItem icon="home" title={t('meImprint')} onPress={() => web('/impressum.html')} />
        <ListItem icon="chat" title={t('homeContact')} onPress={() => Linking.openURL('mailto:Shoelab.de@gmail.com')} />
      </View>

      {me ? <View style={s.group}>
        <ListItem icon="logout" title={t('signOut')} onPress={async () => { await signOut(); router.replace('/(tabs)'); }} />
        <ListItem icon="trash" title={t('meDelete')} danger onPress={() => { setPw(''); setMsg(''); setDelOpen(true); }} />
      </View> : <Button title={t('signIn')} onPress={() => router.push('/auth')} style={{ marginTop: S.lg }} />}
      <View style={s.foot}>
        <Image source={require('../../assets/mark.png')} style={s.footMark} accessibilityIgnoresInvertColors />
        <Text style={s.footWord}>SHOE<Text style={{ color: C.red }}>LAB</Text></Text>
        <Text style={s.version}>{t('meVersion', { v: Constants.expoConfig?.version || '1.0.0' })} · Bremen</Text>
      </View>

      <Sheet open={langOpen} onClose={() => setLangOpen(false)} title={t('meLanguage')}>
        {LANGS.map((l) => (
          <Pressable key={l} onPress={() => { tap('select'); setLang(l); setLangOpen(false); }} style={s.langRow} accessibilityRole="radio" accessibilityState={{ checked: l === lang }}>
            <Text style={[s.langText, l === lang && { color: C.goldHi }]}>{LANG_NAMES[l]}</Text>
            {l === lang ? <Icon name="check" size={18} color={C.goldHi} /> : null}
          </Pressable>
        ))}
        <View style={{ height: S.lg }} />
      </Sheet>
      <Sheet open={delOpen} onClose={() => setDelOpen(false)} title={t('meDeleteT')}>
        <Body muted small>{t('meDeleteP')}</Body>
        <Text style={s.label}>{t('meDeletePw')}</Text>
        <TextInput value={pw} onChangeText={setPw} secureTextEntry autoComplete="password" style={s.input} accessibilityLabel={t('password')} />
        {msg ? <Text style={s.err}>{msg}</Text> : null}
        <Button title={t('meDeleteBtn')} kind="danger" icon="trash" busy={busy} onPress={del} style={{ marginVertical: S.lg }} />
      </Sheet>
    </Screen>
  );
}
const s = StyleSheet.create({
  foot: { alignItems: 'center', gap: 6, marginTop: S.xxl },
  footMark: { width: 34, height: 34, borderRadius: 8 },
  footWord: { fontFamily: F.display, fontSize: 20, letterSpacing: 2, color: C.text },
  back: { width: 44, height: 44, justifyContent: 'center', marginLeft: -8, marginBottom: 4 },
  group: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: S.lg },
  label: { fontFamily: F.medium, fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: C.muted2, marginTop: S.md, marginBottom: S.sm },
  version: { fontFamily: F.regular, fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 2 },
  langRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: C.border },
  langText: { fontFamily: F.medium, fontSize: 16, color: C.text },
  input: { backgroundColor: C.black, borderWidth: 1, borderColor: C.borderHi, borderRadius: R.md, padding: 13, fontFamily: F.regular, fontSize: 16, color: C.text },
  err: { fontFamily: F.medium, fontSize: 13.5, color: '#ff9a9a', marginTop: S.md },
});
