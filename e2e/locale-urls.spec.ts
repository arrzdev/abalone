import { readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"

// Every language has URLs of its own (docs/locale-urls.md): English keeps the
// paths it always had, the others live under their code (/pt/rules, /pt). An
// unprefixed visit goes to the saved language, else the browser's; a prefixed
// URL is served as it is. The raw HTTP checks read what a crawler reads, so
// they run once, under chromium, like seo.spec.ts.

const ORIGIN = "https://abalone.tudu.dev"

const LANGUAGES = [
  "en",
  "de",
  "fr",
  "es",
  "it",
  "pt",
  "nl",
  "pl",
  "ja",
  "zh",
  "ko",
  "hi",
  "tr",
]

const ENGLISH_RULES_TITLE =
  "Abalone rules: how to play, moves, sumito and winning"

/** A locale file, as the app bundles it. */
function locale(language: string, namespace: string) {
  const path = `apps/game/src/i18n/locales/${language}/${namespace}.json`
  return JSON.parse(readFileSync(path, "utf8"))
}

function decode(text: string): string {
  return text
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
}

function titleIn(html: string): string | undefined {
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1]
  return title === undefined ? undefined : decode(title)
}

function linksIn(html: string): Array<Record<string, string>> {
  return [...html.matchAll(/<link\b[^>]*>/g)].map((match) =>
    Object.fromEntries(
      [...match[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map((attribute) => [
        attribute[1].toLowerCase(),
        attribute[2],
      ]),
    ),
  )
}

function canonicalIn(html: string): string | undefined {
  return linksIn(html).find((link) => link.rel === "canonical")?.href
}

function alternatesIn(html: string): Record<string, string> {
  return Object.fromEntries(
    linksIn(html)
      .filter((link) => link.rel === "alternate" && link.hreflang)
      .map((link) => [link.hreflang, link.href]),
  )
}

function h1sIn(html: string): string[] {
  return [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((match) =>
    decode(match[1].replace(/<[^>]+>/g, "").trim()),
  )
}

test.describe("what a crawler reads", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "raw HTTP checks: one browser is enough",
  )

  test("/pt/rules is served in Portuguese, on its own URL", async ({
    request,
  }) => {
    const response = await request.get("/pt/rules")
    expect(response.status()).toBe(200)
    const html = await response.text()

    expect(html).toMatch(/<html[^>]*\blang="pt"/)
    const title = titleIn(html)
    expect(title).toContain("Abalone")
    expect(title).not.toBe(ENGLISH_RULES_TITLE)
    expect(h1sIn(html)).toEqual([locale("pt", "game").rules.heading])
    expect(canonicalIn(html)).toBe(`${ORIGIN}/pt/rules`)
    expect(html).toContain(
      `<meta property="og:url" content="${ORIGIN}/pt/rules"/>`,
    )
    expect(html).not.toMatch(/<meta name="robots" content="noindex"/)
  })

  test("every language version names the others and x-default", async ({
    request,
  }) => {
    const expected = Object.fromEntries([
      ...LANGUAGES.map((language) => [
        language,
        language === "en"
          ? `${ORIGIN}/rules`
          : `${ORIGIN}/${language}/rules`,
      ]),
      ["x-default", `${ORIGIN}/rules`],
    ])

    for (const path of ["/rules", "/pt/rules", "/ja/rules"]) {
      const html = await (await request.get(path)).text()
      expect(alternatesIn(html), path).toEqual(expected)
    }
  })

  test("a language's home is its bare prefix", async ({ request }) => {
    const response = await request.get("/pt")
    expect(response.status()).toBe(200)
    const html = await response.text()

    expect(html).toMatch(/<html[^>]*\blang="pt"/)
    expect(canonicalIn(html)).toBe(`${ORIGIN}/pt`)
    expect(alternatesIn(html)["x-default"]).toBe(`${ORIGIN}/`)
  })

  test("an untranslated page points at the English one", async ({
    request,
  }) => {
    const response = await request.get("/pt/opening-moves")
    expect(response.status()).toBe(200)
    const html = await response.text()

    expect(canonicalIn(html)).toBe(`${ORIGIN}/opening-moves`)
    expect(alternatesIn(html)).toEqual({
      en: `${ORIGIN}/opening-moves`,
      "x-default": `${ORIGIN}/opening-moves`,
    })
  })

  test("the sitemap lists every language version", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text()

    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
    expect(xml).toContain(`<loc>${ORIGIN}/pt/rules</loc>`)
    expect(xml).toContain(`<loc>${ORIGIN}/rules</loc>`)
    expect(xml).toMatch(
      /<xhtml:link rel="alternate" hreflang="x-default" href="https:\/\/abalone\.tudu\.dev\/rules"\s*\/>/,
    )
    expect(xml).not.toContain(`<loc>${ORIGIN}/pt/opening-moves</loc>`)
  })
})

