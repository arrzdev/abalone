import { BRAND } from "@/utils/brand"
import { siteUrl } from "@/utils/site"

/**
 * A page's title, its one-line description, and the picture a link to it
 * unfurls with.
 *
 * ---- what this reaches, and what it does not ----------------
 *
 * The app is a SPA behind one prerendered shell, so every route is served the
 * same HTML and the head in that file is the root's (stamped from
 * `nativ.config.ts`). What this helper writes is applied by the router, which
 * means it lands for anything that runs the page: the tab title, the history
 * entry, the share sheet on a phone, and the crawlers that execute JavaScript.
 *
 * The ones that do not run JavaScript — the card renderers behind a chat app or
 * a social post — read the shell head and stop. They see the root card for every
 * URL, which is why the root card is the front door and not a blank. Giving each
 * path its own card means prerendering each path, which is a build change, not
 * a head change.
 */

/** The pictures in `public/images/social`, by what they show. */
export type SocialImage = "home" | "game" | "rules"

export type PageHeadOptions = {
  /** The page's own name. The brand is appended here, not by the caller. */
  title: string
  /**
   * One line, under about 160 characters: the sentence under the link, and the
   * one a search result quotes. Longer is not more, it is truncated.
   */
  description: string
  /** The page's path, for `og:url`. */
  path: string
  /** Default `"home"`. */
  image?: SocialImage
  /**
   * Keep the page out of search results. For everything behind sign-in: it is
   * one account's own screen, and indexing it lists a door nobody else opens.
   */
  noIndex?: boolean
}

/**
 * The `head` payload for one route. Every key here also exists in the shell
 * head, and the router takes the deepest match — so a page overrides the root
 * rather than adding a second copy of it.
 */
export function pageHead(options: PageHeadOptions) {
  const title = `${options.title} · ${BRAND}`
  const image = siteUrl(`/images/social/og-${options.image ?? "home"}.jpg`)

  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: options.description },
    { property: "og:title", content: title },
    { property: "og:description", content: options.description },
    { property: "og:url", content: siteUrl(options.path) },
    { property: "og:image", content: image },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: options.description },
    { name: "twitter:image", content: image },
  ]

  if (options.noIndex) meta.push({ name: "robots", content: "noindex" })

  return { meta }
}
