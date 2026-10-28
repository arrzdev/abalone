import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"
import { expectNoClippedText } from "./support/layout"

// The ways in on home (the `play-free-first-screen` document on TUD-2287, copy
// from `play-free-copy` on TUD-2298): Play now first, alone and the only filled
// row, a link to the computer game. Under it Pass & Play and Friend online as
// one row of two, each saying in one line what the mode is. Above them on a
// desktop the heading and the lede that say the game is free and asks for no
// account; on a phone the board has that room, and the heading is there for a
// crawler and a screen reader only (TUD-2781).

const PRIMARY = {
  title: "Play now",
  hint: "vs the computer · free",
} as const
const PAIR = [
  { title: "Pass & Play", hint: "Two of you, one device." },
  { title: "Friend online", hint: "With friends." },
] as const

const H1 = "Play Abalone free, no account"
const LEDE_TRUST = "Free to play, no sign-up and no download."
const FRIEND_LINK = "Play Abalone online with a friend"

const PHONES = [
  { width: 320, height: 460 },
  { width: 375, height: 548 },
  { width: 390, height: 664 },
] as const

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const

const TAP_TARGET = 44
//under this the board is a blob, so its slot stays empty (§3.2, C5)
const SMALLEST_BOARD = 140

function escapePattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function startsWith(title: string): RegExp {
  return new RegExp(`^${escapePattern(title)}`)
}

function playNow(page: Page): Locator {
  return page
    .getByRole("main")
    .getByRole("link", { name: startsWith(PRIMARY.title) })
}

function pairTile(page: Page, title: string): Locator {
  return page.getByRole("button", { name: startsWith(title) })
}

//the board's own canvas, not the shadow drawn under it
function demoBoard(page: Page): Locator {
  return page.getByRole("main").getByRole("img", { name: /marbles/ })
}

async function box(locator: Locator) {
  const value = await locator.boundingBox()
  if (value === null) throw new Error(`${locator} is not drawn`)
  return value
}

/** The card's background, and the brand fill token resolved the same way. */
function backgrounds(card: Locator) {
  return card.evaluate((element) => {
    const probe = document.createElement("div")
    probe.style.backgroundColor = "var(--brand-fill)"
    document.body.append(probe)
    const brand = getComputedStyle(probe).backgroundColor
    probe.remove()
    return { own: getComputedStyle(element).backgroundColor, brand }
  })
}

/**
 * The text's colour, and white/70 resolved the same way: 9.34:1 on the
 * ground (§7). Read through a probe, since each engine reports a Tailwind
 * colour in its own notation.
 */
function ledeColors(text: Locator) {
  return text.evaluate((element) => {
    const probe = document.createElement("span")
    probe.className = "text-white/70"
    document.body.append(probe)
    const white70 = getComputedStyle(probe).color
    probe.remove()
    return { own: getComputedStyle(element).color, white70 }
  })
}

/** Whether either line inside the card is cut short. */
function linesOverflow(card: Locator): Promise<boolean> {
  return card.evaluate((element) =>
    [...element.querySelectorAll<HTMLElement>("span > span")].some(
      (line) => line.scrollWidth > line.clientWidth,
    ),
  )
}

/** The room the board is given on a phone: its size container, padding off. */
function boardSlotHeight(page: Page): Promise<number> {
  return page.evaluate(() => {
    const slot = [
      ...document.querySelectorAll<HTMLElement>("main div"),
    ].find((element) => getComputedStyle(element).containerType === "size")
    if (slot === undefined) throw new Error("no board slot")
    const style = getComputedStyle(slot)
    return (
      slot.clientHeight -
      Number.parseFloat(style.paddingTop) -
      Number.parseFloat(style.paddingBottom)
    )
  })
}

function hasSidewaysScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  )
}

