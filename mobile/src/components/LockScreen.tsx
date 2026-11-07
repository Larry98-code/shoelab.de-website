import { useEffect } from 'react';
import { Image, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { C } from '../theme';
import { Button, H2, Screen } from './ui';

// Face ID / fingerprint, when the member turned it on in Settings.
export function LockScreen() {
  const { unlock, signOut } = useAuth();
  const { t } = useI18n();
  useEffect(() => { unlock(); }, [unlock]);
  return (
    <Screen scroll={false} edges={['top', 'bottom']}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        <Image source={require('../../assets/mark.png')} style={{ width: 96, height: 96, borderRadius: 22 }} />
        <H2 style={{ textAlign: 'center' }}>{t('lockT')}</H2>
        <Button title={t('lockBtn')} icon="faceid" onPress={unlock} style={{ alignSelf: 'stretch' }} />
        <Button title={t('lockFallback')} kind="ghost" onPress={signOut} style={{ alignSelf: 'stretch' }} />
      </View>
      <View style={{ height: 1, backgroundColor: C.black }} />
    </Screen>
  );
}
