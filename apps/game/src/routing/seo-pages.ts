import type { SocialImage } from "@/routing/page-head"
import { pageHead } from "@/routing/page-head"
import { structuredDataScripts } from "@/routing/structured-data"

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
  "/" | "/rules" | "/strategy" | "/opening-moves" | "/offline",
  SeoPage
> = {
  "/": {
    title: "Abalone: play the board game online, free",
    description:
      "Play Abalone free online. Challenge the computer, share a screen with a friend or invite someone to a live game. No download, no sign-up needed to start.",
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
  "/opening-moves": {
    title: "Abalone opening moves: a guide for beginners",
    description:
      "Abalone opening moves for beginners: the starting position, safe first moves, side steps and how the daisy layouts change the opening. Try them free.",
    image: "rules",
  },
  "/offline": {
    title: "Play Abalone vs the computer or a friend on one device",
    description:
      "Play Abalone against the computer or pass the device to a friend. Pick the standard layout or a daisy opening and start a free game in your browser.",
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
  "/": "2026-10-12",
  "/rules": "2026-10-14",
  "/strategy": "2026-10-14",
  "/opening-moves": "2026-10-17",
}

/** The route `head` for one indexable page, with its JSON-LD. */
export function seoPageHead(path: IndexablePath) {
  const page = SEO_PAGES[path]
  return {
    ...pageHead({ ...page, path, fullTitle: true }),
    scripts: structuredDataScripts(path, page),
  }
}
