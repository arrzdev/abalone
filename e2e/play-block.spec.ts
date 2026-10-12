import type { Browser, Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"

// A reader of /rules or /strategy who decides to play has a way to the board
// under the intro, halfway down and at the end, and no "play" link on the page
// sends them back to home (the `content-play-block` document on TUD-820, §8).
//
// "The computer game" is wherever home's vs Computer card goes. The served-HTML
// checks name that URL; the browser check reads it off the card, so the two
// cannot drift apart without a test saying so.

const COMPUTER_GAME = "/offline?mode=ai"
const CTA = "Play against the computer"
const MORE = "Other ways to play"

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

/** Where each page's three blocks sit, as the section ids around them. */
const PAGES = {
  "/rules": {
    // (b) after "Pushing marbles off the board", before "How to win"
    middle: ["pushing-off", "how-to-win"],
    // (c) after the FAQ, last on the page
    end: "faq",
    // the intro's own links, in reading order
    intro: ["play Abalone online", "try it against the computer"],
  },
  "/strategy": {
    // (b) after "3. Stay away from the edge", before "4. Count before you push"
    middle: ["edge", "count"],
    // (c) inside "Practise"
    end: "practise",
    intro: ["free game against the computer", "Abalone rules"],
  },
} as const

type Path = keyof typeof PAGES
const PATHS = Object.keys(PAGES) as Path[]

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Every `<a href>` to `path` whose visible text is `text`, as match offsets. */
function linkOffsets(html: string, path: string, text: string): number[] {
  const pattern = new RegExp(
    `<a[^>]*href="${escapeRegExp(path)}"[^>]*>(?:\\s|<[^>]+>)*${escapeRegExp(text)}(?:\\s|<[^>]+>)*</a>`,
    "g",
  )
  return [...html.matchAll(pattern)].map((match) => match.index ?? -1)
}

/** The offset of a section heading in the served HTML. */
function headingOffset(html: string, id: string): number {
  const offset = html.indexOf(`id="${id}"`)
  expect(offset, `#${id} is on the page`).toBeGreaterThan(-1)
  return offset
}

test.describe("served HTML", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "raw HTTP checks: one browser is enough",
  )

  for (const path of PATHS) {
    test.describe(path, () => {
      let html = ""
      test.beforeEach(async ({ request }) => {
        const response = await request.get(path)
        expect(response.status()).toBe(200)
        // page content only: the desktop header's nav is in the markup too
        const served = await response.text()
        html = served.slice(
          served.indexOf("<main"),
          served.indexOf("</main>"),
        )
        expect(html.length).toBeGreaterThan(0)
      })

      // §8.1 + §8.2: three primaries, at the intro, mid-page and the end
      test("has three ways to the computer game: under the intro, mid-page and at the end", () => {
        const primaries = linkOffsets(html, COMPUTER_GAME, CTA)
        expect(primaries).toHaveLength(3)

        const [first, middle, end] = primaries
        const page = PAGES[path]
        const firstSection = html.indexOf("<h2")

        // (a) after the intro, before the first section
        expect(first).toBeGreaterThan(html.indexOf("</h1>"))
        expect(first).toBeLessThan(firstSection)

        // (b) between the two sections it follows and precedes
        expect(middle).toBeGreaterThan(headingOffset(html, page.middle[0]))
        expect(middle).toBeLessThan(headingOffset(html, page.middle[1]))

        // (c) after the last section it belongs to
        expect(end).toBeGreaterThan(headingOffset(html, page.end))
      })

      // §8.3: one way to the other modes beside each primary, and only those
      test("pairs each one with a link to the other ways to play", () => {
        const primaries = linkOffsets(html, COMPUTER_GAME, CTA)
        const others = linkOffsets(html, "/", MORE)
        expect(others).toHaveLength(3)

        // each secondary is the next link after its primary
        for (const [index, primary] of primaries.entries()) {
          const nextLink = html.indexOf("<a", primary + 2)
          expect(nextLink).toBe(others[index])
        }
      })

      // §8.4: the intro's links say "play" or "game" and open one
      test("points the intro's play links at the computer game", () => {
        for (const text of PAGES[path].intro) {
          if (text === "Abalone rules") continue
          expect(linkOffsets(html, COMPUTER_GAME, text)).toHaveLength(1)
        }
      })

      test("no longer has the links that went home or to setup", () => {
        expect(html).not.toContain("Play now")
        expect(html).not.toContain("Play a friend online")
        expect(html).not.toContain("Play Abalone against the computer")
        expect(html).not.toMatch(/<a[^>]*href="\/offline"[^>]*>/)
      })
    })
  }
})

/** The links in page content: `main` without its header and nav. */
function contentLinks(page: Page): Promise<
  Array<{
    text: string
    href: string
  }>
