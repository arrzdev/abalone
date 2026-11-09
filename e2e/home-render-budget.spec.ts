import { expect, test } from "@playwright/test"

// What the home page makes the browser fetch and parse before its first paint.
// Inlining the stylesheet into `/` took the Speed Index from about 2.9 s to
// 1.78 s, so this fails when that part of the page grows: a linked stylesheet
// is back, the inline CSS gets bigger, or more script is preloaded. No
// Lighthouse, whose timings are too noisy on hosted runners: the bytes the
// served HTML asks for, read with plain requests. Browser-independent, so it
// runs once, under chromium.
//
// Each budget is the value measured on main (2a6227a, 2026-11-08) plus 10%.
// Measured on the e2e build this suite serves; the production build preloads
// the same modules and about 700 fewer bytes (the board probe). Sizes are the
// uncompressed bytes. A deliberate increase raises the budget in the same PR,
// with the new measurement next to it.

// Measured 85,426 bytes.
const INLINE_CSS_BUDGET_BYTES = 93_968
// The script budgets were raised when every static import of a preloaded
// chunk became preloaded too (hoist-chunk-imports.plugin.ts): those modules
// were already fetched before hydration, a round trip later. Speed Index of /
// went from about 2.97 s to 2.63 s on a local Lighthouse run (2026-11-08).
// Measured 45 (was 34).
const MODULEPRELOAD_COUNT_BUDGET = 49
// Measured 826,274 bytes in CI, with no margin: hydration waits for every byte
// of this, so a page that grows says so here (902,813 before zod's schema
// classes left the browser bundle, 826,274 before the realtime socket library
// moved to the first signed-in connect). CI is the measure: its build bakes in
// the commit's short sha where a local one writes "dev", 62 bytes more here.
const MODULEPRELOAD_JS_BUDGET_BYTES = 818_327

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "raw HTTP checks: one browser is enough",
)

function byteLength(text: string): number {
  return Buffer.byteLength(text, "utf8")
}

function modulepreloadHrefs(html: string): string[] {
  return [...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*>/g)].map(
    (match) => {
      const href = match[0].match(/href="([^"]+)"/)?.[1]
      if (!href) throw new Error(`modulepreload without href: ${match[0]}`)
      return href
    },
  )
}

test.describe("render-critical bytes of /", () => {
  let html = ""

  test.beforeEach(async ({ request }) => {
    const response = await request.get("/")
    expect(response.status()).toBe(200)
    html = await response.text()
  })

  test("links no stylesheet", () => {
    const stylesheetLinks = [
      ...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g),
    ].map((match) => match[0])
    expect(stylesheetLinks).toEqual([])
  })

  test("inlines its CSS within budget", () => {
    const inlineStyles = [
      ...html.matchAll(
        /<style[^>]*data-tsr-inline-css[^>]*>([\s\S]*?)<\/style>/g,
      ),
    ].map((match) => match[1])
    // Zero would mean the inlining is off, which "links no stylesheet" may
    // not catch if the CSS moved somewhere else entirely.
    expect(inlineStyles.length).toBeGreaterThan(0)

    const inlineCssBytes = inlineStyles.reduce(
      (total, css) => total + byteLength(css),
      0,
    )
    expect(inlineCssBytes).toBeLessThanOrEqual(INLINE_CSS_BUDGET_BYTES)
  })

  test("preloads its script within budget", async ({ request }) => {
    const hrefs = modulepreloadHrefs(html)
    expect(hrefs.length).toBeLessThanOrEqual(MODULEPRELOAD_COUNT_BUDGET)

    const sizes = await Promise.all(
      hrefs.map(async (href) => {
        const response = await request.get(href)
        expect(response.status(), href).toBe(200)
        return (await response.body()).byteLength
      }),
    )
    const preloadedBytes = sizes.reduce((total, size) => total + size, 0)
    expect(preloadedBytes).toBeLessThanOrEqual(
      MODULEPRELOAD_JS_BUDGET_BYTES,
    )
  })
})
