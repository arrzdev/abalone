import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

export const SUPPORTED_LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ja', 'zh', 'ko', 'hi', 'tr'];

export const LANGUAGE_NAMES = {
  en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', it: 'Italiano',
  pt: 'Português', nl: 'Nederlands', pl: 'Polski', ja: '日本語', zh: '中文',
  ko: '한국어', hi: 'हिन्दी', tr: 'Türkçe',
};

export const LANGUAGE_FLAGS = {
  en: '🇬🇧', de: '🇩🇪', fr: '🇫🇷', es: '🇪🇸', it: '🇮🇹', pt: '🇵🇹', nl: '🇳🇱',
  pl: '🇵🇱', ja: '🇯🇵', zh: '🇨🇳', ko: '🇰🇷', hi: '🇮🇳', tr: '🇹🇷',
};

// Locales could be fetched over HTTP at runtime, but bundling them
// removes the network round-trip and the language-prefixed URL scheme, so the
// build is a self-contained static app.
const modules = import.meta.glob('./locales/*/*.json', { eager: true });

const resources = {};
for (const [path, module] of Object.entries(modules)) {
  const match = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/);
  if (!match) continue;
  const [, lng, ns] = match;
  resources[lng] ??= {};
  resources[lng][ns] = module.default ?? module;
}

const LANGUAGE_STORAGE_KEY = 'abalone_language';

function detectLanguage() {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;
  } catch {
    // localStorage unavailable (private mode) — fall through to the browser language.
  }

  const browserLang = navigator.language?.split('-')[0];
  if (SUPPORTED_LANGUAGES.includes(browserLang)) return browserLang;

  return 'en';
}

i18next.use(initReactI18next).init({
  lng: detectLanguage(),
  fallbackLng: 'en',
  ns: ['common', 'game', 'bots'],
  defaultNS: 'game',
  resources,
  interpolation: { escapeValue: false },
});

export function changeLanguage(lng) {
  if (!SUPPORTED_LANGUAGES.includes(lng)) return;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  } catch {
    // Preference is best-effort; the switch itself still applies.
  }
  i18next.changeLanguage(lng);
  document.documentElement.lang = lng;
}

export default i18next;
