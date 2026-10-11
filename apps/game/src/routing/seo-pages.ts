import { pageHead } from "@/routing/page-head"

/**
 * The pages a search engine should list, and the words it lists them under.
 *
 * One table so the route heads, the sitemap and the tests read the same copy
 * (the `page-copy` document on TUD-626). Titles are written in full: these are
 * the line a search result shows, so the brand is part of the sentence rather
 * than a suffix.
 *
 * TODO(TUD-632 PR A): contract stub from the draft PR, so the failing tests
 * compile. Fill in the copy and wire the heads.
 */
export type SeoPage = {
  /** ≤ 60 characters, shown as is. */
  title: string
  /** ≤ 155 characters. */
  description: string
}

export const SEO_PAGES: Record<"/" | "/rules" | "/offline", SeoPage> = {
  "/": { title: "", description: "" },
  "/rules": { title: "", description: "" },
  "/offline": { title: "", description: "" },
}

export type IndexablePath = keyof typeof SEO_PAGES

/** The route `head` for one indexable page. */
export function seoPageHead(path: IndexablePath) {
  return pageHead({ ...SEO_PAGES[path], path })
}
