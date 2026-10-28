import { SITEMAP } from "@/routing/seo-pages"
import { siteUrl } from "@/utils/site"

/**
 * `sitemap.xml`: one entry per page in `SITEMAP`, dated the day that page last
 * changed. Written into the client assets at build time
 * (`scripts/crawler-files.plugin.ts`).
 *
 * TUD-3100 follow-up: one entry per page and language in `PAGE_LANGUAGES`,
 * each with an `xhtml:link` per language version plus `x-default`, the same
 * set the page head names (`sitemap.test.ts`).
 */
export function sitemapXml(): string {
  const entries = Object.entries(SITEMAP).map(
    ([path, lastmod]) =>
      `  <url>\n    <loc>${siteUrl(path)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`,
  )
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...entries,
    `</urlset>`,
    "",
  ].join("\n")
}
