import type { PostProcessorModule, Resource } from "i18next"
import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import type { Language } from "@/i18n/languages"
import { isSupported, SUPPORTED_LANGUAGES } from "@/i18n/languages"
import { pickLanguage, splitLocalePath } from "@/i18n/locale-path"
import { localeResources, NAMESPACES } from "@/i18n/locale-resources"
import {
  browserLanguages,
  savedLanguage,
  saveLanguage,
} from "@/i18n/saved-language"
import { brandText } from "@/utils/brand"

export type { Language } from "@/i18n/languages"
export { LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from "@/i18n/languages"

const FALLBACK_LANGUAGE: Language = "en"

//the server and the tests hold every language already; the browser starts with
//none and `loadLanguage` adds one (`@/i18n/locale-resources`)
const resources: Resource = {}
for (const language of SUPPORTED_LANGUAGES) {
  for (const namespace of NAMESPACES) {
    const bundle = localeResources.resource(language, namespace)
    if (!bundle) continue
    resources[language] ??= {}
    resources[language][namespace] = bundle
  }
}

/**
 * The language of the address, else the saved choice, else the browser's, else
 * English.
 *
 * A prefixed address (`/pt/rules`) is always its own language. An unprefixed one
 * is English unless the visitor saved or browses in another language, in which
 * case the client entry has already moved the page to its prefixed address
 * (`clientLocaleRedirect`) and this never sees it; the same answer here keeps a
 * page that is not moved (a test, a tool) in the language that visitor wants.
 *
 * Returns English on the server without looking: it has no storage and no
 * navigator, and renders each request in its own language through a clone of
 * this instance (`@/providers/locale-provider`) instead of this one's.
 */
function detectLanguage(): Language {
  if (typeof window === "undefined") return "en"

  const location = splitLocalePath(window.location.pathname)
  if (location.prefixed) return location.language

  return pickLanguage({
    cookie: savedLanguage(),
    acceptLanguage: browserLanguages(),
  })
}

/**
 * The easter egg, applied to finished text rather than to the locale files.
 *
 * A post-processor runs after interpolation and after the fallback chain, so it
 * is the one place every string in the app passes through — thirteen languages
 * and five namespaces included — and the locale files stay the plain
 * translations they are.
 */
const brandPostProcessor: PostProcessorModule = {
  type: "postProcessor",
  name: "brand",
  process(value) {
    return brandText(value)
  },
}

//the server writes <html lang> from the address, so this keeps the document
//right after a switch in Settings, and on load for a page it did not serve
i18next.on("languageChanged", (language) => {
  if (typeof document === "undefined") return
  document.documentElement.lang = language
})

i18next
  .use(brandPostProcessor)
  .use(initReactI18next)
  .init({
    lng: detectLanguage(),
    fallbackLng: FALLBACK_LANGUAGE,
    ns: [...NAMESPACES],
    defaultNS: "game",
    resources,
    interpolation: { escapeValue: false },
    postProcess: "brand",
  })

/**
 * Fetches a language's translations and hands them to i18next, which is what
 * makes it switchable. Resolves at once for a language already in hand.
 *
 * English comes with every language: the other twelve do not translate every
 * key yet (the guides are English-only in most), and i18next answers a missing
 * key from English. Without it those would render as bare keys. English is
 * also in the entry's own dependencies (the page heads and the bot pools read
 * it), so it adds no request.
 */
export async function loadLanguage(language: Language): Promise<void> {
  const languages = new Set<Language>([language, FALLBACK_LANGUAGE])
  await Promise.all(
    [...languages].map((each) => localeResources.load(each)),
  )

  for (const each of languages) {
    for (const namespace of NAMESPACES) {
      const bundle = localeResources.resource(each, namespace)
      if (!bundle) continue
      if (i18next.hasResourceBundle(each, namespace)) continue
      i18next.addResourceBundle(each, namespace, bundle)
    }
  }
}

/**
 * Resolves when the language the page booted in is ready to render. The client
 * entry waits for it before hydrating, so the first paint is already in that
 * language rather than a flash of keys.
 */
export const i18nReady: Promise<void> = loadLanguage(
  i18next.language as Language,
)

/**
 * Moves the app to a language and remembers the choice. The translations are
 * fetched first, so the text never goes blank in between: until they arrive
 * the page keeps the language it has. Rejects if they cannot be fetched (no
 * network and never cached), leaving the language and the saved choice as they
 * were.
 */
export async function changeLanguage(language: Language): Promise<void> {
  if (!isSupported(language)) return
  await loadLanguage(language)
  saveLanguage(language)
  await i18next.changeLanguage(language)
}

export default i18next
