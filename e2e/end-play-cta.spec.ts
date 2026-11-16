import type { Locator, Page } from "@playwright/test"
import { openApp } from "./support/app"
import { expect, test } from "./support/test"

// The end of every guide is one block that asks the reader to play: the eight
// bots, a headline about what the page just taught, the computer game, a line
// that says it is free, and the other ways to play (the `design` document on
// TUD-5812, §2 and §3). It replaces the last chapter's bare play block, keeps
// that chapter's anchor, and sits before "Related guides".
//
// The hero's play block is play-block.spec.ts. This file is the end block only.

const COMPUTER_GAME = "/offline?mode=ai"
const CTA = "Play against the computer"
const MORE = "Other ways to play"
const CAPTION = "Eight bots, Gus to Magnus"
const TRUST = "Free, no sign-up, no download."

const LOCALES = [
  "de",
  "en",
  "es",
  "fr",
  "hi",
  "it",
  "ja",
  "ko",
  "nl",
  "pl",
  "pt",
  "tr",
  "zh",
] as const

/** Each page's headline, and the anchor its last chapter had (design §3.3). */
const PAGES = {
  "/rules": {
    id: "play",
    headline: "Try the rules in a real game",
    rail: false,
  },
  "/how-to-play": {
    id: "play",
    headline: "Play your first game",
    rail: true,
  },
  "/strategy": {
    id: "practise",
    headline: "Try these tips in a real game",
    rail: true,
  },
  "/opening-moves": {
    id: "practise",
    headline: "Try these openings in a real game",
    rail: true,
  },
  "/starting-positions": {
    id: "try-them",
    headline: "Try these layouts in a real game",
    rail: true,
  },
} as const

type Path = keyof typeof PAGES
const PATHS = Object.keys(PAGES) as Path[]

function endBlock(page: Page): Locator {
  return page.locator("main [data-end-cta]")
}

function endButton(page: Page): Locator {
  return endBlock(page).getByRole("link", { name: CTA, exact: true })
}

function endMore(page: Page): Locator {
  return endBlock(page).getByRole("link", { name: MORE, exact: true })
}

/** The page in a language: English has no prefix, the others do. */
function localePath(locale: string, path: string): string {
  return locale === "en" ? path : `/${locale}${path}`
}

