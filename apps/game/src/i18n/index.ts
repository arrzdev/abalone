import type { PostProcessorModule, Resource, ResourceKey } from "i18next"
import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import type { Language } from "@/i18n/languages"
import { isSupported } from "@/i18n/languages"
import { pickLanguage, splitLocalePath } from "@/i18n/locale-path"
import {
  browserLanguages,
  savedLanguage,
  saveLanguage,
} from "@/i18n/saved-language"
import { brandText } from "@/utils/brand"

export type { Language } from "@/i18n/languages"
export { LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from "@/i18n/languages"

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
    fallbackLng: "en",
    ns: ["common", "game", "bots", "errors", "online"],
    defaultNS: "game",
    resources,
    interpolation: { escapeValue: false },
    postProcess: "brand",
  })

export function changeLanguage(language: Language): void {
  if (!isSupported(language)) return
  saveLanguage(language)
  void i18next.changeLanguage(language)
}

export default i18next
