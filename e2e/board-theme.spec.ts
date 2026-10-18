import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, startOfflineGame } from "./support/app"
import { moveList, playMove } from "./support/board"
import { expectNoClippedText } from "./support/layout"

// The board can be painted Slate (the default), Walnut or Felt from Settings.
// It is paint and nothing else: picking one mid-game repaints the board at once
// and leaves the game where it was, the choice survives a reload, and it is a
// preference on this device that no request carries.

const BOARD_FILL = {
  slate: [0x62, 0x73, 0x84],
  walnut: [0xa0, 0x7a, 0x52],
  felt: [0x5f, 0x8c, 0x6e],
} as const

type Theme = keyof typeof BOARD_FILL

async function openSettings(page: Page): Promise<Locator> {
  await page
    .getByRole("button", { name: "Settings" })
    .filter({ visible: true })
    .first()
    .click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  return dialog
}

/** The share of the game board's pixels painted in a theme's board colour. */
function boardShare(page: Page, theme: Theme): Promise<number> {
  return page
    .locator("main .game-canvas-wrapper canvas")
    .first()
    .evaluate((canvas, [red, green, blue]) => {
      if (!(canvas instanceof HTMLCanvasElement)) return 0
      const context = canvas.getContext("2d")
      if (context === null) return 0
      const { data } = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      )
      let matching = 0
      for (let index = 0; index < data.length; index += 4) {
        if (
          Math.abs(data[index] - red) <= 2 &&
          Math.abs(data[index + 1] - green) <= 2 &&
          Math.abs(data[index + 2] - blue) <= 2
        )
          matching++
      }
      return matching / (data.length / 4)
    }, BOARD_FILL[theme])
}

async function expectBoardPainted(
  page: Page,
  theme: Theme,
): Promise<void> {
  await expect
    .poll(() => boardShare(page, theme), {
      message: `board painted ${theme}`,
    })
    .toBeGreaterThan(0.1)
}

test("a theme picked mid-game repaints the board, keeps the game and survives a reload", async ({
  page,
}) => {
  const sent: string[] = []
  page.on("request", (request) => {
    sent.push(`${request.url()} ${request.postData() ?? ""}`)
  })

  await startOfflineGame(page, "Pass & Play")
  await playMove(page, "c5", "d5")
  await expectBoardPainted(page, "slate")
  const moves = await moveList(page).allTextContents()
  expect(moves).toEqual(["c5d5"])

  const dialog = await openSettings(page)
  const group = dialog.getByRole("radiogroup", { name: "Board Theme" })
  const options = group.getByRole("radio")
  await expect(options).toHaveCount(3)
  await expect(options).toHaveText(["Slate", "Walnut", "Felt"])
  await expect(group.getByRole("radio", { checked: true })).toHaveText(
    "Slate",
  )

  // The arrow keys move the choice along the row, as a group of radios does.
  await group.getByRole("radio", { name: "Slate" }).focus()
  await page.keyboard.press("ArrowRight")
  const walnut = group.getByRole("radio", { name: "Walnut" })
  await expect(walnut).toHaveAttribute("aria-checked", "true")
  await expect(walnut).toBeFocused()
  await expectBoardPainted(page, "walnut")

  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  await expect(moveList(page)).toHaveText(moves)
  await expect(page.getByRole("button", { name: "Resign" })).toBeVisible()

  await page.reload()
  await expectBoardPainted(page, "walnut")
  const reopened = await openSettings(page)
  await expect(
    reopened
      .getByRole("radiogroup", { name: "Board Theme" })
      .getByRole("radio", { checked: true }),
  ).toHaveText("Walnut")

  expect(
    sent.filter((line) => /walnut|boardTheme/i.test(line)),
    "requests that carry the theme",
  ).toEqual([])
})

test("a saved theme this build does not know reads as Slate", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("abalone_boardTheme", JSON.stringify("sand"))
  })
  await openApp(page, "/offline")
  const dialog = await openSettings(page)
  await expect(
    dialog
      .getByRole("radiogroup", { name: "Board Theme" })
      .getByRole("radio", { checked: true }),
  ).toHaveText("Slate")
})

for (const width of [320, 375, 1280]) {
  test(`at ${width}px wide, every theme tile is a 44px target and the sheet does not scroll sideways`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width < 1000 ? 667 : 800 })
    await openApp(page, "/offline")
    const dialog = await openSettings(page)
    const group = dialog.getByRole("radiogroup", { name: "Board Theme" })
    const options = group.getByRole("radio")
    await expect(options).toHaveCount(3)
    for (const option of await options.all()) {
      // Rounded: the sheet comes to rest on a fraction of a pixel.
      const box = await option.boundingBox()
      expect(Math.round(box?.width ?? 0)).toBeGreaterThanOrEqual(44)
      expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(44)
    }
    await expectNoClippedText(group)
    expect(
      await dialog.evaluate((root) => ({
        sheet: root.scrollWidth - root.clientWidth,
        page: document.documentElement.scrollWidth - window.innerWidth,
      })),
      "sideways overflow",
    ).toEqual({ sheet: 0, page: 0 })
  })
}
