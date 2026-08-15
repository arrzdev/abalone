import type { Resource, ResourceKey } from "i18next"
import i18next from "i18next"
import { initReactI18next } from "react-i18next"

export const SUPPORTED_LANGUAGES = [
  "en",
  "de",
  "fr",
  "es",
  "it",
  "pt",
  "nl",
  "pl",
  "ja",
  "zh",
  "ko",
  "hi",
  "tr",
] as const

export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  pt: "Português",
  nl: "Nederlands",
  pl: "Polski",
  ja: "日本語",
  zh: "中文",
  ko: "한국어",
  hi: "हिन्दी",
  tr: "Türkçe",
}

export const LANGUAGE_FLAGS: Record<Language, string> = {
  en: "🇬🇧",
  de: "🇩🇪",
  fr: "🇫🇷",
  es: "🇪🇸",
  it: "🇮🇹",
  pt: "🇵🇹",
  nl: "🇳🇱",
  pl: "🇵🇱",
  ja: "🇯🇵",
  zh: "🇨🇳",
  ko: "🇰🇷",
  hi: "🇮🇳",
  tr: "🇹🇷",
}

function isSupported(value: string | undefined): value is Language {
  return (
    value !== undefined &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  )
}

//locales could be fetched over http at runtime, but bundling them removes the
//network round-trip and the language-prefixed url scheme, so the build is a
//self-contained static app.
const modules = import.meta.glob<{ default: ResourceKey }>(
  "./locales/*/*.json",
  { eager: true },
)

const resources: Resource = {}
for (const [path, module] of Object.entries(modules)) {
  const match = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/)
  if (!match) continue
  const language = match[1]
  const namespace = match[2]
  resources[language] ??= {}
  resources[language][namespace] = module.default
}

const LANGUAGE_STORAGE_KEY = "abalone_language"

/**
 * The stored choice, else the browser's, else English.
 *
 * Returns English on the server without looking: the shell is prerendered, so
 * there is no storage and no navigator to ask, and the real answer arrives one
 * frame later when the client takes over.
 */
function detectLanguage(): Language {
  if (typeof window === "undefined") return "en"

  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (isSupported(stored ?? undefined)) return stored as Language
  } catch {
    //localStorage unavailable (private mode) — fall through to the browser language
  }

  const browserLanguage = navigator.language?.split("-")[0]
  if (isSupported(browserLanguage)) return browserLanguage

  return "en"
}

i18next.use(initReactI18next).init({
  lng: detectLanguage(),
  fallbackLng: "en",
  ns: ["common", "game", "bots", "errors"],
  defaultNS: "game",
  resources,
  interpolation: { escapeValue: false },
})

export function changeLanguage(language: Language): void {
  if (!isSupported(language)) return
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    //preference is best-effort; the switch itself still applies
  }
  void i18next.changeLanguage(language)
  document.documentElement.lang = language
}

export default i18next
