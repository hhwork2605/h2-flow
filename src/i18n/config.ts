/**
 * i18n/config.ts — i18next initialiser.
 *
 * Layer: Infra
 * Owner: i18n
 *
 * Phase 1 scope: bundle both locales locally so the UI never blanks. The
 * server-managed translations from `/i18n/{locale}` (mock route already
 * available) will be merged in via a custom backend in Phase 6, after the
 * translation catalog stabilises.
 *
 * Reference: reference-ext/src/core/I18n.js — same key namespaces, similar
 * default-locale-from-server flow (we listen for `/default-settings` instead
 * of hard-coding `vi`).
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getStorage, onStorageChange, setStorage } from '@/storage/chrome-storage';
import vi from './locales/vi.json';
import en from './locales/en.json';

export type SupportedLocale = 'vi' | 'en';
export const SUPPORTED_LOCALES: SupportedLocale[] = ['vi', 'en'];

const LOCALE_KEY = 'af_locale';
const DEFAULT_LOCALE: SupportedLocale = 'vi';

let initialised = false;
let initPromise: Promise<typeof i18n> | null = null;

export function initI18n(): Promise<typeof i18n> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (initialised) return i18n;
    const stored = await getStorage<SupportedLocale>(LOCALE_KEY);
    const startLocale =
      stored && SUPPORTED_LOCALES.includes(stored) ? stored : DEFAULT_LOCALE;

    await i18n.use(initReactI18next).init({
      resources: {
        vi: { translation: vi },
        en: { translation: en },
      },
      lng: startLocale,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      returnNull: false,
      react: { useSuspense: false },
    });

    // Cross-context sync — settings page changes locale, sidebar picks it up.
    onStorageChange<SupportedLocale>(LOCALE_KEY, (newValue) => {
      if (newValue && newValue !== i18n.language && SUPPORTED_LOCALES.includes(newValue)) {
        void i18n.changeLanguage(newValue);
      }
    });

    initialised = true;
    return i18n;
  })();
  return initPromise;
}

export async function setLocale(locale: SupportedLocale): Promise<void> {
  await i18n.changeLanguage(locale);
  await setStorage(LOCALE_KEY, locale);
}

export function currentLocale(): SupportedLocale {
  const lng = i18n.language as SupportedLocale;
  return SUPPORTED_LOCALES.includes(lng) ? lng : DEFAULT_LOCALE;
}

export { i18n };
