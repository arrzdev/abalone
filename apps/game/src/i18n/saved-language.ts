import { isSupported } from "@/i18n/languages"
import {
  LANGUAGE_COOKIE,
  localeRedirect,
  readLanguageCookie,
} from "@/i18n/locale-path"

/**
 * The language picked in Settings, kept where the Worker can read it: a
 * year-long cookie. The choice used to live in `localStorage` alone, which no
 * request carries, so an unprefixed visit could not be sent to it.
 */

//where the choice lived before the cookie; still read, so a player who picked
//a language before the move is not asked again
const LEGACY_STORAGE_KEY = "abalone_language"

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/** Writes the choice as a cookie, for the Worker to read on the next visit. */
export function saveLanguage(language: string): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  //biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is not in every Safari we ship to
  document.cookie = `${LANGUAGE_COOKIE}=${language}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax${secure}`
}

/**
 * The saved choice, if it is a language we ship: the cookie, else the old
 * `localStorage` key. The old key is only read, never copied into a cookie: a
 * copy would outrank the key from then on, and the next pick writes the cookie
 * anyway.
 */
export function savedLanguage(): string | null {
  const fromCookie = readLanguageCookie(document.cookie)
  if (isSupported(fromCookie ?? undefined)) return fromCookie

  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    return isSupported(legacy ?? undefined) ? legacy : null
  } catch {
    //localStorage unavailable (private mode): nothing was ever saved there
    return null
  }
}

/** The browser's languages as an `Accept-Language` value, best first. */
export function browserLanguages(): string | null {
  if (navigator.languages?.length) return navigator.languages.join(",")
  return navigator.language || null
}

/**
 * Where this page load should go instead: the same check the Worker makes
 * (`localeRedirect`), repeated because the service worker answers a navigation
 * without reaching the Worker. `null` when the address is already right.
 */
export function clientLocaleRedirect(): string | null {
  const redirect = localeRedirect({
    pathname: window.location.pathname,
    search: window.location.search,
    cookie: savedLanguage(),
    acceptLanguage: browserLanguages(),
  })
  if (!redirect) return null
  return `${redirect.location}${window.location.hash}`
}
