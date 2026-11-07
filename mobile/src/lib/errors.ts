import type { Res } from './api';

type I18n = { t: (k: string, v?: Record<string, string | number>) => string; has: (k: string) => boolean; money: (c: number, full?: boolean) => string; date: (iso?: string | null) => string };

// The server answers errors with a code; show it in the member's language
// (the same texts as the website), with amounts and dates filled in.
export function errText(i18n: I18n, res: Res): string {
  const d = (res && res.data) || {};
  if (res && res.status === 0) return i18n.t('e_network');
  if (d.code && i18n.has('e_' + d.code)) {
    const key = 'e_' + d.code + (d.until && i18n.has('e_' + d.code + '_until') ? '_until' : '');
    return i18n.t(key, {
      amount: d.amount != null ? i18n.money(d.amount, true) : '', min: d.min != null ? i18n.money(d.min) : '', max: d.max != null ? i18n.money(d.max) : '',
      until: d.until ? i18n.date(d.until) : '', n: d.n != null ? d.n : '',
    }) + (d.notice ? ' ' + d.notice : '');
  }
  return d.error || i18n.t('e_generic');
}
