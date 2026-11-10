// A photo you can pinch, drag and double-tap to zoom (Android and the browser
// preview; iPhones zoom natively in Gallery.tsx). Plain React Native touch
// handling on purpose: nothing here runs on the animation thread.
import { useEffect, useState } from 'react';
import { Animated, PanResponder, Pressable, type GestureResponderEvent, type PanResponderInstance } from 'react-native';
import { Image } from 'expo-image';

const MAX = 4, DOUBLE = 2.5;
const spread = (e: GestureResponderEvent) => {
  const t = e.nativeEvent.touches;
  return t.length < 2 ? 0 : Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
};
const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));

// The gesture's state lives here, outside React: it changes on every finger move.
class Zoom {
  s = new Animated.Value(1); x = new Animated.Value(0); y = new Animated.Value(0);
  width = 0; height = 0; onZoom?: (zoomed: boolean) => void;
  private at = { s: 1, x: 0, y: 0 };      // where the photo rests between gestures
  private from = { d: 0, s: 1 };          // where the current pinch began
  private lastTap = 0;
  pan: PanResponderInstance = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    // two fingers always; one finger only once zoomed in (otherwise the swipe to the next photo wins)
    onMoveShouldSetPanResponder: (e, g) => e.nativeEvent.touches.length >= 2 || (this.at.s > 1.02 && Math.abs(g.dx) + Math.abs(g.dy) > 4),
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { this.from = { d: 0, s: this.at.s }; },
    onPanResponderMove: (e, g) => {
      if (e.nativeEvent.touches.length >= 2) {
        const d = spread(e);
        if (!this.from.d) { this.from = { d, s: this.at.s }; return; }
        const ns = Math.max(1, Math.min(MAX, this.from.s * (d / this.from.d)));
        this.at.s = ns; this.s.setValue(ns);
      } else if (this.at.s > 1.02) {
        this.from.d = 0;
        this.x.setValue(clamp(this.at.x + g.dx, (this.width * (this.at.s - 1)) / 2));
        this.y.setValue(clamp(this.at.y + g.dy, (this.height * (this.at.s - 1)) / 2));
      }
    },
    onPanResponderRelease: (_e, g) => {
      const ns = this.at.s;
      if (ns <= 1.05) return this.settle(1, 0, 0);
      const dragged = !this.from.d;       // the gesture ended as a one-finger drag
      const nx = clamp(this.at.x + (dragged ? g.dx : 0), (this.width * (ns - 1)) / 2);
      const ny = clamp(this.at.y + (dragged ? g.dy : 0), (this.height * (ns - 1)) / 2);
      this.at = { s: ns, x: nx, y: ny };
      this.x.setValue(nx); this.y.setValue(ny);
      this.onZoom?.(true);
    },
    onPanResponderTerminate: () => this.settle(1, 0, 0),
  });
  configure(width: number, height: number, onZoom?: (zoomed: boolean) => void) { this.width = width; this.height = height; this.onZoom = onZoom; }
  settle(ns: number, nx: number, ny: number) {
    this.at = { s: ns, x: nx, y: ny };
    Animated.parallel([
      Animated.spring(this.s, { toValue: ns, useNativeDriver: true, bounciness: 4 }),
      Animated.spring(this.x, { toValue: nx, useNativeDriver: true, bounciness: 0 }),
      Animated.spring(this.y, { toValue: ny, useNativeDriver: true, bounciness: 0 }),
    ]).start();
    this.onZoom?.(ns > 1.02);
  }
  tap = () => {
    const now = Date.now();
    if (now - this.lastTap < 300) { this.lastTap = 0; this.settle(this.at.s > 1.02 ? 1 : DOUBLE, 0, 0); } else this.lastTap = now;
  };
}

export function ZoomImage({ uri, width, height, onZoom }: { uri: string; width: number; height: number; onZoom?: (zoomed: boolean) => void }) {
  const [z] = useState(() => new Zoom());
  useEffect(() => { z.configure(width, height, onZoom); }, [z, width, height, onZoom]);
  return (
    <Animated.View {...z.pan.panHandlers} style={{ width, height, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <Pressable onPress={z.tap} accessible={false}>
        <Animated.View style={{ transform: [{ translateX: z.x }, { translateY: z.y }, { scale: z.s }] }}>
          <Image source={{ uri }} style={{ width, height: height * 0.8 }} contentFit="contain" />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
