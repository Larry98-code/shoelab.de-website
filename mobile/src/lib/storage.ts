// The sign-in and settings, kept in the phone's secure storage (Keychain /
// Keystore); in the browser preview, localStorage.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const web = Platform.OS === 'web';
export const store = {
  async get(k: string): Promise<string | null> {
    try { return web ? globalThis.localStorage?.getItem(k) ?? null : await SecureStore.getItemAsync(k); } catch { return null; }
  },
  async set(k: string, v: string): Promise<void> {
    try { if (web) globalThis.localStorage?.setItem(k, v); else await SecureStore.setItemAsync(k, v); } catch { /* full or locked */ }
  },
  async del(k: string): Promise<void> {
    try { if (web) globalThis.localStorage?.removeItem(k); else await SecureStore.deleteItemAsync(k); } catch { /* gone already */ }
  },
};
