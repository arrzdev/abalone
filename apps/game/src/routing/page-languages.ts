import type { Language } from "@/i18n/languages"
import { SUPPORTED_LANGUAGES } from "@/i18n/languages"
import { DEFAULT_LANGUAGE } from "@/i18n/locale-path"
import type { IndexablePath } from "@/routing/seo-pages"

/**
 * The languages each indexable page has a URL in: the ones its body copy is
 * translated into. A page missing from a language falls back to English text,
 * so its `/pt/...` URL still answers but is no page of its own: it is left out
 * of the sitemap and the `hreflang` set, and its canonical is the English URL.
 * `seo-locales.test.ts` checks this table against the locale files.
 * Its own file, and no more than types from `seo-pages.ts`, so the browser
 * boot can read it without the page copy.
 */
export const PAGE_LANGUAGES: Record<IndexablePath, readonly Language[]> = {
  "/": SUPPORTED_LANGUAGES,
  "/rules": SUPPORTED_LANGUAGES,
  "/strategy": SUPPORTED_LANGUAGES,
  "/how-to-play": ["en"],
  "/opening-moves": ["en", "de", "fr", "nl", "es"],
  "/starting-positions": ["en", "de", "fr", "nl", "es"],
  "/offline": SUPPORTED_LANGUAGES,
  "/play-online": ["en"],
}

/**
 * The language to write in `<html lang>` for the page at `path` (unprefixed,
 * as the route table spells it) under a URL in `language`. A page whose body is
 * not translated into `language` is served as English text, so it says `en`
 * rather than naming a language its words are not in. Every other path (the
 * board, sign-in, an invite) has no table row and keeps the URL's language.
 */
export function documentLanguage(
  path: string,
  language: Language,
): Language {
  const page = (
    path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path
  ) as IndexablePath
  const languages: readonly Language[] | undefined = PAGE_LANGUAGES[page]
  if (languages === undefined || languages.includes(language))
    return language
  return DEFAULT_LANGUAGE
}
