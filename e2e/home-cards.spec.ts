import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"

// The three ways in on home (the `home-cards` document on TUD-819, §6): vs
// Computer first and the only filled card, then Pass & Play, then Play Online,
// whose line says an account is needed before anyone taps it. One layout and
// one line per card at every size, so the same strings are checked at each.

const CARDS = [
  { title: "vs Computer", hint: "Eight bots, easy to hard." },
  { title: "Pass & Play", hint: "Two of you, one device." },
  { title: "Play Online", hint: "Free account. Invite anyone." },
] as const

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const

const TAP_TARGET = 44

function escapePattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function card(page: Page, title: string): Locator {
  return page.getByRole("button", {
    name: new RegExp(`^${escapePattern(title)}`),
  })
}

/** The card's background, and the brand fill token resolved the same way. */
function backgrounds(button: Locator) {
  return button.evaluate((element) => {
    const probe = document.createElement("div")
    probe.style.backgroundColor = "var(--brand-fill)"
    document.body.append(probe)
    const brand = getComputedStyle(probe).backgroundColor
    probe.remove()
    return { own: getComputedStyle(element).backgroundColor, brand }
  })
}

/** Whether the line under the card's title is cut short. */
function hintOverflows(button: Locator): Promise<boolean> {
  return button.evaluate((element) => {
    const lines = element.querySelectorAll<HTMLElement>("span > span")
    const hint = lines[lines.length - 1]
    return hint.scrollWidth > hint.clientWidth
  })
}

for (const viewport of VIEWPORTS) {
  test.describe(`home at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport })

    test("vs Computer, Pass & Play and Play Online, once each and in that order", async ({
      page,
    }) => {
      await openApp(page, "/")

      const tops: number[] = []
      for (const { title } of CARDS) {
        const button = card(page, title)
        await expect(
          page.getByRole("button", {
            name: new RegExp(`^${escapePattern(title)}`),
            includeHidden: true,
          }),
          `one ${title} in the DOM, hidden or not`,
        ).toHaveCount(1)
        await expect(button).toBeVisible()
        const box = await button.boundingBox()
        if (box === null) throw new Error(`${title} has no box`)
        tops.push(box.y)
      }
      //one above the other, in this order: a pair side by side is not a
      //column of three
      for (const [index, top] of tops.entries()) {
        if (index === 0) continue
        expect(
          top,
          `${CARDS[index].title} below the one before`,
        ).toBeGreaterThan(tops[index - 1])
      }
    })

    test("only vs Computer is filled", async ({ page }) => {
      await openApp(page, "/")

      const [computer, ...others] = CARDS
      const primary = await backgrounds(card(page, computer.title))
      expect(primary.own, "vs Computer has the brand fill").toBe(
        primary.brand,
      )
      for (const { title } of others) {
        const { own, brand } = await backgrounds(card(page, title))
        expect(own, `${title} is not filled`).not.toBe(brand)
      }
    })

    test("each card names its mode and says what it needs, in full", async ({
      page,
    }) => {
      await openApp(page, "/")

      for (const { title, hint } of CARDS) {
        const button = card(page, title)
        await expect(button).toHaveAccessibleName(
          new RegExp(
            `^${escapePattern(title)}\\s*${escapePattern(hint)}$`,
          ),
        )
        const box = await button.boundingBox()
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(TAP_TARGET)
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(TAP_TARGET)
        expect(
          await hintOverflows(button),
          `${title} line cut short`,
        ).toBe(false)
      }
    })
  })
}

test.describe("first screen", () => {
  for (const { width, height } of [
    { width: 320, height: 460 },
    { width: 390, height: 664 },
  ]) {
    test.describe(`${width}×${height}`, () => {
      test.use({ viewport: { width, height } })

      test("vs Computer ends inside the first screen", async ({
        page,
      }) => {
        await openApp(page, "/")
        const box = await card(page, "vs Computer").boundingBox()
        if (box === null) throw new Error("vs Computer has no box")
        expect(box.y + box.height).toBeLessThanOrEqual(height)
      })
    })
  }
})

test.describe("taps", () => {
  test("vs Computer opens a game against the computer", async ({
    page,
  }) => {
    await openApp(page, "/")
    await card(page, "vs Computer").click()
    await expect(page).toHaveURL(/\/offline\?mode=ai/)
  })

  test("Pass & Play opens a game on this device", async ({ page }) => {
    await openApp(page, "/")
    await card(page, "Pass & Play").click()
    await expect(page).toHaveURL(/\/offline\?mode=local/)
  })

  test("Play Online asks a visitor to sign in", async ({ page }) => {
    await openApp(page, "/")
    await card(page, "Play Online").click()
    await expect(
      page.getByRole("dialog", { name: "Sign in to play online" }),
    ).toBeVisible()
  })
})

test("Tab reaches the cards in the order they are drawn, then the rules", async ({
  page,
}) => {
  await openApp(page, "/")
  const wanted = [...CARDS.map(({ title }) => title), "Abalone rules"]
  const reached: string[] = []

  for (let stop = 0; stop < 25 && reached.length < wanted.length; stop++) {
    await page.keyboard.press("Tab")
    const name = await page.evaluate(
      () => document.activeElement?.textContent?.trim() ?? "",
    )
    const match = wanted.find((title) => name.startsWith(title))
    if (match !== undefined && !reached.includes(match))
      reached.push(match)
  }

  expect(reached).toEqual(wanted)
})
