import type { i18n as I18nInstance } from "i18next"
import type { ReactNode } from "react"
import { useEffect } from "react"
import { I18nextProvider } from "react-i18next"
import { useUrlLanguage } from "@/hooks/use-url-language"
import type { Language } from "@/i18n"
import i18next from "@/i18n"

//one clone per language, made on first use. A clone shares the translations
//and owns its language, so a request reads its own and never moves another's.
const serverInstances = new Map<Language, I18nInstance>()

function serverInstanceFor(language: Language): I18nInstance {
  const existing = serverInstances.get(language)
  if (existing) return existing

  const clone = i18next.cloneInstance({ lng: language })
  serverInstances.set(language, clone)
  return clone
}

/**
 * Puts the app in the language of the address.
 *
 * On the server that is a clone of i18next for the language of this request:
 * the Worker answers many requests at once in one isolate, and the shared
 * instance has one current language, so switching it per request would render
 * one visitor's page in another's language. Nothing on the server ever calls
 * `changeLanguage`.
 *
 * In the browser the shared instance is the only one there is, and it booted
 * in the language of the address (`@/i18n`). It follows the address after
 * that, so back and forward between two languages' pages change the language
 * with them.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const language = useUrlLanguage()

  useEffect(() => {
    if (i18next.language !== language)
      void i18next.changeLanguage(language)
  }, [language])

  if (typeof window !== "undefined") return children

  return (
    <I18nextProvider i18n={serverInstanceFor(language)}>
      {children}
    </I18nextProvider>
  )
}