// §3.1 and §3.3 in the served HTML: there before any script runs, so a crawler
// and a reader on a slow phone get it too.
test.describe("served HTML", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "raw HTTP checks: one browser is enough",
  )

  for (const locale of LOCALES) {
    for (const path of PATHS) {
      test(`${locale} ${path}: one end block, after the chapters, before the related guides`, async ({
        request,
      }) => {
        const response = await request.get(localePath(locale, path))
        expect(response.status()).toBe(200)
        const served = await response.text()
        const html = served.slice(
          served.indexOf("<main"),
          served.indexOf("</main>"),
        )

        const blocks = [...html.matchAll(/data-end-cta(?=[\s>="])/g)]
        expect(blocks).toHaveLength(1)
        const block = blocks[0].index ?? -1

        // after every chapter
        const lastChapter = html.lastIndexOf("data-chapter")
        expect(block).toBeGreaterThan(lastChapter)
        // before the related guides
        const related = html.indexOf("data-related-guides")
        expect(related).toBeGreaterThan(-1)
        expect(block).toBeLessThan(related)

        // one h1 on the page, still
        expect(served.match(/<h1[\s>]/g) ?? []).toHaveLength(1)

        // the anchor the last chapter had lands on the block
        const anchor = html.indexOf(`id="${PAGES[path].id}"`)
        expect(anchor).toBeGreaterThan(block)
        expect(anchor).toBeLessThan(related)
      })
    }
  }
})

test.describe("in the browser", () => {
  for (const path of PATHS) {
    test(`${path}: faces, caption, headline, button, trust line, other ways, in that order`, async ({
      page,
    }) => {
      await openApp(page, path)
      const block = endBlock(page)
      await expect(block).toHaveCount(1)

      // §3.2: eight faces, decorative, lazy
      const faces = block.locator("img")
      await expect(faces).toHaveCount(8)
      for (const face of await faces.all()) {
        await expect(face).toHaveAttribute("alt", "")
        await expect(face).toHaveAttribute("loading", "lazy")
      }

      const heading = block.getByRole("heading", { level: 2 })
      await expect(heading).toHaveCount(1)
      await expect(heading).toHaveText(PAGES[path].headline)
      await expect(endButton(page)).toHaveAttribute("href", COMPUTER_GAME)
      await expect(endMore(page)).toHaveAttribute("href", "/")

      // reading order: every face, then the words, then the links
      const order = await block.evaluate(
        (section, labels) => {
          const text = section.textContent ?? ""
          const lastFace = [...section.querySelectorAll("img")].at(-1)
          const caption = [...section.querySelectorAll("*")].find(
            (element) =>
              element.children.length === 0 &&
              (element.textContent ?? "").trim() === labels.caption,
          )
          return {
            facesBeforeCaption:
              lastFace !== undefined &&
              caption !== undefined &&
              Boolean(
                lastFace.compareDocumentPosition(caption) &
                  Node.DOCUMENT_POSITION_FOLLOWING,
              ),
            offsets: [
              labels.caption,
              labels.headline,
              labels.cta,
              labels.trust,
              labels.more,
            ].map((label) => text.indexOf(label)),
          }
        },
        {
          caption: CAPTION,
          headline: PAGES[path].headline,
          cta: CTA,
          trust: TRUST,
          more: MORE,
        },
      )
      expect(order.facesBeforeCaption).toBe(true)
      for (const offset of order.offsets)
        expect(offset).toBeGreaterThan(-1)
      expect(order.offsets).toEqual(
        [...order.offsets].sort((a, b) => a - b),
      )

      // §3.3: named by its own headline, and the old anchor is inside it
      const headingId = await heading.getAttribute("id")
      expect(headingId).toBeTruthy()
      await expect(block).toHaveAttribute(
        "aria-labelledby",
        headingId ?? "",
      )
      expect(
        await page.evaluate(
          (id) =>
            document.getElementById(id)?.closest("[data-end-cta]") !==
              null && document.getElementById(id) !== null,
          PAGES[path].id,
        ),
      ).toBe(true)
    })
  }

  // §3.3: the rail and the contents list still lead to it; /rules has no entry
  test.describe("the chapter list", () => {
    test.use({ viewport: { width: 1440, height: 900 } })

    for (const path of PATHS) {
      test(`${path}: ${PAGES[path].rail ? "its entry lands on the block" : "has no entry for the block"}`, async ({
        page,
      }) => {
        await openApp(page, path)
        const entry = page.locator(
          `[data-manual-rail] [data-rail-link="${PAGES[path].id}"]`,
        )
        if (!PAGES[path].rail) {
          await expect(entry).toHaveCount(0)
          return
        }
        await entry.click()
        await expect(page).toHaveURL(new RegExp(`#${PAGES[path].id}$`))
        await expect(
          endBlock(page).getByRole("heading", { level: 2 }),
        ).toBeInViewport()
      })
    }
  })
})

test.describe("layout", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "geometry at set widths: one engine is enough",
  )

  // §3.4: a band from edge to edge, the button one line across it
  for (const viewport of [
    { width: 320, height: 664 },
    { width: 390, height: 664 },
  ]) {
    test.describe(`phone at ${viewport.width}`, () => {
      test.use({ viewport })

      for (const path of PATHS) {
        test(`${path}: a full-width band, the button one line`, async ({
          page,
        }) => {
          await openApp(page, path)
          const panel = endBlock(page).locator("[data-end-cta-panel]")
          await panel.scrollIntoViewIfNeeded()

          const band = await panel.boundingBox()
          expect(band).not.toBeNull()
          expect(Math.abs(band?.x ?? -1)).toBeLessThanOrEqual(0.5)
          expect(
            Math.abs((band?.x ?? 0) + (band?.width ?? 0) - viewport.width),
          ).toBeLessThanOrEqual(0.5)

          const button = await endButton(page).boundingBox()
          expect(button).not.toBeNull()
          // one line: the 54 px minimum, a second line makes it ~75 px
          expect(Math.round(button?.height ?? 0)).toBe(54)
          expect(
            Math.abs((button?.width ?? 0) - (viewport.width - 40)),
          ).toBeLessThanOrEqual(1)

          // §3.6
          const more = await endMore(page).boundingBox()
          expect(more?.height ?? 0).toBeGreaterThanOrEqual(44)

          expect(
            await page.evaluate(
              () =>
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth,
            ),
          ).toBe(true)
        })
      }
    })
  }

  // §3.5: a card, the button and the link on one row, the trust line under
  for (const viewport of [
    { width: 640, height: 900 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    test.describe(`card at ${viewport.width}`, () => {
      test.use({ viewport })

      for (const path of PATHS) {
        test(`${path}: a rounded card, one row of actions, the trust line under`, async ({
          page,
        }) => {
          await openApp(page, path)
          const panel = endBlock(page).locator("[data-end-cta-panel]")
          await panel.scrollIntoViewIfNeeded()

          const card = await panel.evaluate((element) => {
            const style = getComputedStyle(element)
            const probe = document.createElement("span")
            probe.style.cssText =
              "position:absolute;visibility:hidden;width:62ch"
            element.appendChild(probe)
            const measure = probe.getBoundingClientRect().width
            probe.remove()
            return {
              radius: style.borderTopLeftRadius,
              border: style.borderTopWidth,
              width: element.getBoundingClientRect().width,
              measure,
            }
          })
          expect(card.radius).toBe("16px")
          expect(card.border).toBe("1px")
          expect(card.width).toBeLessThanOrEqual(card.measure + 1)

          const button = await endButton(page).boundingBox()
          const more = await endMore(page).boundingBox()
          const trust = await endBlock(page)
            .getByText(TRUST, { exact: true })
            .boundingBox()
          expect(button && more && trust).toBeTruthy()
          if (!button || !more || !trust) return

          expect(button.height).toBeGreaterThanOrEqual(54)
          expect(more.height).toBeGreaterThanOrEqual(44)
          // one row
          expect(more.x).toBeGreaterThan(button.x + button.width)
          const middle = button.y + button.height / 2
          expect(more.y).toBeLessThan(middle)
          expect(more.y + more.height).toBeGreaterThan(middle)
          // the trust line under the row, from its left edge
          expect(trust.y).toBeGreaterThanOrEqual(
            button.y + button.height - 1,
          )
          expect(Math.abs(trust.x - button.x)).toBeLessThanOrEqual(1)
        })
      }
    })
  }

  // §3.7: 200% text at 390, nothing clipped, nothing on top of something else
  test.describe("200% text at 390", () => {
    test.use({ viewport: { width: 390, height: 844 } })

    for (const path of PATHS) {
      test(`${path}: nothing clipped or overlapping`, async ({ page }) => {
        await openApp(page, path)
        await page.evaluate(() => {
          document.documentElement.style.fontSize = "200%"
        })
        const block = endBlock(page)
        await block.scrollIntoViewIfNeeded()

        const problems = await block.evaluate((section) => {
          const found: string[] = []
          const leaves = [
            ...section.querySelectorAll("h2, a, p, span, img"),
          ].filter(
            (element) =>
              !element.querySelector("h2, a, p, span, img") &&
              (element.getBoundingClientRect().width > 0 ||
                element.tagName === "IMG"),
          )
          for (const element of leaves) {
            if (
              element.tagName !== "IMG" &&
              element.scrollWidth > element.clientWidth + 1
            )
              found.push(`clipped: ${element.textContent?.trim()}`)
            if (
              element.scrollHeight > element.clientHeight + 1 &&
              element.clientHeight > 0
            )
              found.push(`clipped: ${element.textContent?.trim()}`)
          }
          // text blocks never overlap each other (the faces overlap by design)
          const texts = leaves
            .filter((element) => element.tagName !== "IMG")
            .map((element) => ({
              label: element.textContent?.trim() ?? "",
              box: element.getBoundingClientRect(),
            }))
          for (const [index, a] of texts.entries()) {
            for (const b of texts.slice(index + 1)) {
              const overlaps =
                a.box.left < b.box.right - 1 &&
                b.box.left < a.box.right - 1 &&
                a.box.top < b.box.bottom - 1 &&
                b.box.top < a.box.bottom - 1
              if (overlaps) found.push(`overlap: ${a.label} / ${b.label}`)
            }
          }
          return found
        })
        expect(problems).toEqual([])
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        ).toBe(true)
      })
    }
  })
})

// §3.6: a keyboard user sees where they are on both links
test.describe("focus", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("the button and the link show a focus ring from the keyboard", async ({
    page,
  }) => {
    await openApp(page, "/strategy")
    await endMore(page).focus()
    await page.keyboard.press("Shift+Tab")
    await expect(endButton(page)).toBeFocused()

    const ring = (locator: Locator) =>
      locator.evaluate((element) => {
        const style = getComputedStyle(element)
        return (
          (style.outlineStyle !== "none" &&
            Number.parseFloat(style.outlineWidth) > 0) ||
          style.boxShadow !== "none"
        )
      })
    expect(await ring(endButton(page))).toBe(true)
    await page.keyboard.press("Tab")
    await expect(endMore(page)).toBeFocused()
    expect(await ring(endMore(page))).toBe(true)
  })
})

