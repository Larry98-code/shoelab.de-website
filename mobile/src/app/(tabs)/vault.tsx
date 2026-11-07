import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { market } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import type { ListingCard as Card } from '../../lib/types';
import { ListingCard } from '../../components/ListingCard';
import { Icon } from '../../components/Icon';
import { Body, Empty, Eyebrow, H1, tap } from '../../components/ui';
import { C, F, R, S } from '../../theme';

const SORTS = [['featured', 'sortFeatured'], ['new', 'sortNew'], ['ending', 'sortEnding'], ['price_asc', 'sortPriceAsc'], ['price_desc', 'sortPriceDesc'], ['popular', 'sortPopular']] as const;
type Q = { q: string; format: '' | 'auction' | 'fixed'; tier: '' | 'photo' | 'lab'; brand: string; sort: string };
const PER = 24;

// The Vault: search, filters and every live pair, two to a row, more as you scroll.
export default function Vault() {
  const { t, tn } = useI18n();
  const { config } = useAuth();
  const { width } = useWindowDimensions();
  const [q, setQ] = useState<Q>({ q: '', format: '', tier: '', brand: '', sort: 'featured' });
  const [items, setItems] = useState<Card[] | null>(null);
  const [total, setTotal] = useState(0), [page, setPage] = useState(1);
  const [brands, setBrands] = useState<{ brand: string; n: number }[]>([]);
  const [busy, setBusy] = useState(false), [refreshing, setRefreshing] = useState(false), [failed, setFailed] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [text, setText] = useState('');
  const seq = useRef(0);
  const colW = (Math.min(width, 640) - S.lg * 2 - 14) / 2;

  const load = useCallback(async (next: Q, pg: number) => {
    const my = ++seq.current;
    setBusy(true);
    const p = new URLSearchParams({ sort: next.sort, page: String(pg), per: String(PER) });
    if (next.q) p.set('q', next.q);
    if (next.format) p.set('format', next.format);
    if (next.tier) p.set('tier', next.tier);
    if (next.brand) p.set('brand', next.brand);
    const r = await market<{ items: Card[]; total: number; facets: { brands: { brand: string; n: number }[] } }>('listings?' + p.toString());
    if (my !== seq.current) return;
    setBusy(false);
    if (!r.ok) { setFailed(true); if (pg === 1) setItems((x) => x || []); return; }
    setFailed(false);
    setTotal(r.data.total);
    setPage(pg);
    setItems((x) => (pg === 1 ? r.data.items : (x || []).concat(r.data.items)));
    if (pg === 1 && r.data.facets) setBrands(r.data.facets.brands || []);
  }, []);
  useEffect(() => { const h = setTimeout(() => load(q, 1), 0); return () => clearTimeout(h); }, [q, load]);
  // search as you type, after a short pause
  useEffect(() => { const h = setTimeout(() => setQ((x) => (x.q === text.trim() ? x : { ...x, q: text.trim() })), 350); return () => clearTimeout(h); }, [text]);

  const set = (patch: Partial<Q>) => { tap('select'); setQ((x) => ({ ...x, ...patch })); };
  const filtered = !!(q.q || q.format || q.tier || q.brand);
  const chip = (on: boolean, label: string, onPress: () => void, gold?: boolean) => (
    <Pressable key={label} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={[s.chip, on && (gold ? s.chipGold : s.chipOn)]}>
      <Text style={[s.chipText, on && { color: gold ? '#111' : '#111' }]}>{label}</Text>
    </Pressable>
  );

  const header = (
    <View>
      <Eyebrow color={C.gold}>ShoeLab Vault</Eyebrow>
      <H1 style={{ marginTop: 6 }}>{t('heroTag')}</H1>
      <View style={s.search}>
        <Icon name="search" size={18} color={C.muted} />
        <TextInput value={text} onChangeText={setText} placeholder={t('searchPh')} placeholderTextColor={C.muted} style={s.searchIn}
          returnKeyType="search" autoCorrect={false} accessibilityLabel={t('search')} clearButtonMode="while-editing" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {chip(!q.format && !q.tier, t('fAll'), () => set({ format: '', tier: '' }))}
        {chip(q.format === 'auction', t('fAuction'), () => set({ format: q.format === 'auction' ? '' : 'auction' }))}
        {chip(q.format === 'fixed', t('fFixed'), () => set({ format: q.format === 'fixed' ? '' : 'fixed' }))}
        {chip(q.tier === 'lab', t('tierLab'), () => set({ tier: q.tier === 'lab' ? '' : 'lab' }), true)}
        {chip(q.tier === 'photo', t('tierPhoto'), () => set({ tier: q.tier === 'photo' ? '' : 'photo' }), true)}
      </ScrollView>
      {brands.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.chips, { paddingTop: 0 }]}>
          {brands.map((b) => chip(q.brand.toLowerCase() === b.brand.toLowerCase(), b.brand + ' · ' + b.n, () => set({ brand: q.brand.toLowerCase() === b.brand.toLowerCase() ? '' : b.brand })))}
        </ScrollView>
      ) : null}
      <View style={s.bar}>
        <Text style={s.count}>{items ? tn('pairsN', total) : ''}</Text>
        <Pressable onPress={() => { tap('select'); setSortOpen(true); }} style={s.sortBtn} accessibilityRole="button" accessibilityLabel={t('sortBy')}>
          <Text style={s.sortText}>{t(SORTS.find((x) => x[0] === q.sort)?.[1] || 'sortFeatured')}</Text>
          <Icon name="chevron" size={14} color={C.goldHi} />
        </Pressable>
      </View>
      {config?.paused ? <Body small muted style={{ marginBottom: S.md }}>{t(config.paused.hold ? 'pausedHold' : config.paused.trading ? 'pausedTrading' : 'pausedListings')}</Body> : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.black }}>
      <FlatList data={items || []} keyExtractor={(x) => String(x.id)} numColumns={2}
        columnWrapperStyle={{ gap: 14 }} contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 130, gap: 22 }}
        ListHeaderComponent={header}
        renderItem={({ item }) => <ListingCard it={item} width={colW} />}
        onEndReachedThreshold={0.6}
        onEndReached={() => { if (!busy && items && items.length < total) load(q, page + 1); }}
        refreshControl={<RefreshControl tintColor={C.gold} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(q, 1); setRefreshing(false); }} />}
        ListEmptyComponent={items === null || busy ? <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} /> :
          failed ? <Empty icon="alert" title={t('emptyErrorT')} text={t('e_network')} /> :
          <Empty title={t(filtered ? 'emptyFilteredT' : 'emptyT')} text={t(filtered ? 'emptyFiltered' : 'empty')} />}
        ListFooterComponent={items && items.length && busy ? <ActivityIndicator color={C.gold} style={{ marginTop: 10 }} /> : undefined} />
      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={s.scrim} onPress={() => setSortOpen(false)}>
          <View style={s.sheet}>
            <Text style={s.sheetT}>{t('sortBy')}</Text>
            {SORTS.map(([k, label]) => (
              <Pressable key={k} onPress={() => { setSortOpen(false); set({ sort: k }); }} style={s.sheetRow} accessibilityRole="button">
                <Text style={[s.sheetText, q.sort === k && { color: C.goldHi }]}>{t(label)}</Text>
                {q.sort === k ? <Icon name="check" size={18} color={C.goldHi} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.borderHi, borderRadius: R.md, paddingHorizontal: 14, marginTop: S.lg },
  searchIn: { flex: 1, paddingVertical: 13, fontFamily: F.regular, fontSize: 15.5, color: C.text },
  chips: { gap: 8, paddingVertical: S.md },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill, borderWidth: 1, borderColor: C.borderHi, backgroundColor: C.card },
  chipOn: { backgroundColor: '#f5f5f5', borderColor: '#f5f5f5' },
  chipGold: { backgroundColor: C.goldHi, borderColor: C.goldHi },
  chipText: { fontFamily: F.medium, fontSize: 13, color: '#ddd' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.md },
  count: { fontFamily: F.medium, fontSize: 12.5, color: C.muted },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  sortText: { fontFamily: F.semibold, fontSize: 13, color: C.goldHi },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: S.xl, paddingTop: S.lg, paddingBottom: 40, borderWidth: 1, borderColor: C.borderHi },
  sheetT: { fontFamily: F.display, fontSize: 26, color: C.text, marginBottom: S.sm },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: C.border },
  sheetText: { fontFamily: F.medium, fontSize: 16, color: C.text },
});