for (const viewport of VIEWPORTS) {
  const isPhone = viewport.width < 1024

  test.describe(`home at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport })

    test(`says free and no account ${isPhone ? "to a screen reader only" : "above the ways in"}`, async ({
      page,
    }) => {
      await openApp(page, "/")

      const heading = page.getByRole("heading", { level: 1 })
      await expect(heading).toHaveCount(1)
      await expect(heading).toHaveText(H1)
      const headingBox = await box(heading)
      if (isPhone) {
        //`sr-only`: one pixel, which Playwright still counts as visible
        expect(headingBox.height).toBeLessThanOrEqual(1)
        return
      }
      expect(headingBox.height).toBeGreaterThan(20)
      expect(headingBox.y + headingBox.height).toBeLessThanOrEqual(
        (await box(playNow(page))).y,
      )
      //the lede says it too, brighter than the rest of it
      const lede = await ledeColors(
        page.getByText(LEDE_TRUST, { exact: true }),
      )
      expect(lede.own).toBe(lede.white70)
    })

    test("Play now alone on top, then Pass & Play and Friend online side by side", async ({
      page,
    }) => {
      await openApp(page, "/")

      await expect(playNow(page)).toHaveCount(1)
      for (const { title } of PAIR) {
        await expect(
          page.getByRole("button", {
            name: startsWith(title),
            includeHidden: true,
          }),
          `one ${title} in the DOM, hidden or not`,
        ).toHaveCount(1)
      }

      const primary = await box(playNow(page))
      const local = await box(pairTile(page, PAIR[0].title))
      const online = await box(pairTile(page, PAIR[1].title))
      expect(local.y, "the pair under Play now").toBeGreaterThan(
        primary.y + primary.height,
      )
      expect(
        Math.abs(local.y - online.y),
        "the pair on one row",
      ).toBeLessThan(1)
      expect(
        online.x,
        "Friend online right of Pass & Play",
      ).toBeGreaterThan(local.x + local.width)
    })

    test("only Play now is filled", async ({ page }) => {
      await openApp(page, "/")

      const primary = await backgrounds(playNow(page))
      expect(primary.own, "Play now has the brand fill").toBe(
        primary.brand,
      )
      for (const { title } of PAIR) {
        const { own, brand } = await backgrounds(pairTile(page, title))
        expect(own, `${title} is not filled`).not.toBe(brand)
      }
    })

    test("each way in says what it is and what it needs, in full", async ({
      page,
    }) => {
      await openApp(page, "/")

      const cards = [
        { card: playNow(page), ...PRIMARY },
        ...PAIR.map((tile) => ({
          card: pairTile(page, tile.title),
          ...tile,
        })),
      ]
      for (const { card, title, hint } of cards) {
        await expect(card).toHaveAccessibleName(
          new RegExp(
            `^${escapePattern(title)}\\s*${escapePattern(hint)}$`,
          ),
        )
        const { width, height } = await box(card)
        expect(width).toBeGreaterThanOrEqual(TAP_TARGET)
        expect(
          height,
          `${title} tall enough to tap`,
        ).toBeGreaterThanOrEqual(TAP_TARGET)
        expect(await linesOverflow(card), `${title} cut short`).toBe(false)
      }

      //white/90 on brand is 4.82:1, AA only from 13px (§7)
      const hintSize = await playNow(page).evaluate((element) => {
        const lines = element.querySelectorAll<HTMLElement>("span > span")
        return Number.parseFloat(
          getComputedStyle(lines[lines.length - 1]).fontSize,
        )
      })
      expect(hintSize).toBeGreaterThanOrEqual(13)
    })

    test(`the friend link under the rows is ${isPhone ? "gone" : "kept"}`, async ({
      page,
    }) => {
      await openApp(page, "/")
      const link = page
        .getByRole("main")
        .getByRole("link", { name: FRIEND_LINK, exact: true })
      if (isPhone) await expect(link).toBeHidden()
      if (!isPhone) await expect(link).toBeVisible()
    })

    test("no sideways scroll and no text cut short", async ({ page }) => {
      await openApp(page, "/")
      expect(await hasSidewaysScroll(page)).toBe(false)
      await expectNoClippedText(page.getByRole("main"))
    })
  })
}

test.describe("first screen", () => {
  for (const viewport of PHONES) {
    test.describe(`${viewport.width}×${viewport.height}`, () => {
      test.use({ viewport })

      test("Play now ends inside it", async ({ page }) => {
        await openApp(page, "/")
        const { y, height } = await box(playNow(page))
        expect(y + height).toBeLessThanOrEqual(viewport.height)
        expect(await hasSidewaysScroll(page)).toBe(false)
      })

      //a board under 140px reads as a broken picture: a board big enough to
      //be one, or none at all
      test("the demo board is a board or nothing", async ({ page }) => {
        await openApp(page, "/")
        const slotHeight = await boardSlotHeight(page)

        if (slotHeight < SMALLEST_BOARD) {
          await expect(demoBoard(page)).toBeHidden()
          await expect(
            page.getByRole("button", { name: "Pause demo" }),
          ).toBeHidden()
          return
        }
        await expect(demoBoard(page)).toBeVisible()
      })
    })
  }

  //the room the phone heading took is the board's now (TUD-2781), so a
  //phone's first screen has a board's worth of it. Smaller screens sit on
  //the 140px line, where WebKit's taller text tips it to no board: the
  //board-or-nothing check above covers them
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 390, height: 664 },
  ]) {
    test.describe(`${viewport.width}×${viewport.height}`, () => {
      test.use({ viewport })

      test("keeps the board", async ({ page }) => {
        await openApp(page, "/")
        await expect(demoBoard(page)).toBeVisible()
      })
    })
  }
})

// C6: it opens a game before the page hydrates, and a crawler follows it
test.describe("Play now is a link", () => {
  test("served as a link to the computer game", async ({ request }) => {
    const html = await (await request.get("/")).text()
    expect(html).toMatch(
      /<a[^>]*href="\/offline\?mode=ai"[^>]*>(?:\s|<[^>]+>)*Play now/,
    )
  })

  test.describe("with JavaScript off", () => {
    test.use({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 664 },
    })

    test("tapping it opens /offline", async ({ page }) => {
      await page.goto("/")
      await playNow(page).click()
      await expect(page).toHaveURL(/\/offline\?mode=ai$/)
    })
  })
})

test.describe("taps", () => {
  test("Play now opens a game against the computer", async ({ page }) => {
    await openApp(page, "/")
    await playNow(page).click()
    await expect(page).toHaveURL(/\/offline\?mode=ai/)
  })

  test("Pass & Play opens a game on this device", async ({ page }) => {
    await openApp(page, "/")
    await pairTile(page, "Pass & Play").click()
    await expect(page).toHaveURL(/\/offline\?mode=local/)
  })

  test("Friend online asks a visitor to sign in", async ({ page }) => {
    await openApp(page, "/")
    await pairTile(page, "Friend online").click()
    //by its name, so the phone drawer answers to it as the desktop dialog does
    await expect(
      page.getByRole("dialog", { name: "Sign in to play online" }),
    ).toBeVisible()
  })
})

test("Tab reaches the ways in in the order they are drawn, then the rules", async ({
  page,
}) => {
  await openApp(page, "/")
  const wanted = [
    PRIMARY.title,
    ...PAIR.map(({ title }) => title),
    "Rules",
  ]
  const reached: string[] = []

  for (let stop = 0; stop < 25 && reached.length < wanted.length; stop++) {
    await page.keyboard.press("Tab")
    //inside the page only: the desktop header has its own "Play Online" link
    const name = await page.evaluate(() => {
      const element = document.activeElement
      if (element?.closest("main") == null) return ""
      return element.textContent?.trim() ?? ""
    })
    const match = wanted.find((title) => name.startsWith(title))
    if (match !== undefined && !reached.includes(match))
      reached.push(match)
  }

  expect(reached).toEqual(wanted)
})

// The other languages keep their own words, and their longer lines still have to fit the smallest first screen
const LANGUAGES = [
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

for (const language of LANGUAGES) {
  test.describe(`in ${language} at 320×460`, () => {
    test.use({ viewport: { width: 320, height: 460 } })

    test("the computer game still ends inside the first screen", async ({
      page,
    }) => {
      await page.addInitScript((value) => {
        localStorage.setItem("abalone_language", value)
      }, language)
      await openApp(page, "/")
      await expect(page.locator("html")).toHaveAttribute("lang", language)

      const computer = page.locator('main a[href$="/offline?mode=ai"]')
      const { y, height } = await box(computer)
      expect(y + height).toBeLessThanOrEqual(460)
      expect(await hasSidewaysScroll(page)).toBe(false)
      await expectNoClippedText(page.getByRole("main"))
    })

    //what the mode is, in one line even on the narrowest phone (TUD-2781)
    test("the online tile says what it is in one line", async ({
      page,
    }) => {
      await page.addInitScript((value) => {
        localStorage.setItem("abalone_language", value)
      }, language)
      await openApp(page, "/")
      await expect(page.locator("html")).toHaveAttribute("lang", language)

      //the online tile is the second of the pair
      const lines = await page
        .locator("main .grid > button")
        .last()
        .evaluate((tile) => {
          const hint = tile.querySelector("span > span:last-child")
          if (hint === null) throw new Error("no hint line")
          const lineHeight = Number.parseFloat(
            getComputedStyle(hint).lineHeight,
          )
          return hint.getBoundingClientRect().height / lineHeight
        })
      expect(lines).toBeLessThan(1.5)
    })
  })
}

// The Rules and Strategy links under the tiles (TUD-2781): one tight group on
// one line, no separator left at a line end, and more room between the tiles
// and the pair than between the two links.
//tr has the longest pair
const LINK_LANGUAGES = ["en", "pt", "tr"] as const
const LINK_WIDTHS = [320, 375, 402] as const

for (const language of LINK_LANGUAGES) {
  for (const width of LINK_WIDTHS) {
    test.describe(`rules and strategy links in ${language} at ${width}px`, () => {
      test.use({ viewport: { width, height: 710 } })

      test("one line, closer to each other than to the tiles", async ({
        page,
      }) => {
        await page.addInitScript((value) => {
          localStorage.setItem("abalone_language", value)
        }, language)
        await openApp(page, "/")
        await expect(page.locator("html")).toHaveAttribute(
          "lang",
          language,
        )

        const main = page.getByRole("main")
        const rules = await box(main.locator('a[href$="/rules"]'))
        const strategy = await box(main.locator('a[href$="/strategy"]'))
        expect(Math.abs(rules.y - strategy.y), "on one line").toBeLessThan(
          1,
        )

        //the words, not the 44px tap boxes around them, against the tiles
        //right above the line
        const gaps = await main
          .locator('a[href$="/rules"]')
          .evaluate((rulesLink) => {
            const words = (link: Element) => {
              const range = document.createRange()
              range.selectNodeContents(link)
              return range.getBoundingClientRect()
            }
            const line = rulesLink.parentElement
            const tiles = line?.previousElementSibling
            const strategyLink = line?.querySelector(
              'a[href$="/strategy"]',
            )
            if (tiles == null || strategyLink == null)
              throw new Error("no tiles or no strategy link")
            const first = words(rulesLink)
            return {
              above: first.top - tiles.getBoundingClientRect().bottom,
              between: words(strategyLink).left - first.right,
            }
          })
        const { above, between } = gaps
        expect(above, "more room above than between").toBeGreaterThan(
          between,
        )
      })
    })
  }
}
