import type { Language } from "@/i18n/languages"

/**
 * Which language a URL is in, and the URL of a page in a given language.
 *
 * English is the default and keeps the paths it always had (`/rules`); every
 * other language lives under its code (`/pt/rules`, `/pt` for home). A visit
 * to an unprefixed path is sent to the visitor's language: the one they saved
 * in Settings (the cookie), else the browser's (`Accept-Language`), else it
 * stays English. A prefixed URL is never redirected to another language: it is
 * the link someone shared or a search result listed. `/en/...` is not a URL of
 * its own and moves to the unprefixed path. Design: `docs/locale-urls.md`.
 *
 * Contract only, implemented in the TUD-3100 follow-up: every function below
 * answers as if the app had one language, so the tests in
 * `locale-path.test.ts` fail until it lands.
 */

export const DEFAULT_LANGUAGE: Language = "en"

/** Holds the language picked in Settings, readable by the Worker. */
export const LANGUAGE_COOKIE = "abalone_language"

export type LocalePath = {
  language: Language
  /** The path without its prefix, as the route table spells it. */
  path: string
  /** Whether the URL carried a language segment, `/en` included. */
  prefixed: boolean
}

/** `path` (as the route table spells it) in `language`. */
export function localePath(path: string, _language: Language): string {
  return path
}

/** Reads the language segment off a pathname. */
export function splitLocalePath(pathname: string): LocalePath {
  return { language: DEFAULT_LANGUAGE, path: pathname, prefixed: false }
}

/**
 * The saved choice when it is a language we ship, else the best match in
 * `Accept-Language` by its q-values, compared on the primary subtag, else
 * English.
 */
export function pickLanguage(_visitor: {
  cookie: string | null
  acceptLanguage: string | null
}): Language {
  return DEFAULT_LANGUAGE
}

export type LocaleRedirect = { location: string; status: 301 | 302 }

/**
 * Where a page request should go instead, or `null` to serve it. Only page
 * paths: `/api/`, and anything with a file extension, are served as they are.
 * 302 for a detected language, since the answer depends on who asks (the
 * response carries `Vary: Accept-Language, Cookie`); 301 for `/en/...`, which
 * is the same answer for everyone.
 */
export function localeRedirect(_request: {
  pathname: string
  search: string
  cookie: string | null
  acceptLanguage: string | null
}): LocaleRedirect | null {
  return null
}
