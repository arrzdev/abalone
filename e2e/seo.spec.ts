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
  "/strategy": "Abalone strategy: 7 tips to win more games",
  "/opening-moves": "Abalone opening moves: a guide for beginners",
  "/play-online":
    "Play Abalone Online Free with Friends | Private Invite Link",
} as const

// What sitemap.xml lists, and the day each page's text last changed. /offline
// stays indexable but is left out: it is the board itself, and home is the
// page that answers "play abalone".
const SITEMAP = {
  "/": "2026-10-12",
  "/rules": "2026-10-18",
  "/strategy": "2026-10-18",
  "/opening-moves": "2026-10-17",
  "/play-online": "2026-10-18",
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

  // The H1 each indexable page is served with, word for word from page-copy:
  // exactly one per page, so the page states one topic.
  const H1 = {
    "/": "Play Abalone online, free",
    "/rules": "Abalone rules: how to play",
    "/offline": "Play Abalone vs the computer or a friend",
    "/strategy": "Abalone strategy: 7 tips to win",
    "/opening-moves": "Abalone opening moves for beginners",
    "/play-online": "Play Abalone online, free",
  } as const

  for (const [path, h1] of Object.entries(H1)) {
    test(`${path} is served with its page-copy H1`, async ({
      request,
    }) => {
      const html = await (await request.get(path)).text()
      const headings = [
        ...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g),
      ].map((match) => match[1].replace(/<[^>]+>/g, "").trim())

      expect(headings).toEqual([h1])
    })
  }
})

// The board page answers "abalone vs computer" in text a crawler gets without
// running anything (the `offline-copy` document on TUD-1690): the answer first,
// then the sections, under the options in the setup panel.
test("/offline is served with its vs-computer copy", async ({
  request,
}) => {
  const html = await (await request.get("/offline")).text()
  const headings = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map(
    (match) => match[1].replace(/<[^>]+>/g, "").trim(),
  )

  expect(html).toContain(
    "Play Abalone against the computer or with a friend on the same device, free in your browser.",
  )
  expect(headings).toEqual(
    expect.arrayContaining([
      "How strong is the computer?",
      "How to beat the Abalone computer",
      "Two players on one device (Pass &amp; Play)",
      "Frequently asked",
    ]),
  )
  expect(html).toMatch(/<a[^>]*href="\/strategy"[^>]*>strategy tips<\/a>/)
  expect(html).toMatch(
    /<a[^>]*href="\/opening-moves"[^>]*>opening moves<\/a>/,
  )
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

test("llms.txt is plain text that links every indexable page", async ({
  request,
}) => {
  const response = await request.get("/llms.txt")

  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toMatch(/^text\/plain/)
  const body = await response.text()
  expect(body).toMatch(/^# Abalone$/m)
  expect(body).toContain(`> ${INDEXABLE["/"]}`)

  const links = [...body.matchAll(/^- \[[^\]]+\]\(([^)]+)\)/gm)].map(
    (m) => m[1],
  )
  expect(links.sort()).toEqual(
    Object.keys(INDEXABLE)
      .map((path) => `${CANONICAL_ORIGIN}${path}`)
      .sort(),
  )
})

test("sitemap.xml lists the search entry pages on the canonical host", async ({
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

  const entries = [
    ...xml.matchAll(
      /<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>\s*<\/url>/g,
    ),
  ].map((match) => [match[1], match[2]])
  // each page carries the day it last changed, not the day of the build
  expect(Object.fromEntries(entries)).toEqual(
    Object.fromEntries(
      Object.entries(SITEMAP).map(([path, date]) => [
        `${CANONICAL_ORIGIN}${path}`,
        date,
      ]),
    ),
  )
  const locs = entries.map(([loc]) => loc)
  expect(xml.match(/<url>/g)).toHaveLength(locs.length)

  // every entry answers, and names itself as canonical
  for (const loc of locs) {
    const path = new URL(loc).pathname
    const page = await request.get(path)
    expect(page.status(), path).toBe(200)
    expect(canonicalIn(await page.text()), path).toBe(loc)
  }
})
