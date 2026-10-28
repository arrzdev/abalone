import type { Language } from "@/i18n/languages"
import { isSupported } from "@/i18n/languages"

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
export function localePath(path: string, language: Language): string {
  if (language === DEFAULT_LANGUAGE) return path
  if (path === "/") return `/${language}`
  return `/${language}${path}`
}

/** Reads the language segment off a pathname. */
export function splitLocalePath(pathname: string): LocalePath {
  const [, segment = "", ...rest] = pathname.split("/")
  if (!isSupported(segment)) {
    return { language: DEFAULT_LANGUAGE, path: pathname, prefixed: false }
  }
  const path = `/${rest.join("/")}`
  return { language: segment, path, prefixed: true }
}

/** The saved language out of a `Cookie` header, if it names one we ship. */
export function readLanguageCookie(header: string | null): string | null {
  if (header === null) return null
  for (const pair of header.split(";")) {
    const [name, ...value] = pair.trim().split("=")
    if (name === LANGUAGE_COOKIE) return value.join("=")
  }
  return null
}

/** Accept-Language entries by q, highest first; ties keep the header's order. */
function rankedBrowserLanguages(header: string): string[] {
  const ranked = header
    .split(",")
    .map((entry, order) => {
      const [tag = "", ...parameters] = entry.trim().split(";")
      const qParameter = parameters
        .map((parameter) => parameter.trim())
        .find((parameter) => parameter.startsWith("q="))
      const quality = qParameter ? Number(qParameter.slice(2)) : 1
      return {
        primary: tag.trim().toLowerCase().split("-")[0],
        quality: Number.isNaN(quality) ? 0 : quality,
        order,
      }
    })
    .filter((entry) => entry.primary !== "" && entry.quality > 0)
  ranked.sort(
    (first, second) =>
      second.quality - first.quality || first.order - second.order,
  )
  return ranked.map((entry) => entry.primary)
}

/**
 * The saved choice when it is a language we ship, else the best match in
 * `Accept-Language` by its q-values, compared on the primary subtag, else
 * English.
 */
export function pickLanguage(visitor: {
  cookie: string | null
  acceptLanguage: string | null
}): Language {
  if (isSupported(visitor.cookie ?? undefined))
    return visitor.cookie as Language
  if (visitor.acceptLanguage === null) return DEFAULT_LANGUAGE

  const match = rankedBrowserLanguages(visitor.acceptLanguage).find(
    (primary) => isSupported(primary),
  )
  return (match as Language | undefined) ?? DEFAULT_LANGUAGE
}

export type LocaleRedirect = { location: string; status: 301 | 302 }

//a file (`/sitemap.xml`), the api, and the framework's own `/_...` paths
function isPagePath(pathname: string): boolean {
  if (pathname.startsWith("/api/") || pathname.startsWith("/_"))
    return false
  const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1)
  return !lastSegment.includes(".")
}

/**
 * Where a page request should go instead, or `null` to serve it. Only page
 * paths: `/api/`, and anything with a file extension, are served as they are.
 * 302 for a detected language, since the answer depends on who asks (the
 * response carries `Vary: Accept-Language, Cookie`); 301 for `/en/...`, which
 * is the same answer for everyone.
 */
export function localeRedirect(request: {
  pathname: string
  search: string
  cookie: string | null
  acceptLanguage: string | null
}): LocaleRedirect | null {
  if (!isPagePath(request.pathname)) return null

  const split = splitLocalePath(request.pathname)
  if (split.prefixed) {
    if (split.language !== DEFAULT_LANGUAGE) return null
    return { location: `${split.path}${request.search}`, status: 301 }
  }

  const language = pickLanguage(request)
  if (language === DEFAULT_LANGUAGE) return null
  return {
    location: `${localePath(split.path, language)}${request.search}`,
    status: 302,
  }
}
