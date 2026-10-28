# Locale URLs

Every language the game ships in has URLs of its own, so a search engine can
list the Portuguese rules for someone searching in Portuguese. The model is the
one tudu.dev uses.

## The URL scheme

| URL | Serves |
|---|---|
| `/rules`, `/` | English, the paths the game always had |
| `/pt/rules`, `/pt` | Portuguese (any shipped language but English, by its code) |
| `/en/rules`, `/en` | 301 to `/rules`, `/` |

Every route takes the prefix, the signed-in screens too, so a visitor never
falls out of their language while moving around. A link inside the app keeps
the prefix of the page it is on.

`localePath`, `splitLocalePath` in `apps/game/src/i18n/locale-path.ts`.

## Which language a visit gets

1. A prefixed URL is served in its language, always. It is the link someone
   shared or a search result listed.
2. An unprefixed URL goes to the language saved in Settings: the
   `abalone_language` cookie, a year long, `SameSite=Lax`, path `/`.
3. No saved choice: the best `Accept-Language` match we ship, by q-value, on
   the primary subtag (`pt-BR` is `pt`).
4. Nothing matches, or no header (crawlers): English, served where it is.

A move is a 302 with `Vary: Accept-Language, Cookie`, since the answer depends
on who asks. The Worker (`apps/game/src/server.ts`) does it before Start, for
page requests only: `/api/` and paths with a file extension pass through. The
client repeats the check on boot, because the service worker can answer a
navigation without reaching the Worker.

Picking a language in Settings writes the cookie (and the old localStorage
key, read once as a fallback for players who picked before this change) and
moves the current page to its URL in that language. Picking English moves it
to the unprefixed path.

## What a crawler reads

The page renders in the URL's language on the server: `<html lang>`, the body
and the head. The language comes from the URL, per request, never from shared
module state: the Worker serves many requests at once.

Each indexable page in a language (`PAGE_LANGUAGES` in
`apps/game/src/routing/seo-pages.ts`) gets:

- its own title and description (`seoCopy`), the same in `og:` and `twitter:`;
- a canonical and `og:url` on its own URL;
- one `<link rel="alternate" hreflang>` per language it is in, plus
  `x-default` on the English URL.

`sitemap.xml` lists one entry per page and language, each with the same
alternates as `xhtml:link` (`apps/game/src/routing/sitemap.ts`).

## Pages not translated yet

A page is in a language only when its body copy is translated there
(`seo-locales.test.ts` checks the table against the locale files). Today the
opening moves, starting positions and play online pages are English only. Their
`/pt/...` URLs still answer, in English text with Portuguese chrome, but their
canonical is the English URL and they are in no sitemap or `hreflang` set. When
a translation lands, the test fails until the language is added to the table,
which adds the URL everywhere at once.
