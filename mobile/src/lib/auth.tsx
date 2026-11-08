// Who is signed in, the Vault's settings (fees, the on-hold state…), and the
// optional Face ID / fingerprint lock. The sign-in token lives in secure storage.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { api, market, setToken, type Res } from './api';
import { store } from './storage';

export type Standing = { status: string; until: string | null; noSell: string | null; noBuy: string | null; hidden: boolean };
export type Me = { id: number; name: string; email: string; verified: boolean; specialist: boolean; admin?: boolean; standing?: Standing } | null;
export type Config = Record<string, any> & { me: Me; paused: null | { trading: boolean; listings: boolean; hold?: boolean; notice: string | null } };

type Ctx = {
  ready: boolean; me: Me; config: Config | null; locked: boolean; bioLock: boolean;
  // past the welcome screen: signed in, or looking around as a guest for this session
  inside: boolean; setGuest: (on: boolean) => void;
  reload: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<Res>;
  signUp: (name: string, email: string, password: string) => Promise<Res>;
  signOut: () => Promise<void>;
  deleteAccount: (password: string) => Promise<Res>;
  setBioLock: (on: boolean) => Promise<boolean>;
  unlock: () => Promise<boolean>;
};
const Auth = createContext<Ctx>(null as unknown as Ctx);
const RELOCK_MS = 5 * 60 * 1000;   // back from the background after five minutes: ask again

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [locked, setLocked] = useState(false);
  const [bioLock, setBio] = useState(false);
  const [hasToken, setHasToken] = useState(false), [guest, setGuest] = useState(false);
  const away = useRef<number | null>(null);

  const reload = useCallback(async () => {
    const r = await market<Config>('config');
    if (r.ok) setConfig(r.data);
  }, []);

  useEffect(() => {
    (async () => {
      const tok = await store.get('token');
      const bio = (await store.get('bioLock')) === '1';
      setToken(tok); setHasToken(!!tok); setBio(bio);
      if (tok && bio && Platform.OS !== 'web') setLocked(true);
      await reload();
      setReady(true);
    })();
  }, [reload]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') away.current = Date.now();
      if (s === 'active' && away.current && bioLock && config?.me && Date.now() - away.current > RELOCK_MS) setLocked(true);
      if (s === 'active') reload();
    });
    return () => sub.remove();
  }, [bioLock, config, reload]);

  const keep = useCallback(async (r: Res) => {
    if (r.ok && r.data && r.data.token) { await store.set('token', r.data.token); setToken(r.data.token); setHasToken(true); await reload(); }
    return r;
  }, [reload]);
  const signIn = useCallback((email: string, password: string) => api('/api/account/login', { body: { email, password, app: true } }).then(keep), [keep]);
  const signUp = useCallback((name: string, email: string, password: string) =>
    api('/api/account/signup', { body: { name, email, password, app: true, next: '/vault-me.html' } }).then(keep), [keep]);
  const signOut = useCallback(async () => {
    const push = await store.get('pushToken');
    if (push) await market('push/unregister', { body: { token: push } });
    await api('/api/account/logout', { body: {} });   // clears a website cookie left by older versions
    await store.del('token'); await store.del('bioLock'); setBio(false);
    setToken(null); setHasToken(false); setGuest(false); setLocked(false);
    await reload();
  }, [reload]);
  const deleteAccount = useCallback(async (password: string) => {
    const r = await api('/api/account/delete', { body: { password } });
    if (r.ok) { await store.del('token'); await store.del('pushToken'); await store.del('bioLock'); setBio(false); setToken(null); setHasToken(false); setGuest(false); await reload(); }
    return r;
  }, [reload]);
  const unlock = useCallback(async () => {
    try {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'ShoeLab' });
      if (r.success) { setLocked(false); return true; }
    } catch { /* not available */ }
    return false;
  }, []);
  const setBioLock = useCallback(async (on: boolean) => {
    if (on) {
      const ok = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
      if (!ok) return false;
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'ShoeLab' });
      if (!r.success) return false;
    }
    await store.set('bioLock', on ? '1' : '0'); setBio(on);
    return true;
  }, []);

  // offline with a saved sign-in still counts as signed in
  const inside = !!config?.me || guest || (hasToken && !config);
  const value = useMemo<Ctx>(() => ({
    ready, me: config?.me ?? null, config, locked, bioLock, inside, setGuest, reload, signIn, signUp, signOut, deleteAccount, setBioLock, unlock,
  }), [ready, config, locked, bioLock, inside, reload, signIn, signUp, signOut, deleteAccount, setBioLock, unlock]);
  return <Auth.Provider value={value}>{children}</Auth.Provider>;
}
export const useAuth = () => useContext(Auth);
