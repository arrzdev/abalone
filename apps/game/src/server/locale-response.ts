import type { Language } from "@/i18n/languages"
import type { LocaleRedirect } from "@/i18n/locale-path"
import { DEFAULT_LANGUAGE } from "@/i18n/locale-path"

/**
 * What the Worker adds to a page response for the language of its URL
 * (`docs/locale-urls.md`).
 */

//what an unprefixed page's answer depends on: who is asking
const VARY = "Accept-Language, Cookie"

/** The move to a language's URL; the `Vary` says the answer depends on the visitor. */
export function redirectResponse(redirect: LocaleRedirect): Response {
  return new Response(null, {
    status: redirect.status,
    headers: { location: redirect.location, vary: VARY },
  })
}

function isHtml(response: Response): boolean {
  return (
    response.headers.get("content-type")?.includes("text/html") ?? false
  )
}

/**
 * A page served at an unprefixed URL, marked as depending on the visitor's
 * cookie and language: the same URL is a redirect for one and English for
 * another, and a cache must not hand one's answer to the other.
 */
export function withVaryOnVisitor(response: Response): Response {
  if (!isHtml(response)) return response
  const varied = new Response(response.body, response)
  varied.headers.append("vary", VARY)
  return varied
}

/**
 * The page with `<html lang>` set to the language of its URL. Start writes
 * the one language `nativ.config.ts` names; the head and the body it rendered
 * are already in the URL's language (`@/providers/locale-provider`), and this
 * is the one attribute that sits outside the React tree it renders.
 */
export function withDocumentLanguage(
  response: Response,
  language: Language,
): Response {
  if (language === DEFAULT_LANGUAGE || !isHtml(response)) return response

  return new HTMLRewriter()
    .on("html", {
      element(element) {
        element.setAttribute("lang", language)
      },
    })
    .transform(response)
}
