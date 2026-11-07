import type { Language } from "@/i18n/languages"
import { SUPPORTED_LANGUAGES } from "@/i18n/languages"
import { DEFAULT_LANGUAGE } from "@/i18n/locale-path"
import { localeResources } from "@/i18n/locale-resources"
import type { SocialImage } from "@/routing/page-head"
import { pageHead } from "@/routing/page-head"
import {
  breadcrumbScripts,
  structuredDataScripts,
} from "@/routing/structured-data"

/**
 * The pages a search engine should list, and the words it lists them under.
 *
 * One table so the route heads, the sitemap and the tests read the same copy
 * (the `page-copy` document on TUD-626). Titles are written in full: these are
 * the line a search result shows, so the brand is part of the sentence rather
 * than a suffix.
 *
 * `llms.txt` is built from this table at build time
 * (`scripts/crawler-files.plugin.ts`), so a page added here is listed there too.
 * The sitemap is built from `SITEMAP` below; a page added here must be dated
 * there too, or left out by name.
 */
export type SeoPage = {
  /** ≤ 60 characters, shown as is. */
  title: string
  /** ≤ 155 characters. */
  description: string
  /** The card a shared link unfurls with. */
  image: SocialImage
}

export const SEO_PAGES: Record<
  | "/"
  | "/rules"
  | "/strategy"
  | "/how-to-play"
  | "/opening-moves"
  | "/starting-positions"
  | "/offline"
  | "/play-online",
  SeoPage
> = {
  "/": {
    title: "Abalone Online Free: Play the Board Game, No Account",
    description:
      "Play Abalone online free, no account. Beat the computer, share one screen with a friend or invite someone to a live game. No download needed.",
    image: "home",
  },
  "/rules": {
    title: "Abalone rules: how to play, moves, sumito and winning",
    description:
      "Learn the Abalone rules in minutes: how marbles move, how a sumito push works, how to win, plus the standard and daisy starting positions.",
    image: "rules",
  },
  "/strategy": {
    title: "Abalone strategy: 7 tips to win more games",
    description:
      "Seven Abalone strategy tips: control the center, keep groups of three, pick a safe opening and push at the right moment. Try them against the computer.",
    image: "rules",
  },
  "/how-to-play": {
    title: "How to play Abalone: rules in 5 steps and a first game",
    description:
      "How to play Abalone: the rules in five plain steps, a first game move by move and how to win. Then play the computer free, no account needed.",
    image: "rules",
  },
  "/opening-moves": {
    title: "Abalone opening moves: a guide for beginners",
    description:
      "Abalone opening moves for beginners: the starting position, safe first moves, side steps and how the daisy layouts change the opening. Try them free.",
    image: "rules",
  },
  "/starting-positions": {
    title: "Abalone Starting Position: Standard, Belgian or German Daisy",
    description:
      "Abalone starting position explained: standard, Belgian daisy and German daisy side by side, how they differ and which to pick. Try each free.",
    image: "rules",
  },
  "/offline": {
    title: "Play Abalone vs the computer or a friend on one device",
    description:
      "Play Abalone against the computer or pass the device to a friend. Pick the standard layout or a daisy opening and start a free game in your browser.",
    image: "game",
  },
  "/play-online": {
    title: "Play Abalone Online With Friends: Invite by Link",
    description:
      "Play Abalone online with friends. Create a free account, send an invite link and play a live game. Prefer no account? Play the computer instantly.",
    image: "game",
  },
}

export type IndexablePath = keyof typeof SEO_PAGES

/**
 * The pages `sitemap.xml` lists, each with the day its text last changed
 * (`YYYY-MM-DD`). Google trusts a `lastmod` only while it tracks real changes,
 * so bump a date when that page's copy changes, not on a layout fix.
 *
 * `/offline` is the board itself: it stays indexable, but home is the page that
 * answers "play abalone", so it is no sitemap entry.
 */
export const SITEMAP: Record<
  Exclude<IndexablePath, "/offline">,
  string
> = {
  "/": "2026-11-01",
  "/rules": "2026-11-07",
  "/strategy": "2026-11-07",
  "/play-online": "2026-11-01",
  "/how-to-play": "2026-11-02",
  "/opening-moves": "2026-11-07",
  "/starting-positions": "2026-11-07",
}

/**
 * The languages each indexable page has a URL in: the ones its body copy is
 * translated into. A page missing from a language falls back to English text,
 * so its `/pt/...` URL still answers but is no page of its own: it is left out
 * of the sitemap and the `hreflang` set, and its canonical is the English URL.
 * `seo-locales.test.ts` checks this table against the locale files.
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

//the title and description of a page in another language live in that
//language's `common.json`, under `seo`, next to the rest of its copy. the
//browser reads them once that language is loaded (`@/i18n/locale-resources`);
//a page head that runs before then falls back to English
type SeoLocale = {
  seo?: Record<string, { title: string; description: string }>
}

const SEO_KEYS: Partial<Record<IndexablePath, string>> = {
  "/": "home",
  "/rules": "rules",
  "/strategy": "strategy",
  "/opening-moves": "openings",
  "/starting-positions": "positions",
  "/offline": "offline",
}

/**
 * A page's title and description in `language`; English for a language the
 * page is not in. The image is the page's own, the same in every language.
 */
export function seoCopy(path: IndexablePath, language: Language): SeoPage {
  const english = SEO_PAGES[path]
  if (language === DEFAULT_LANGUAGE) return english
  if (!PAGE_LANGUAGES[path].includes(language)) return english

  const key = SEO_KEYS[path]
  const localized =
    key === undefined
      ? undefined
      : localeResources.resource<SeoLocale>(language, "common")?.seo?.[key]
  if (!localized) return english
  return { ...localized, image: english.image }
}

/**
 * The route `head` for one indexable page in `language`, with its JSON-LD:
 * the localized copy, a canonical on its own language's URL, and one
 * `hreflang` alternate per language in `PAGE_LANGUAGES` plus `x-default` on
 * the English URL.
 *
 * A page that is not in `language` is served in English text, so its head is
 * the English page's own: the canonical names the English URL and says no more
 * languages than there are. The JSON-LD stays English-only: it quotes the
 * page's English questions and steps, which a translated page does not show.
 * The breadcrumb trail is the exception: it quotes no body copy, only the
 * page's own name and URLs, so every language carries its own.
 */
export function seoPageHead(
  path: IndexablePath,
  language: Language = DEFAULT_LANGUAGE,
) {
  const pageLanguage = PAGE_LANGUAGES[path].includes(language)
    ? language
    : DEFAULT_LANGUAGE
  const page = seoCopy(path, pageLanguage)
  return {
    ...pageHead({
      ...page,
      path,
      fullTitle: true,
      language: pageLanguage,
      alternates: PAGE_LANGUAGES[path],
    }),
    scripts: [
      ...(pageLanguage === DEFAULT_LANGUAGE
        ? structuredDataScripts(path, page)
        : []),
      ...breadcrumbScripts(path, pageLanguage),
    ],
  }
}
