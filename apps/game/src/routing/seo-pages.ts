import type { SocialImage } from "@/routing/page-head"
import { pageHead } from "@/routing/page-head"

/**
 * The pages a search engine should list, and the words it lists them under.
 *
 * One table so the route heads, the sitemap and the tests read the same copy
 * (the `page-copy` document on TUD-626). Titles are written in full: these are
 * the line a search result shows, so the brand is part of the sentence rather
 * than a suffix.
 *
 * The sitemap is built from this table's keys at build time
 * (`scripts/sitemap.plugin.ts`), so a page added here is listed there too.
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
  "/" | "/rules" | "/strategy" | "/offline",
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
  "/offline": {
    title: "Play Abalone vs the computer or a friend on one device",
    description:
      "Play Abalone against the computer or pass the device to a friend. Pick the standard layout or a daisy opening and start a free game in your browser.",
    image: "game",
  },
}

export type IndexablePath = keyof typeof SEO_PAGES

/** A `<script type="application/ld+json">` in the route head. */
export type StructuredDataScript = {
  type: "application/ld+json"
  children: string
}

/** The route `head` for one indexable page. */
export function seoPageHead(path: IndexablePath) {
  //TODO(TUD-632 PR B): contract stub from the draft PR, so the failing tests
  //compile. Each page's JSON-LD goes here
  const scripts: StructuredDataScript[] = []
  return {
    ...pageHead({ ...SEO_PAGES[path], path, fullTitle: true }),
    scripts,
  }
}
