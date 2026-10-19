import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"
import { expectNoClippedText, waitForRest } from "./support/layout"

// The marble design is picked from tiles in Settings, each showing a white and
// a black marble drawn in that design. The choice survives a reload, and a
// saved design this build does not know reads as the default.

async function openSettings(page: Page): Promise<Locator> {
  await page
    .getByRole("button", { name: "Settings" })
    .filter({ visible: true })
    .first()
    .click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await waitForRest(dialog)
  return dialog
}

function designGroup(dialog: Locator): Locator {
  return dialog.getByRole("radiogroup", { name: "Marble Design" })
}

/** How many pixels of a tile's marble pair are painted at all. */
function paintedShare(tile: Locator): Promise<number> {
  return tile.evaluate((element) => {
    const canvases = [...element.querySelectorAll("canvas")]
    if (canvases.length !== 2) return 0
    let painted = 0
    let total = 0
    for (const canvas of canvases) {
      const context = canvas.getContext("2d")
      if (context === null) return 0
      const { data } = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      )
      for (let index = 3; index < data.length; index += 4) {
        total++
        if (data[index] > 0) painted++
      }
    }
    return painted / total
  })
}

test("a marble design picked in Settings survives a reload", async ({
  page,
}) => {
  await openApp(page, "/offline")
  const dialog = await openSettings(page)
  const group = designGroup(dialog)
  const options = group.getByRole("radio")
  await expect(options).toHaveText(["Minimalist", "Realistic"])
  await expect(group.getByRole("radio", { checked: true })).toHaveText(
    "Realistic",
  )

  // Each tile shows its two marbles, drawn rather than left blank.
  for (const option of await options.all()) {
    await expect.poll(() => paintedShare(option)).toBeGreaterThan(0.5)
  }

  // The arrow keys move the choice along the row, as a group of radios does.
  await group.getByRole("radio", { name: "Realistic" }).focus()
  await page.keyboard.press("ArrowLeft")
  const minimalist = group.getByRole("radio", { name: "Minimalist" })
  await expect(minimalist).toHaveAttribute("aria-checked", "true")
  await expect(minimalist).toBeFocused()

  await page.reload()
  const reopened = await openSettings(page)
  await expect(
    designGroup(reopened).getByRole("radio", { checked: true }),
  ).toHaveText("Minimalist")

  await designGroup(reopened)
    .getByRole("radio", { name: "Realistic" })
    .click()
  await page.reload()
  await expect(
    designGroup(await openSettings(page)).getByRole("radio", {
      checked: true,
    }),
  ).toHaveText("Realistic")
})

test("a saved marble design this build does not know reads as Realistic", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("abalone_marbleDesign", JSON.stringify("glass"))
  })
  await openApp(page, "/offline")
  const dialog = await openSettings(page)
  await expect(
    designGroup(dialog).getByRole("radio", { checked: true }),
  ).toHaveText("Realistic")
})

for (const width of [320, 375, 1280]) {
  test(`at ${width}px wide, every marble design tile is a 44px target with its name in full`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width < 1000 ? 667 : 800 })
    await openApp(page, "/offline")
    const group = designGroup(await openSettings(page))
    const options = group.getByRole("radio")
    await expect(options).toHaveCount(2)
    for (const option of await options.all()) {
      const box = await option.boundingBox()
      expect(Math.round(box?.width ?? 0)).toBeGreaterThanOrEqual(44)
      expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(44)
    }
    await expectNoClippedText(group)
  })
}
