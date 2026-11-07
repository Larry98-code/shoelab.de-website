import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import Svg, { Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { C, F, R, S } from '../theme';
import { Icon } from './Icon';
import { Body, Button, H2, tap } from './ui';

export type Shot = { kind: string; uri: string; data: string; thumb: string };

// Outlines that show how to frame each required shot.
function Guide({ kind }: { kind: string }) {
  const stroke = { stroke: 'rgba(255,255,255,0.85)', strokeWidth: 2.2, strokeDasharray: '7 6', fill: 'none' } as const;
  if (kind === 'side_out' || kind === 'side_in' || kind === 'heel' || kind === 'toe') {
    return (
      <Svg viewBox="0 0 200 100" width="86%" height={180}>
        <Path {...stroke} d="M14 78 C14 66 20 60 34 58 L70 52 C82 50 90 40 96 28 C99 22 106 20 112 24 L124 34 C134 42 150 48 170 52 C184 55 190 62 190 72 L190 80 C190 84 186 86 182 86 L22 86 C17 86 14 83 14 78 Z" />
        <Path {...stroke} d="M14 74 L190 74" strokeDasharray="3 7" />
      </Svg>
    );
  }
  if (kind === 'sole' || kind === 'insole') {
    return (
      <Svg viewBox="0 0 100 220" width={150} height={300}>
        <Path {...stroke} d="M50 8 C72 8 84 30 84 62 C84 88 76 104 74 124 C72 146 78 166 76 186 C74 204 64 214 50 214 C36 214 26 204 24 186 C22 166 28 146 26 124 C24 104 16 88 16 62 C16 30 28 8 50 8 Z" />
      </Svg>
    );
  }
  return (
    <Svg viewBox="0 0 200 140" width="82%" height={200}>
      <Rect x={8} y={8} width={184} height={124} rx={10} {...stroke} />
      <Path stroke={C.goldHi} strokeWidth={3} fill="none" d="M8 34 V8 H34 M166 8 H192 V34 M192 106 V132 H166 M34 132 H8 V106" />
    </Svg>
  );
}

// Photos are shrunk on the phone before they are sent: about 1600 px, plus a small thumbnail.
async function prepare(kind: string, uri: string, w?: number, h?: number): Promise<Shot> {
  const big = (w || 0) >= (h || 0) ? { width: Math.min(1600, w || 1600) } : { height: Math.min(1600, h || 1600) };
  const full = await manipulateAsync(uri, [{ resize: big }], { compress: 0.8, format: SaveFormat.JPEG, base64: true });
  const small = await manipulateAsync(full.uri, [{ resize: { width: 400 } }], { compress: 0.7, format: SaveFormat.JPEG, base64: true });
  return { kind, uri: full.uri, data: 'data:image/jpeg;base64,' + full.base64, thumb: 'data:image/jpeg;base64,' + small.base64 };
}

export function GuidedCamera({ kind, open, onClose, onShot }: { kind: string; open: boolean; onClose: () => void; onShot: (s: Shot) => void }) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [perm, ask] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false), [torch, setTorch] = useState(false);
  const done = async (uri: string, w?: number, h?: number) => {
    setBusy(true);
    try { onShot(await prepare(kind, uri, w, h)); tap('success'); onClose(); } finally { setBusy(false); }
  };
  const snap = async () => {
    if (!cam.current || busy) return;
    tap();
    const p = await cam.current.takePictureAsync({ quality: 0.9, skipProcessing: false });
    if (p) await done(p.uri, p.width, p.height);
  };
  const library = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false });
    if (!r.canceled && r.assets[0]) await done(r.assets[0].uri, r.assets[0].width, r.assets[0].height);
  };
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {perm?.granted ? (
          <CameraView ref={cam} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} />
        ) : (
          <View style={[StyleSheet.absoluteFill, s.ask]}>
            <Icon name="camera" size={40} color={C.goldHi} />
            <H2 style={{ textAlign: 'center', marginTop: S.md }}>{t('camAllowT')}</H2>
            <Body muted style={{ textAlign: 'center', marginTop: 6 }}>{t('camAllowP')}</Body>
            {perm?.canAskAgain !== false ? <Button title={t('camAllow')} onPress={ask} style={{ marginTop: S.xl, alignSelf: 'stretch' }} /> : null}
            <Button title={t('sellFromLibrary')} kind="ghost" icon="image" onPress={library} style={{ marginTop: S.md, alignSelf: 'stretch' }} />
          </View>
        )}
        {perm?.granted ? <View style={s.guide} pointerEvents="none"><Guide kind={kind} /></View> : null}
        <View style={[s.top, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} style={s.round} accessibilityRole="button" accessibilityLabel={t('close')}><Icon name="x" size={20} color="#fff" /></Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={s.kind}>{t('kind_' + kind)}</Text>
            <Text style={s.tip}>{t('kindTip_' + kind)}</Text>
          </View>
          {perm?.granted ? <Pressable onPress={() => setTorch(!torch)} style={s.round} accessibilityRole="button" accessibilityLabel="Light"><Icon name="bolt" size={18} color={torch ? C.goldHi : '#fff'} /></Pressable> : <View style={{ width: 44 }} />}
        </View>
        {perm?.granted ? (
          <View style={[s.bottom, { paddingBottom: insets.bottom + 20 }]}>
            <Pressable onPress={library} style={s.lib} accessibilityRole="button" accessibilityLabel={t('sellFromLibrary')}><Icon name="image" size={22} color="#fff" /></Pressable>
            <Pressable onPress={snap} style={s.shutter} accessibilityRole="button" accessibilityLabel={t('sellTakePhoto')}>
              {busy ? <ActivityIndicator color="#111" /> : <View style={s.shutterIn} />}
            </Pressable>
            <View style={{ width: 54 }} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  ask: { alignItems: 'center', justifyContent: 'center', padding: S.xl, backgroundColor: C.black },
  guide: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: S.lg, gap: 10 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  kind: { fontFamily: F.display, fontSize: 26, color: '#fff', letterSpacing: 1 },
  tip: { fontFamily: F.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2, textAlign: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 36 },
  lib: { width: 54, height: 54, borderRadius: R.md, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterIn: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },
});
