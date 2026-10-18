import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"

// The vs-computer copy at the tail of the setup panel (the `offline-copy`
// document on TUD-1690). A player who came to play still has Play pinned in
// view; a reader who scrolls the options reaches every line of the copy whole.
// Not `expectNoClippedText`: the panel scrolls, so everything above or below
// its window counts as cut off there. What would cut a line here is a word
// too long for the column, which shows as a panel wider than its own box.

const SIZES = [
  { width: 375, height: 667 },
  { width: 402, height: 710 },
  { width: 1440, height: 900 },
]

for (const viewport of SIZES) {
  test.describe(`at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport })

    test("the setup panel ends with the copy, whole, and Play stays in view", async ({
      page,
    }) => {
      await openApp(page, "/offline")
      const faq = page.getByRole("heading", { name: "Frequently asked" })

      await faq.scrollIntoViewIfNeeded()
      await expect(faq).toBeInViewport()
      await expect(
        page.getByRole("button", { name: "Play", exact: true }),
      ).toBeInViewport({ ratio: 1 })
      const panel = page.locator("aside .panel-scroll")
      const overflow = await panel.evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      )
      expect(overflow, "copy wider than the panel").toBeLessThanOrEqual(0)
    })
  })
}
