import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"

// The setup panel holds the modes and their options, nothing to read
// (TUD-2781): the bots and the device questions are on /strategy and /rules.
// In both modes the panel ends at its last option, with Play pinned under it.

const SIZES = [
  { width: 375, height: 667 },
  { width: 402, height: 710 },
  { width: 1440, height: 900 },
]

for (const viewport of SIZES) {
  test.describe(`at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport })

    for (const mode of ["ai", "local"] as const) {
      test(`the ${mode} setup panel has options only, and Play stays in view`, async ({
        page,
      }) => {
        await openApp(page, `/offline?mode=${mode}`)
        const panel = page.locator("aside .panel-scroll")
        await expect(panel).toBeVisible()

        await expect(
          panel.getByRole("heading", { name: "Frequently asked" }),
        ).toHaveCount(0)
        await expect(
          panel.getByRole("heading", {
            name: "How strong is the computer?",
          }),
        ).toHaveCount(0)
        await expect(
          page.getByRole("button", { name: "Play", exact: true }),
        ).toBeInViewport({ ratio: 1 })
      })
    }
  })
}
