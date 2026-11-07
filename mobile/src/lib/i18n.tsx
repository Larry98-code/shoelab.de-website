// Eight languages, like the website. The phone's language unless the member
// picked another; texts from the website's Vault plus the app's own.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getLocales } from 'expo-localization';
import { store } from './storage';
import { setApiLang } from './api';
import vEn from '../i18n/vault/en.json'; import vDe from '../i18n/vault/de.json'; import vPl from '../i18n/vault/pl.json'; import vRu from '../i18n/vault/ru.json';
import vUk from '../i18n/vault/uk.json'; import vIt from '../i18n/vault/it.json'; import vEs from '../i18n/vault/es.json'; import vFr from '../i18n/vault/fr.json';
import aEn from '../i18n/app/en';
import aDe from '../i18n/app/de'; import aPl from '../i18n/app/pl'; import aRu from '../i18n/app/ru'; import aUk from '../i18n/app/uk';
import aIt from '../i18n/app/it'; import aEs from '../i18n/app/es'; import aFr from '../i18n/app/fr';

export const LANGS = ['en', 'de', 'pl', 'ru', 'uk', 'it', 'es', 'fr'] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_NAMES: Record<Lang, string> = { en: 'English', de: 'Deutsch', pl: 'Polski', ru: 'Русский', uk: 'Українська', it: 'Italiano', es: 'Español', fr: 'Français' };
const LOCALE: Record<Lang, string> = { en: 'en-IE', de: 'de-DE', pl: 'pl-PL', ru: 'ru-RU', uk: 'uk-UA', it: 'it-IT', es: 'es-ES', fr: 'fr-FR' };
type Dict = Record<string, string>;
const VAULT: Record<Lang, Dict> = { en: vEn, de: vDe, pl: vPl, ru: vRu, uk: vUk, it: vIt, es: vEs, fr: vFr };
const APP: Record<Lang, Dict> = { en: aEn, de: aDe, pl: aPl, ru: aRu, uk: aUk, it: aIt, es: aEs, fr: aFr };

// plural forms without relying on Intl.PluralRules (not everywhere on phones)
function plural(l: Lang, n: number): string {
  const a = Math.abs(n), m10 = a % 10, m100 = a % 100;
  if (l === 'pl') return a === 1 ? 'one' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'few' : 'many';
  if (l === 'ru' || l === 'uk') return m10 === 1 && m100 !== 11 ? 'one' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'few' : 'many';
  if (l === 'fr') return a < 2 ? 'one' : 'other';
  return a === 1 ? 'one' : 'other';
}
function fill(s: string, vars?: Record<string, string | number>) {
  return !vars ? s : s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
}
function pick(): Lang {
  try {
    for (const loc of getLocales()) { const c = (loc.languageCode || '').toLowerCase(); if ((LANGS as readonly string[]).includes(c)) return c as Lang; }
  } catch { /* no locale */ }
  return 'en';
}

type Ctx = {
  lang: Lang; setLang: (l: Lang) => void;
  t: (k: string, vars?: Record<string, string | number>) => string;
  tn: (k: string, n: number, vars?: Record<string, string | number>) => string;
  has: (k: string) => boolean;
  money: (cents: number | null | undefined, full?: boolean) => string;
  date: (iso?: string | null) => string; dateTime: (iso?: string | null) => string; ago: (iso?: string | null) => string;
};
const I18n = createContext<Ctx>(null as unknown as Ctx);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, set] = useState<Lang>(pick());
  useEffect(() => { store.get('lang').then((v) => { if (v && (LANGS as readonly string[]).includes(v)) set(v as Lang); }); }, []);
  useEffect(() => { setApiLang(lang); }, [lang]);
  const setLang = useCallback((l: Lang) => { set(l); store.set('lang', l); }, []);
  const value = useMemo<Ctx>(() => {
    const get = (k: string): string | undefined => APP[lang][k] ?? VAULT[lang][k] ?? APP.en[k] ?? VAULT.en[k];
    const t = (k: string, vars?: Record<string, string | number>) => fill(get(k) ?? k, vars);
    const tn = (k: string, n: number, vars?: Record<string, string | number>) => {
      const v = Object.assign({ n }, vars);
      const s = get(k + '_' + plural(lang, n)) ?? get(k + '_other') ?? get(k + '_' + (n === 1 ? 'one' : 'other')) ?? k;
      return fill(s, v);
    };
    const loc = LOCALE[lang];
    const money = (c: number | null | undefined, full?: boolean) => {
      if (c == null || isNaN(c as number)) return '—';
      const whole = Math.round(c) % 100 === 0;
      try {
        return new Intl.NumberFormat(loc, { style: 'currency', currency: 'EUR', minimumFractionDigits: whole && !full ? 0 : 2, maximumFractionDigits: 2 }).format(c / 100);
      } catch { return '€' + (c / 100).toFixed(whole && !full ? 0 : 2); }
    };
    const d = (iso?: string | null) => (iso ? new Date(iso) : null);
    const date = (iso?: string | null) => { const x = d(iso); if (!x) return ''; try { return x.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return x.toISOString().slice(0, 10); } };
    const dateTime = (iso?: string | null) => { const x = d(iso); if (!x) return ''; try { return x.toLocaleString(loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return x.toISOString().slice(0, 16).replace('T', ' '); } };
    const ago = (iso?: string | null) => {
      const x = d(iso); if (!x) return '';
      const s = Math.round((x.getTime() - Date.now()) / 1000), a = Math.abs(s);
      const u: [Intl.RelativeTimeFormatUnit, number] = a < 60 ? ['second', s] : a < 3600 ? ['minute', Math.round(s / 60)] : a < 86400 ? ['hour', Math.round(s / 3600)] : a < 2592000 ? ['day', Math.round(s / 86400)] : ['month', Math.round(s / 2592000)];
      try { return new Intl.RelativeTimeFormat(loc, { numeric: 'auto' }).format(u[1], u[0]); } catch { return date(iso); }
    };
    return { lang, setLang, t, tn, has: (k) => get(k) != null, money, date, dateTime, ago };
  }, [lang, setLang]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}
export const useI18n = () => useContext(I18n);
