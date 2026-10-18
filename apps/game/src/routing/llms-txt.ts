import { SEO_PAGES } from "@/routing/seo-pages"
import { siteUrl } from "@/utils/site"

/**
 * The `/llms.txt` an answer engine reads to learn what the site is
 * (llmstxt.org): a name, the home page title as the one-line summary, a short
 * paragraph, then every page in `SEO_PAGES` with its title and description.
 *
 * Built from the same table as the route heads and the sitemap, so a page
 * added there is listed here too, under the same words.
 */
const ABOUT =
  "Abalone is a two-player strategy board game: each side pushes the other's marbles off a hexagonal board, and the first to push off six wins. " +
  "This site plays it free in the browser, with no download and no sign-up needed to start. " +
  "Play against the computer, pass one device between two players, or invite a friend to a live game online."

export function llmsTxt(): string {
  const links = Object.entries(SEO_PAGES).map(
    ([path, page]) =>
      `- [${page.title}](${siteUrl(path)}): ${page.description}`,
  )
  return [
    "# Abalone",
    "",
    `> ${SEO_PAGES["/"].title}`,
    "",
    ABOUT,
    "",
    "## Pages",
    "",
    ...links,
    "",
  ].join("\n")
}
