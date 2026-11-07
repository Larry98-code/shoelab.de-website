import { useRef, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { abs } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { C, F } from '../theme';
import { Icon } from './Icon';
import { tap } from './ui';

type Photo = { url: string; kind: string };

// The listing's photos: swipe through them; a tap opens them full screen,
// where they can be zoomed (pinch, double-tap) and swiped.
export function Gallery({ photos, height }: { photos: Photo[]; height: number }) {
  const { width } = useWindowDimensions();
  const { t } = useI18n();
  const [i, setI] = useState(0), [full, setFull] = useState(false);
  if (!photos.length) return <View style={[g.empty, { height }]}><Icon name="image" size={34} color={C.muted} /></View>;
  return (
    <View>
      <FlatList data={photos} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={(p, k) => p.url + k}
        onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
        onScroll={Platform.OS === 'web' ? (e) => setI(Math.round(e.nativeEvent.contentOffset.x / width)) : undefined} scrollEventThrottle={64}
        renderItem={({ item }) => (
          <Pressable onPress={() => { tap('select'); setFull(true); }} accessibilityLabel={t('kind_' + item.kind)}>
            <Image source={{ uri: abs(item.url) }} style={{ width, height, backgroundColor: C.card2 }} contentFit="contain" transition={200} />
          </Pressable>
        )} />
      <View style={g.kind}><Text style={g.kindText}>{t('kind_' + photos[i]?.kind)}</Text></View>
      <View style={g.count}><Text style={g.countText}>{i + 1} / {photos.length}</Text></View>
      {photos.length > 1 && photos.length <= 12 ? (
        <View style={g.dots}>{photos.map((_, k) => <View key={k} style={[g.dot, k === i && g.dotOn]} />)}</View>
      ) : null}
      <Viewer photos={photos} open={full} start={i} onClose={(k) => { setFull(false); setI(k); }} />
    </View>
  );
}

function Viewer({ photos, open, start, onClose }: { photos: Photo[]; open: boolean; start: number; onClose: (i: number) => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [i, setI] = useState(start);
  const list = useRef<FlatList<Photo>>(null);
  return (
    <Modal visible={open} animationType="fade" onShow={() => { setI(start); list.current?.scrollToIndex({ index: start, animated: false }); }} onRequestClose={() => onClose(i)}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <FlatList ref={list} data={photos} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={(p, k) => p.url + k}
          initialScrollIndex={start} getItemLayout={(_, k) => ({ length: width, offset: width * k, index: k })}
          onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            // pinch-zoom: iOS zooms a ScrollView natively
            <ScrollView style={{ width, height }} contentContainerStyle={{ width, height, alignItems: 'center', justifyContent: 'center' }}
              maximumZoomScale={4} minimumZoomScale={1} centerContent showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} bouncesZoom>
              <Image source={{ uri: abs(item.url) }} style={{ width, height: height * 0.8 }} contentFit="contain" />
            </ScrollView>
          )} />
        <View style={[g.vTop, { top: insets.top + 8 }]}>
          <Text style={g.vTitle}>{t('kind_' + photos[i]?.kind)} · {i + 1} / {photos.length}</Text>
          <Pressable onPress={() => onClose(i)} style={g.vX} accessibilityRole="button" accessibilityLabel={t('close')} hitSlop={10}><Icon name="x" size={20} color="#fff" /></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const g = StyleSheet.create({
  empty: { backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  kind: { position: 'absolute', left: 14, bottom: 14, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.border },
  kindText: { fontFamily: F.semibold, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', color: '#eee' },
  count: { position: 'absolute', right: 14, bottom: 14, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  countText: { fontFamily: F.semibold, fontSize: 11, color: '#eee', fontVariant: ['tabular-nums'] },
  dots: { position: 'absolute', bottom: 20, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotOn: { width: 16, backgroundColor: C.gold },
  vTop: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vTitle: { fontFamily: F.semibold, fontSize: 13, color: '#eee', letterSpacing: 0.5 },
  vX: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
});
