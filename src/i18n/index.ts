import type { Catalog, Locale, UiCopy } from './types';
import { LOCALES } from './types';
export { LOCALES };
export type { Locale, UiCopy, Catalog };
import { en } from './en';
import { de } from './de';
import { fa } from './fa';

const STORAGE_KEY = 'learndbt-locale';
const catalogs: Record<Locale, Catalog> = { en, de, fa };
let current: Locale = 'en';

function isLocale(v: string | null | undefined): v is Locale {
  return !!v && (LOCALES as string[]).includes(v);
}

export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    /* private */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : '';
  if (nav.toLowerCase().startsWith('de')) return 'de';
  if (nav.toLowerCase().startsWith('fa') || nav.toLowerCase().startsWith('pe')) return 'fa';
  return 'en';
}

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  current = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
  applyDocumentLocale();
}

export function getCatalog(): Catalog {
  return catalogs[current];
}

export function ui(): UiCopy {
  return catalogs[current].ui;
}

export function getDir(): 'ltr' | 'rtl' {
  return catalogs[current].dir;
}

export function applyDocumentLocale(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = current;
  document.documentElement.dir = getDir();
}

export function initLocale(): Locale {
  current = detectLocale();
  applyDocumentLocale();
  return current;
}
