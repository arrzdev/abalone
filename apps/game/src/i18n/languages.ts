/**
 * The languages the game ships in, with no i18next attached: the Worker reads
 * these to pick a URL prefix, and it must not boot the client's i18n to do it.
 */
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

export function isSupported(value: string | undefined): value is Language {
  return (
    value !== undefined &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  )
}