> {
  return page.locator("main").evaluate((main) =>
    [...main.querySelectorAll("a")]
      .filter((link) => link.closest("header, nav") === null)
      .map((link) => ({
        text: (link.textContent ?? "").trim(),
        href: link.getAttribute("href") ?? "",
      })),
  )
}

function primaries(page: Page): Locator {
  return page.locator("main").getByRole("link", { name: CTA, exact: true })
}

function secondaries(page: Page): Locator {
  return page
    .locator("main")
    .getByRole("link", { name: MORE, exact: true })
}

// §8.2: the button and home's vs Computer card go to the same place, and that
// place is the computer game.
test.describe("in a fresh browser", () => {
  for (const path of PATHS) {
    test(`${path}: the first button opens the same game as home's vs Computer card`, async ({
      page,
    }) => {
      await openApp(page, "/")
      await page
        .getByRole("button", { name: /vs Computer/ })
        .filter({ visible: true })
        .first()
        .click()
      await expect(page).toHaveURL(/\/offline/)
      const cardTarget = new URL(page.url())
      const destination = `${cardTarget.pathname}${cardTarget.search}`
      expect(destination).toBe(COMPUTER_GAME)

      await openApp(page, path)
      const first = primaries(page).first()
      await expect(first).toHaveAttribute("href", destination)
      await first.click()

      await expect(page).toHaveURL(
        (url) => `${url.pathname}${url.search}` === destination,
      )
      // where the computer game lands is TUD-818's: the board on a first game
      // (first-game-board.spec.ts), the setup screen after it
      await expect(
        page
          .getByRole("button", { name: "Resign" })
          .or(
            page.getByRole("tab", { name: "vs Computer", selected: true }),
          ),
      ).toBeVisible()
    })
  }
})

/** The content box of an element's parent, and of the element itself. */
async function boxes(locator: Locator) {
  return locator.evaluate((element) => {
    const contentBox = (node: Element) => {
      const box = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      const left = box.left + Number.parseFloat(style.paddingLeft)
      const right = box.right - Number.parseFloat(style.paddingRight)
      return { left, right, width: right - left }
    }
    const own = element.getBoundingClientRect()
    const block = element.parentElement as HTMLElement
    return {
      own: {
        left: own.left,
        right: own.right,
        top: own.top,
        bottom: own.bottom,
        width: own.width,
        height: own.height,
      },
      block: contentBox(block),
      column: contentBox(block.parentElement as HTMLElement),
    }
  })
}

const LAYOUT_VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const

