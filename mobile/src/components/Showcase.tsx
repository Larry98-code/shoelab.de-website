// The hero showcase, the same as the website's (js/hero-showcase.js): the pairs
// turn through one at a time — one turns away in 3D before the next turns in —
// the light behind re-tints to each pair, its model name stands outlined behind
// it, and the segments are the timer. Tap for the next pair, hold to pause.
// The pairs and texts come from the website (npm run sync:i18n).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import Svg, { Text as SvgText } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import data from '../i18n/showcase.json';
import { useI18n } from '../lib/i18n';
import { F } from '../theme';
import { Glow } from './Stage';
import { tap } from './ui';

const IMG: Record<string, number> = {
  jordan1: require('../../assets/img/showcase-jordan1.webp'),
  nb1080: require('../../assets/img/showcase-nb1080.webp'),
  'nb9060-black': require('../../assets/img/showcase-nb9060-black.webp'),
  nb880: require('../../assets/img/showcase-nb880.webp'),
};
const INTERVAL = 6000;
// the floor reflection fades out in steps (no mask needed)
const REFLECT = [0.15, 0.1, 0.06, 0.03];
type Shoe = (typeof data.shoes)[number] & { ed?: string; edKey?: string };
const shuffled = <T,>(a: T[]) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// One pair's light; fades in when its pair is on stage.
function Tint({ on, c1, c2, w, h }: { on: boolean; c1: string; c2: string; w: number; h: number }) {
  const o = useSharedValue(on ? 1 : 0);
  useEffect(() => { o.set(withTiming(on ? 1 : 0, { duration: 1400, easing: Easing.inOut(Easing.quad) })); }, [on, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, a]} pointerEvents="none">
      <Glow size={w * 1.05} color={c1} opacity={0.5} style={{ right: -w * 0.32, top: -w * 0.42 }} />
      <Glow size={w * 0.9} color={c2} opacity={0.75} style={{ left: -w * 0.38, top: h * 0.3 }} />
    </Animated.View>
  );
}