test.describe("where an unprefixed visit goes", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "raw HTTP checks: one browser is enough",
  )

  async function visit(
    request: import("@playwright/test").APIRequestContext,
    path: string,
    headers: Record<string, string>,
  ) {
    const response = await request.get(path, { headers, maxRedirects: 0 })
    return { status: response.status(), headers: response.headers() }
  }

  test("to the browser's language", async ({ request }) => {
    const response = await visit(request, "/rules", {
      "accept-language": "pt-PT,pt;q=0.9,en;q=0.8",
    })

    expect(response.status).toBe(302)
    expect(response.headers.location).toBe("/pt/rules")
    expect(response.headers.vary?.toLowerCase()).toContain(
      "accept-language",
    )
  })

  test("nowhere for a crawler or an English browser", async ({
    request,
  }) => {
    expect((await visit(request, "/rules", {})).status).toBe(200)
    expect(
      (await visit(request, "/rules", { "accept-language": "en-US,en" }))
        .status,
    ).toBe(200)
  })

  test("to the language saved in Settings, over the browser's", async ({
    request,
  }) => {
    const saved = await visit(request, "/strategy", {
      cookie: "abalone_language=es",
      "accept-language": "pt-PT",
    })
    expect(saved.status).toBe(302)
    expect(saved.headers.location).toBe("/es/strategy")

    const english = await visit(request, "/strategy", {
      cookie: "abalone_language=en",
      "accept-language": "pt-PT",
    })
    expect(english.status).toBe(200)
  })

  test("a prefixed URL stays where it is", async ({ request }) => {
    const response = await visit(request, "/pt/rules", {
      cookie: "abalone_language=es",
      "accept-language": "de",
    })
    expect(response.status).toBe(200)
  })

  test("/en moves for good to the unprefixed path", async ({
    request,
  }) => {
    const response = await visit(request, "/en/rules", {})
    expect(response.status).toBe(301)
    expect(response.headers.location).toBe("/rules")
  })
})

test.describe("a browser set to Portuguese", () => {
  test.use({ locale: "pt-PT" })

  test("lands on /pt and stays inside it", async ({ page }) => {
    await openApp(page, "/")
    await expect(page).toHaveURL(/\/pt$/)
    await expect(page.locator("html")).toHaveAttribute("lang", "pt")

    await page
      .getByRole("link", { name: locale("pt", "common").nav.rules })
      .filter({ visible: true })
      .first()
      .click()
    await expect(page).toHaveURL(/\/pt\/rules$/)
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: locale("pt", "game").rules.heading,
      }),
    ).toBeVisible()
  })

  test("stays in English once English was saved", async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      { name: "abalone_language", value: "en", url: baseURL ?? "" },
    ])

    await openApp(page, "/rules")
    await expect(page).toHaveURL(/\/rules$/)
    await expect(page.locator("html")).toHaveAttribute("lang", "en")
  })
})

test("picking a language in Settings moves to its URL and is kept", async ({
  page,
  context,
}) => {
  // /offline wears the settings button at every width
  await openApp(page, "/offline")

  await page
    .getByRole("button", { name: "Settings" })
    .filter({ visible: true })
    .first()
    .click()
  await page.getByRole("button", { name: "Select Language" }).click()
  await page.getByRole("option", { name: "Português" }).click()

  await expect(page).toHaveURL(/\/pt\/offline$/)
  await expect(page.locator("html")).toHaveAttribute("lang", "pt")
  const cookies = await context.cookies()
  expect(
    cookies.find((cookie) => cookie.name === "abalone_language")?.value,
  ).toBe("pt")

  // the saved choice now sends an unprefixed link to Portuguese too
  await page.goto("/strategy")
  await expect(page).toHaveURL(/\/pt\/strategy$/)
})