test.describe("layout", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "geometry at set widths: one engine is enough, the iPhone project runs the click-through",
  )

  for (const viewport of LAYOUT_VIEWPORTS) {
    test.describe(`at ${viewport.width}×${viewport.height}`, () => {
      test.use({ viewport })

      for (const path of PATHS) {
        test(`${path}: three blocks, each a button and a link`, async ({
          page,
        }) => {
          await openApp(page, path)

          // §8.1
          await expect(primaries(page)).toHaveCount(3)
          await expect(secondaries(page)).toHaveCount(3)

          for (let index = 0; index < 3; index++) {
            const primary = primaries(page).nth(index)
            const secondary = secondaries(page).nth(index)
            await primary.scrollIntoViewIfNeeded()

            const button = await boxes(primary)
            const link = await boxes(secondary)

            // §8.6: thumb-sized, the button at its 54 px
            expect(button.own.height).toBeGreaterThanOrEqual(54)
            expect(button.own.width).toBeGreaterThanOrEqual(44)
            expect(link.own.height).toBeGreaterThanOrEqual(44)

            // the label fits the button, however many lines it takes
            expect(
              await primary.evaluate(
                (element) => element.scrollHeight <= element.clientHeight,
              ),
            ).toBe(true)

            // §8.8
            if (viewport.width < 640) {
              // the button fills the block, the block fills its column
              expect(
                Math.abs(button.own.width - button.block.width),
              ).toBeLessThanOrEqual(1)
              expect(
                Math.abs(button.block.width - button.column.width),
              ).toBeLessThanOrEqual(1)
              // and the link sits under it
              expect(link.own.top).toBeGreaterThanOrEqual(
                button.own.bottom - 1,
              )
            } else {
              // one row, starting where the text it follows starts
              expect(
                Math.abs(button.own.left - button.block.left),
              ).toBeLessThanOrEqual(1)
              expect(link.own.left).toBeGreaterThan(button.own.right)
              const buttonMiddle = (button.own.top + button.own.bottom) / 2
              expect(link.own.top).toBeLessThan(buttonMiddle)
              expect(link.own.bottom).toBeGreaterThan(buttonMiddle)
            }
          }
        })

        // §8.3 + §8.4: nothing in the content says "play" and goes elsewhere
        test(`${path}: every play link opens the computer game, one link goes home`, async ({
          page,
        }) => {
          await openApp(page, path)
          const links = await contentLinks(page)

          expect(
            links
              .filter((link) => link.href === "/")
              .map((link) => link.text),
          ).toEqual([MORE, MORE, MORE])

          const promising = links.filter(
            (link) => /play|game/i.test(link.text) && link.text !== MORE,
          )
          expect(promising.length).toBeGreaterThanOrEqual(4)
          for (const link of promising) {
            expect(link.href, link.text).toBe(COMPUTER_GAME)
          }
        })

        // §8.8: nothing wider than the screen
        test(`${path}: no horizontal overflow`, async ({ page }) => {
          await openApp(page, path)
          const overflowing = await page.evaluate(() =>
            [
              document.documentElement,
              ...document.querySelectorAll("main *"),
            ]
              .filter((element) => {
                const style = getComputedStyle(element)
                const scrolls =
                  element === document.documentElement ||
                  ["auto", "scroll"].includes(style.overflowX) ||
                  ["auto", "scroll"].includes(style.overflowY)
                return scrolls && element.scrollWidth > element.clientWidth
              })
              .map((element) => element.tagName),
          )
          expect(overflowing).toEqual([])
        })
      }
    })
  }

  // §8.7: the first button is on the first screen of the phones we support
  for (const viewport of [
    { width: 320, height: 460 },
    { width: 375, height: 548 },
    { width: 390, height: 664 },
  ]) {
    test.describe(`first screen at ${viewport.width}×${viewport.height}`, () => {
      test.use({ viewport })

      for (const path of PATHS) {
        test(`${path}: the first button is visible without scrolling`, async ({
          page,
        }) => {
          await openApp(page, path)
          const box = await primaries(page).first().boundingBox()
          expect(box).not.toBeNull()
          expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
            viewport.height,
          )
          expect(box?.y ?? -1).toBeGreaterThanOrEqual(0)
        })
      }
    })
  }

  // §8.10: Tab reaches the intro's links, then the button, then its link, then
  // whatever follows them on the page
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    test.describe(`focus order at ${viewport.width}`, () => {
      test.use({ viewport })

      for (const path of PATHS) {
        test(`${path}: intro links, then the button, then its link`, async ({
          page,
        }) => {
          await openApp(page, path)
          const intro = PAGES[path].intro

          const focusedText = () =>
            page.evaluate(() =>
              (document.activeElement?.textContent ?? "").trim(),
            )

          // past the header, to the first of the intro's links
          let reached = false
          for (let step = 0; step < 30 && !reached; step++) {
            await page.keyboard.press("Tab")
            reached = (await focusedText()) === intro[0]
          }
          expect(reached, `Tab reaches "${intro[0]}"`).toBe(true)

          const order = [intro[0]]
          for (let step = 0; step < intro.length + 1; step++) {
            await page.keyboard.press("Tab")
            order.push(await focusedText())
          }
          expect(order).toEqual([...intro, CTA, MORE])

          // the next stop comes after the block, not back in the header
          await page.keyboard.press("Tab")
          const followsBlock = await page.evaluate((more) => {
            const active = document.activeElement
            const link = [...document.querySelectorAll("main a")].find(
              (element) => (element.textContent ?? "").trim() === more,
            )
            if (!active || !link) return false
            return (
              active.closest("header, nav") === null &&
              Boolean(
                link.compareDocumentPosition(active) &
                  Node.DOCUMENT_POSITION_FOLLOWING,
              )
            )
          }, MORE)
          expect(followsBlock).toBe(true)
        })
      }
    })
  }
})

/** Opens a page in a fresh context set to a language, at the narrowest width. */
async function openInLocale(
  browser: Browser,
  locale: string,
  path: string,
): Promise<Page> {
  const context = await browser.newContext({
    locale,
    viewport: { width: 320, height: 568 },
    extraHTTPHeaders: { "x-test-bypass": "true" },
  })
  const page = await context.newPage()
  await openApp(page, path)
  await expect(page.locator("html")).toHaveAttribute("lang", locale)
  return page
}

// §8.8: a longer label in another language takes two lines, never clips
test.describe("in every shipped language", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "text fit: one engine is enough",
  )

  for (const path of PATHS) {
    test(`${path}: three blocks, every label whole`, async ({
      browser,
    }) => {
      for (const locale of LOCALES) {
        const page = await openInLocale(browser, locale, path)

        // the intro links go there too; the buttons are the 54 px ones
        const buttons = page.locator(`main a[href="${COMPUTER_GAME}"]`)
        const fits = await buttons.evaluateAll((links) =>
          links
            .filter((link) => link.getBoundingClientRect().height >= 54)
            .map((link) => ({
              text: (link.textContent ?? "").trim(),
              fits: link.scrollHeight <= link.clientHeight,
            })),
        )
        expect(fits, locale).toHaveLength(3)
        for (const { text, fits: whole } of fits) {
          expect(whole, `${locale}: "${text}"`).toBe(true)
        }

        await page.context().close()
      }
    })
  }
})
