import { expect, test } from "@playwright/test"

// What a crawler reads before it runs any JavaScript: the raw HTML each URL is
// served, plus robots.txt and the sitemap. Plain requests, no page, so these
// read the same bytes a `curl` against production does (tech-seo-spec on
// TUD-626). Browser-independent, so they run once, under chromium.

const CANONICAL_ORIGIN = "https://abalone.tudu.dev"

// Every page search engines should list, and the title it is listed under.
// The copy is pinned word for word in apps/game/src/routing/seo-pages.test.ts;
// here only the title, to prove the head reached the served HTML.
const INDEXABLE = {
  "/": "Abalone: play the board game online, free",
  "/rules": "Abalone rules: how to play, moves, sumito and winning",
  "/offline": "Play Abalone vs the computer or a friend on one device",
} as const

// Behind sign-in, or one account's own screen: nothing for a search result.
const PRIVATE = [
  "/online",
  "/online/history",
  "/online/some-game",
  "/profile",
]

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "raw HTTP checks: one browser is enough",
)

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function canonicalIn(html: string): string | undefined {
  return html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1]
}

test.describe("indexable pages", () => {
  for (const [path, title] of Object.entries(INDEXABLE)) {
    test(`${path} is served with its own head`, async ({ request }) => {
      const response = await request.get(path)
      expect(response.status()).toBe(200)
      const html = await response.text()

      expect(html).toMatch(
        new RegExp(`<title>${escapeRegExp(title)}</title>`),
      )
      expect(canonicalIn(html)).toBe(`${CANONICAL_ORIGIN}${path}`)
      expect(html).toContain(
        `<meta property="og:url" content="${CANONICAL_ORIGIN}${path}"/>`,
      )
      expect(html).not.toMatch(/<meta name="robots" content="noindex"/)
    })
  }
})

test.describe("private pages", () => {
  for (const path of PRIVATE) {
    test(`${path} is served with noindex`, async ({ request }) => {
      const html = await (await request.get(path)).text()

      expect(html).toMatch(/<meta name="robots" content="noindex"\/>/)
    })
  }
})

test("robots.txt is a real file that points at the sitemap", async ({
  request,
}) => {
  const response = await request.get("/robots.txt")

  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toMatch(/^text\/plain/)
  const body = await response.text()
  expect(body).toMatch(/^User-agent: \*$/m)
  expect(body).toContain(`Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml`)
  // noindex does the hiding; a Disallow would stop Google from ever seeing it
  expect(body).not.toMatch(/^Disallow:/m)
})

test("sitemap.xml lists every indexable page on the canonical host", async ({
  request,
}) => {
  const response = await request.get("/sitemap.xml")

  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toMatch(
    /^(application|text)\/xml/,
  )
  const xml = await response.text()
  expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/)
  expect(xml).toContain(
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
  )

  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  expect(locs.sort()).toEqual(
    Object.keys(INDEXABLE)
      .map((path) => `${CANONICAL_ORIGIN}${path}`)
      .sort(),
  )

  const lastmods = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)]
  expect(lastmods).toHaveLength(locs.length)
  for (const [, date] of lastmods) {
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  }

  // every entry answers, and names itself as canonical
  for (const loc of locs) {
    const path = new URL(loc).pathname
    const page = await request.get(path)
    expect(page.status(), path).toBe(200)
    expect(canonicalIn(await page.text()), path).toBe(loc)
  }
})
