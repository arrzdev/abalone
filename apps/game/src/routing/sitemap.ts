import { localePath } from "@/i18n/locale-path"
import type { IndexablePath } from "@/routing/seo-pages"
import { PAGE_LANGUAGES, SITEMAP } from "@/routing/seo-pages"
import { siteUrl } from "@/utils/site"

/**
 * `sitemap.xml`: one entry per page in `SITEMAP` and language in
 * `PAGE_LANGUAGES`, dated the day that page last changed. Each entry names
 * every language version of its page as an `xhtml:link`, plus `x-default` on
 * the English URL: the same set the page head names (`seo-pages.ts`).
 * Written into the client assets at build time
 * (`scripts/crawler-files.plugin.ts`).
 */
export function sitemapXml(): string {
  const entries = Object.entries(SITEMAP).flatMap(([path, lastmod]) =>
    PAGE_LANGUAGES[path as keyof typeof SITEMAP].map((language) =>
      entry(path as IndexablePath, language, lastmod),
    ),
  )
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`,
    ...entries,
    `</urlset>`,
    "",
  ].join("\n")
}

function entry(
  path: IndexablePath,
  language: (typeof PAGE_LANGUAGES)[IndexablePath][number],
  lastmod: string,
): string {
  const alternates = [
    ...PAGE_LANGUAGES[path].map((other) =>
      alternate(other, siteUrl(localePath(path, other))),
    ),
    alternate("x-default", siteUrl(path)),
  ]
  return [
    `  <url>`,
    `    <loc>${siteUrl(localePath(path, language))}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    ...alternates,
    `  </url>`,
  ].join("\n")
}

function alternate(hreflang: string, href: string): string {
  return `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${href}"/>`
}