// §3.8: the block reads in the reader's language
test.describe("in French", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "copy check: one browser is enough",
  )

  test("/fr/strategy: no English in the block", async ({ page }) => {
    await openApp(page, "/fr/strategy")
    const text = (await endBlock(page).textContent()) ?? ""
    for (const english of [
      CAPTION,
      PAGES["/strategy"].headline,
      CTA,
      TRUST,
      MORE,
    ]) {
      expect(text).not.toContain(english)
    }
  })
})

// §3.9: the end button starts a computer game and it is counted as before
test.describe("starting a game", () => {
  // No service worker: on webkit one test's worker can claim another test's
  // page and reload it mid-game (game-entry.spec.ts).
  test.use({ serviceWorkers: "block" })

  test("the end button on /strategy opens a computer game and sends one start", async ({
    page,
  }) => {
    const starts: Array<Record<string, unknown>> = []
    page.on("request", (request) => {
      if (request.method() !== "POST") return
      if (!request.url().endsWith("/api/v1/events/game")) return
      const event = JSON.parse(request.postData() ?? "{}")
      if (event.kind === "start") starts.push(event)
    })

    await openApp(page, "/strategy")
    await endButton(page).scrollIntoViewIfNeeded()
    await endButton(page).click()

    await expect(page).toHaveURL(
      (url) => `${url.pathname}${url.search}` === COMPUTER_GAME,
    )
    await expect(
      page
        .getByRole("button", { name: "Resign" })
        .or(
          page.getByRole("tab", { name: "vs Computer", selected: true }),
        ),
    ).toBeVisible()
    // a fresh browser lands on the board and the game starts by itself; the
    // setup screen needs its own Start
    const setup = page.getByRole("button", { name: /^Start/ })
    if (await setup.isVisible()) await setup.click()

    await expect.poll(() => starts.length).toBe(1)
    expect(starts[0]).toMatchObject({ mode: "ai", entry: "strategy" })
  })
})