export function Showcase({ size, caption = 'full' }: { size: number; caption?: 'full' | 'short' }) {
  const { lang } = useI18n();
  const reduced = useReducedMotion();
  const [order] = useState(() => shuffled(data.shoes as Shoe[]));
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0), busy = useRef(false), held = useRef(false);
  const shoe = order[idx];
  const H = size / 1.18;
  const tr = (data.tr as Record<string, Record<string, string>>)[lang] || data.tr.en;
  const desc = ((data.desc as Record<string, Record<string, string>>)[shoe.id] || {})[lang] || ((data.desc as Record<string, Record<string, string>>)[shoe.id] || {}).en || '';
  const ed = shoe.ed || (shoe.edKey ? tr[shoe.edKey] : '');

  // the turn, the float and the timer
  const rot = useSharedValue(0), tx = useSharedValue(0), sc = useSharedValue(1), op = useSharedValue(1);
  const fy = useSharedValue(0), fr = useSharedValue(-1.2), prog = useSharedValue(0);
  const next = useRef<() => void>(() => {});
  // Called from the animation (UI) thread when the timer runs out: it must be a
  // function made here on the JS thread, never one built inside the animation.
  const advance = useCallback(() => next.current(), []);

  const run = useCallback((from = 0) => {
    if (reduced) return;
    prog.set(withSequence(withTiming(from, { duration: 0 }), withTiming(1, { duration: INTERVAL * (1 - from), easing: Easing.linear }, (fin) => { if (fin) scheduleOnRN(advance); })));
  }, [prog, reduced, advance]);

  const show = useCallback((to: number) => {
    if (busy.current || to === idxRef.current) return;
    busy.current = true;
    cancelAnimation(prog);
    const out = Easing.bezier(0.65, 0, 0.35, 1), inn = Easing.bezier(0.2, 0.8, 0.2, 1);
    rot.set(withTiming(-38, { duration: 420, easing: out }));
    tx.set(withTiming(-0.07 * size, { duration: 420, easing: out }));
    sc.set(withTiming(0.9, { duration: 420, easing: out }));
    op.set(withTiming(0, { duration: 300 }));
    setTimeout(() => {
      idxRef.current = to; setIdx(to);
      rot.set(withSequence(withTiming(38, { duration: 0 }), withTiming(0, { duration: 800, easing: inn })));
      tx.set(withSequence(withTiming(0.07 * size, { duration: 0 }), withTiming(0, { duration: 800, easing: inn })));
      sc.set(withSequence(withTiming(0.9, { duration: 0 }), withTiming(1, { duration: 800, easing: inn })));
      op.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 550 })));
      busy.current = false;
      if (!held.current) run(0);
    }, 440);
  }, [op, prog, rot, run, sc, size, tx]);
  useEffect(() => { next.current = () => show((idxRef.current + 1) % order.length); }, [show, order.length]);

  // plays only while its screen is on top
  useFocusEffect(useCallback(() => {
    run(prog.value < 1 ? prog.value : 0);
    return () => cancelAnimation(prog);
  }, [run, prog]));
  useEffect(() => {
    if (reduced) return;
    fy.set(withRepeat(withTiming(-12, { duration: 3250, easing: Easing.inOut(Easing.sin) }), -1, true));
    fr.set(withRepeat(withTiming(1, { duration: 3250, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [fy, fr, reduced]);

  const turn = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ perspective: 1300 }, { translateX: tx.value }, { rotateY: rot.value + 'deg' }, { scale: sc.value }],
  }));
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: fy.value }, { rotate: fr.value + 'deg' }] }));
  const shoeW = size * 0.92, shoeH = H * 0.6;
  // the outlined name: as big as fits, so it frames the pair
  const word = Math.min(H * 0.8, (size * 1.05) / (shoe.word.length * 0.42));

  return (
    <View style={{ width: size, alignSelf: 'center' }}>
      <Pressable
        onPress={() => { tap('select'); next.current(); }}
        onLongPress={() => { held.current = true; cancelAnimation(prog); }} delayLongPress={250}
        onPressOut={() => { if (held.current) { held.current = false; run(prog.value); } }}
        accessibilityRole="button" accessibilityLabel={shoe.brand + ' ' + shoe.model + (ed ? ' ' + ed : '')} accessibilityHint={tr.show}
        style={{ width: size, height: H }}>
        {order.map((s, i) => <Tint key={s.id} on={i === idx} c1={s.c[0]} c2={s.c[1]} w={size} h={H} />)}
        {/* the model name, outlined, behind the pair */}
        <Animated.View key={'w' + shoe.id} entering={FadeIn.duration(700)} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          <Svg width={size} height={H}>
            <SvgText x={size / 2} y={H * 0.44 + word * 0.35} textAnchor="middle" fontFamily={F.display} fontSize={word}
              fill="none" stroke="rgba(255,255,255,0.17)" strokeWidth={1.2}>{shoe.word}</SvgText>
          </Svg>
        </Animated.View>
        {/* a dark plate, so the coloured light rims the pair and never shows through it */}
        <Glow size={size * 0.86} color="#000" opacity={0.85} style={{ left: size * 0.07, top: H * 0.52 - size * 0.43 }} />
        <Animated.View style={[s.shoe, { width: shoeW, height: shoeH * 1.32, left: (size - shoeW) / 2, top: H * 0.47 - shoeH / 2 }, turn]} pointerEvents="none">
          <Animated.View style={[{ width: shoeW }, float]}>
            <Image source={IMG[shoe.img]} style={{ width: shoeW, height: shoeH }} contentFit="contain" accessibilityIgnoresInvertColors />
            {/* the glossy floor: the pair, flipped and faded */}
            <View style={{ width: shoeW, marginTop: -shoeH * 0.05 }}>
              {REFLECT.map((o, k) => (
                <View key={k} style={{ width: shoeW, height: shoeH * 0.07, overflow: 'hidden' }}>
                  <Image source={IMG[shoe.img]} style={{ width: shoeW, height: shoeH, opacity: o, marginTop: -k * shoeH * 0.07, transform: [{ scaleY: -1 }] }} contentFit="contain" />
                </View>
              ))}
            </View>
          </Animated.View>
        </Animated.View>
      </Pressable>

      <Animated.View key={'c' + shoe.id} entering={FadeInDown.duration(450)} style={s.cap}>
        <Text style={[s.brand, { color: shoe.c[0], textShadowColor: shoe.c[0] }]} maxFontSizeMultiplier={1.2}>{shoe.brand}</Text>
        <Text style={s.model} maxFontSizeMultiplier={1.2}>{shoe.model}{ed ? <Text style={s.ed}>{' ' + ed}</Text> : null}</Text>
        {caption === 'full' && desc ? <Text style={s.desc} maxFontSizeMultiplier={1.4}>{desc}</Text> : null}
        {caption === 'full' ? (
          <View style={s.tags}>{shoe.mat.map((m) => <Text key={m} style={s.tag} maxFontSizeMultiplier={1.2}>{tr[m] || m}</Text>)}</View>
        ) : null}
      </Animated.View>

      <View style={s.bar} accessibilityRole="tablist" accessibilityLabel={tr.list}>
        {order.map((x, i) => <Seg key={x.id} i={i} idx={idx} prog={prog} color={shoe.c[0]} onPress={() => { tap('select'); show(i); }} label={tr.show + ' ' + x.model} />)}
      </View>
    </View>
  );
}

function Seg({ i, idx, prog, color, onPress, label }: { i: number; idx: number; prog: ReturnType<typeof useSharedValue<number>>; color: string; onPress: () => void; label: string }) {
  const fill = useAnimatedStyle(() => ({ width: (i < idx ? 100 : i === idx ? prog.value * 100 : 0) + '%' }));
  return (
    <Pressable onPress={onPress} hitSlop={{ top: 12, bottom: 12, left: 2, right: 2 }} accessibilityRole="tab" accessibilityState={{ selected: i === idx }} accessibilityLabel={label} style={s.seg}>
      <Animated.View style={[s.segFill, { backgroundColor: color, opacity: i < idx ? 0.55 : 1 }, fill]} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  shoe: { position: 'absolute' },
  cap: { alignItems: 'center', marginTop: -6, paddingHorizontal: 8 },
  brand: { fontFamily: F.semibold, fontSize: 10.5, letterSpacing: 4.2, textTransform: 'uppercase', textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 } },
  model: { fontFamily: F.display, fontSize: 32, lineHeight: 34, letterSpacing: 1.4, color: '#fff', marginTop: 4, textAlign: 'center' },
  ed: { color: 'rgba(255,255,255,0.45)' },
  desc: { fontFamily: F.regular, fontSize: 13, lineHeight: 20, color: '#b9b9b9', textAlign: 'center', marginTop: 6, maxWidth: 380 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 10 },
  tag: { fontFamily: F.medium, fontSize: 9.5, letterSpacing: 1.6, textTransform: 'uppercase', color: '#ddd', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  bar: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 14 },
  seg: { width: 28, height: 3, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
  segFill: { height: '100%', borderRadius: 3 },
});
