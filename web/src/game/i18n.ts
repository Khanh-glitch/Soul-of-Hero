// ============================================================================
// i18n — presentation-only language switch (English / Tiếng Việt). The Journey
// ledger carries two-language texts; every other screen is translated on the
// way to the DOM by ui/i18n-dom.ts with the phrase book in i18n-vi.ts. It has NO authority: nothing in the save, the engine or a
// receipt depends on it. Item and structure names stay in English in both
// languages so the handbook always matches the names shown in the pack.
// ============================================================================
export type Lang = 'en' | 'vi';
/** A text in both languages. */
export interface L { en: string; vi: string }

const KEY = 'soh.lang.v1';
let current: Lang | null = null;
const listeners = new Set<() => void>();

function read(): Lang {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (v === 'vi' || v === 'en') return v;
    // No choice saved yet: follow the browser. A Vietnamese browser starts in Vietnamese.
    const nav = typeof navigator !== 'undefined' ? String(navigator.language ?? '') : '';
    return nav.toLowerCase().startsWith('vi') ? 'vi' : 'en';
  } catch { return 'en'; }
}

export function getLang(): Lang { return current ?? (current = read()); }
export function setLang(lang: Lang): void {
  current = lang === 'vi' ? 'vi' : 'en';
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, current); } catch { /* private mode: keep in memory */ }
  for (const fn of [...listeners]) fn();
}
export function subscribeLang(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
/** Pick the active language from a two-language text. */
export const tx = (l: L, lang: Lang = getLang()): string => (lang === 'vi' ? l.vi : l.en);
/** Inline helper for UI chrome: `T('Close', 'Đóng')`. */
export const T = (en: string, vi: string, lang: Lang = getLang()): string => (lang === 'vi' ? vi : en);
