import { describe, expect, it } from "vitest"
import { PAGE_LANGUAGES, SITEMAP } from "@/routing/seo-pages"
import { sitemapXml } from "@/routing/sitemap"

const ORIGIN = "https://abalone.tudu.dev"

/** Each `<url>` block, keyed by its `<loc>`. */
function entries(xml: string): Map<string, string> {
  const blocks = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(
    (match) => match[1],
  )
  return new Map(
    blocks.map((block) => [
      block.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? "",
      block,
    ]),
  )
}

function alternatesIn(block: string): Record<string, string> {
  return Object.fromEntries(
    [
      ...block.matchAll(
        /<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\s*\/>/g,
      ),
    ].map((match) => [match[1], match[2]]),
  )
}

function url(path: string, language: string): string {
  if (language === "en") return `${ORIGIN}${path}`
  return path === "/"
    ? `${ORIGIN}/${language}`
    : `${ORIGIN}/${language}${path}`
}

describe("sitemapXml", () => {
  const xml = sitemapXml()
  const listed = entries(xml)

  it("declares the xhtml namespace the alternates use", () => {
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
  })

  it("lists every sitemap page once per language it is in", () => {
    const expected = Object.keys(SITEMAP).flatMap((path) =>
      PAGE_LANGUAGES[path as keyof typeof SITEMAP].map((language) =>
        url(path, language),
      ),
    )
    expect([...listed.keys()].sort()).toEqual(expected.sort())
  })

  it("lists /rules in portuguese, with the date its text changed", () => {
    const block = listed.get(`${ORIGIN}/pt/rules`)
    expect(block).toBeDefined()
    expect(block).toContain(`<lastmod>${SITEMAP["/rules"]}</lastmod>`)
  })

  it("names every language version and x-default on each entry", () => {
    for (const language of PAGE_LANGUAGES["/rules"]) {
      const block = listed.get(url("/rules", language)) ?? ""
      expect(alternatesIn(block)).toEqual(
        Object.fromEntries([
          ...PAGE_LANGUAGES["/rules"].map((other) => [
            other,
            url("/rules", other),
          ]),
          ["x-default", `${ORIGIN}/rules`],
        ]),
      )
    }
  })

  it("leaves out a page in a language it is not translated into", () => {
    expect(listed.has(`${ORIGIN}/pt/opening-moves`)).toBe(false)
  })
})
