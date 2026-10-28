import type { Language } from "@/i18n/languages"
import { isSupported } from "@/i18n/languages"
import { DEFAULT_LANGUAGE } from "@/i18n/locale-path"

/**
 * The language of the URL a route is being matched for, from the router's
 * context (`src/router.tsx`). The root route declares no context type, so the
 * value is read out of an untyped bag, once, here.
 */
export function routeLanguage(context: object): Language {
  //why: the router writes `language` into its context, which no route types
  const language = (context as { language?: string }).language
  return isSupported(language) ? language : DEFAULT_LANGUAGE
}
