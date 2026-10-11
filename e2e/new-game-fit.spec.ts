import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, startOfflineGame } from "./support/app"

// A new player on a phone reads the New Game screen and presses Play without
// scrolling: every label is at least 12px, and Play stays pinned in view while
// the options scroll behind it. A tall phone is where Play used to fall below
// the fold, so that is the size the reading check runs at.
const PHONE = { width: 390, height: 844 }
const MIN_FONT_SIZE = 12

/**
 * The text on the page a reader can see, each with its computed font size.
 * Screen-reader-only text is clipped to a pixel and is not read off the screen,
 * so it does not count.
 */
function visibleTextSizes(
  page: Page,
): Promise<{ text: string; fontSize: number }[]> {
  return page.evaluate(() => {
    const sizes: { text: string; fontSize: number }[] = []
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    )
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim() ?? ""
      const parent = node.parentElement
      if (text === "" || parent === null) continue
      if (
        !parent.checkVisibility({
          opacityProperty: true,
          visibilityProperty: true,
        })
      )
        continue
      const range = document.createRange()
      range.selectNodeContents(node)
      const box = range.getBoundingClientRect()
      if (box.width <= 1 || box.height <= 1) continue
      sizes.push({
        text,
        fontSize: Number.parseFloat(getComputedStyle(parent).fontSize),
      })
    }
    return sizes
  })
}

async function expectReadableText(page: Page): Promise<void> {
  const small = (await visibleTextSizes(page)).filter(
    ({ fontSize }) => fontSize < MIN_FONT_SIZE,
  )
  expect(small, "text smaller than 12px").toEqual([])
}

function playButton(page: Page) {
  return page.getByRole("button", { name: "Play", exact: true })
}

test.describe("at 390×844", () => {
  test.use({ viewport: PHONE })

  for (const mode of ["vs Computer", "Pass & Play"] as const) {
    test(`the ${mode} New Game screen shows Play and only text of 12px or more`, async ({
      page,
    }) => {
      await openApp(page, "/offline")
      await page.getByRole("tab", { name: mode }).click()

      await expect(playButton(page)).toBeInViewport({ ratio: 1 })
      await expectReadableText(page)
    })
  }

  test("a game in progress shows only text of 12px or more", async ({
    page,
  }) => {
    await startOfflineGame(page, "vs Computer")
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible()

    await expectReadableText(page)
  })
})

// Pinning Play must not cost the other sizes it already worked at.
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]) {
  test.describe(`at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport })

    test("Play is in view on both New Game tabs", async ({ page }) => {
      await openApp(page, "/offline")
      for (const mode of ["vs Computer", "Pass & Play"] as const) {
        await page.getByRole("tab", { name: mode }).click()
        await expect(playButton(page)).toBeInViewport({ ratio: 1 })
      }
    })
  })
}
