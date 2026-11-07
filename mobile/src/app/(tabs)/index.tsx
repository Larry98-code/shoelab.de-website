import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { API, market } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import type { ListingCard as Card } from '../../lib/types';
import studio from '../../i18n/studio.json';
import { Body, Button, Card as Box, Eyebrow, H1, H2, H3, Row, Screen, tap } from '../../components/ui';
import { HoldCard } from '../../components/HoldCard';
import { ListingCard } from '../../components/ListingCard';
import { Icon } from '../../components/Icon';
import { C, F, R, S } from '../../theme';

const WHATSAPP = 'https://wa.me/491772258878';
const EMAIL = 'mailto:Shoelab.de@gmail.com';

export default function Home() {
  const { me, config, reload } = useAuth();
  const { t, lang, money } = useI18n();
  const { width } = useWindowDimensions();
  const [fresh, setFresh] = useState<Card[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const hold = !!config?.paused?.hold;
  const load = useCallback(async () => {
    const r = await market<{ items: Card[] }>('listings?sort=new&per=8');
    if (r.ok) setFresh(r.data.items || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await Promise.all([load(), reload()]); setRefreshing(false); };
  const svcText = (studio.text as Record<string, Record<string, string>>)[lang] || studio.text.en;
  const cardW = Math.min(170, width * 0.42);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} pad={false}>
      <View style={st.top}>
        <Row gap={10}>
          <Image source={require('../../../assets/logo.png')} style={st.logo} />
          <Text style={st.word}>SHOE<Text style={{ color: C.red }}>LAB</Text></Text>
        </Row>
        <Pressable accessibilityLabel={t('meNotifications')} onPress={() => router.push('/(tabs)/me')} hitSlop={10}>
          <Icon name="bell" size={22} color={C.muted2} />
        </Pressable>
      </View>

      <View style={st.pad}>
        {hold ? <View style={{ marginBottom: S.xl }}><HoldCard /></View> : null}
        <Eyebrow color={C.red}>{me ? t('homeHi', { name: me.name.split(' ')[0] }) : t('homeWelcome')}</Eyebrow>
        <H1 style={{ marginTop: 8 }}>{t('homeBook')}</H1>
        <Body muted style={{ marginTop: 6 }}>{t('homeBookP')}</Body>
        {!hold ? <Button title={t('homeBook')} icon="calendar" style={{ marginTop: S.lg }} onPress={() => WebBrowser.openBrowserAsync(API + '/booking.html')} /> : null}
      </View>

      <View style={[st.pad, { marginTop: S.xxl }]}>
        <Eyebrow>{t('homeServices')}</Eyebrow>
        {studio.services.map((sv, i) => (
          <Box key={sv.id} style={{ marginTop: S.md }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <H3>{sv.name}</H3>
                <Text style={st.tag}>{svcText['svcTag' + i]}</Text>
              </View>
              <Text style={st.price}>{money(sv.once * 100)}</Text>
            </Row>
            <Body muted small style={{ marginTop: 8 }}>{svcText['svcDesc' + i]}</Body>
          </Box>
        ))}
      </View>

      <View style={{ marginTop: S.xxl }}>
        <Row style={[st.pad, { justifyContent: 'space-between' }]}>
          <Eyebrow>{t('homeVaultT')}</Eyebrow>
          <Pressable onPress={() => { tap('select'); router.push('/(tabs)/vault'); }} hitSlop={8}><Text style={st.link}>{t('homeSeeAll')}</Text></Pressable>
        </Row>
        <FlatList horizontal data={fresh || []} keyExtractor={(x) => String(x.id)} showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: S.lg, gap: 14, paddingTop: S.md }}
          renderItem={({ item }) => <ListingCard it={item} width={cardW} />}
          ListEmptyComponent={fresh ? <Body muted>{t('empty')}</Body> : <View style={{ height: cardW * 1.3 }} />} />
      </View>

      <View style={[st.pad, { marginTop: S.xxl, gap: S.md }]}>
        <Pressable onPress={() => { tap('select'); router.push('/(tabs)/legit'); }} style={st.promo}>
          <LinearGradient colors={['#1c170a', '#121212']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Icon name="shield" size={26} color={C.goldHi} />
          <H2 style={{ marginTop: 10 }}>{t('homeLegitT')}</H2>
          <Body muted small style={{ marginTop: 4 }}>{t('homeLegitP')}</Body>
          <Text style={[st.link, { marginTop: 12 }]}>{t('homeLegitBtn')} →</Text>
        </Pressable>
        <Pressable onPress={() => { tap('select'); router.push('/(tabs)/sell'); }} style={st.promo}>
          <LinearGradient colors={['#1d0b0b', '#121212']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Icon name="tag" size={26} color="#ff6b6b" />
          <H2 style={{ marginTop: 10 }}>{t('homeSellT')}</H2>
          <Body muted small style={{ marginTop: 4 }}>{t('homeSellP')}</Body>
          <Text style={[st.link, { marginTop: 12, color: '#ff8f8f' }]}>{t('homeSellBtn')} →</Text>
        </Pressable>
      </View>

      <View style={[st.pad, { marginTop: S.xxl }]}>
        <Eyebrow>{t('homeContact')}</Eyebrow>
        <Row style={{ marginTop: S.md }} gap={S.md}>
          <Button title={t('homeWhatsApp')} kind="ghost" icon="chat" small style={{ flex: 1 }} onPress={() => Linking.openURL(WHATSAPP)} />
          <Button title={t('homeEmail')} kind="ghost" icon="mail" small style={{ flex: 1 }} onPress={() => Linking.openURL(EMAIL)} />
        </Row>
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.lg, paddingTop: 6, paddingBottom: S.lg },
  logo: { width: 34, height: 34, borderRadius: 17 },
  word: { fontFamily: F.display, fontSize: 26, color: C.text, letterSpacing: 2 },
  pad: { paddingHorizontal: S.lg },
  tag: { fontFamily: F.medium, fontSize: 12, color: C.red, marginTop: 3, letterSpacing: 0.3 },
  price: { fontFamily: F.display, fontSize: 28, color: C.text },
  link: { fontFamily: F.semibold, fontSize: 12.5, color: C.goldHi, letterSpacing: 1.2, textTransform: 'uppercase' },
  promo: { borderRadius: R.lg, borderWidth: 1, borderColor: C.border, padding: S.xl, overflow: 'hidden' },
});
