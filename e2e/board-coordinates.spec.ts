import type { Locator, Page } from "@playwright/test"
import { startOfflineGame } from "./support/app"
import { playMove } from "./support/board"
import { waitForRest } from "./support/layout"
import { expect, test } from "./support/test"

// The rank and file letters a–i and numbers 1–9 around a board in play are a
// preference: "Show coordinates" in Settings turns them off and on, the board
// repaints at once, the choice survives a reload, and it stays on this device.
// Where each label sits, its size and its contrast are pinned by the unit
// tests next to the renderer (draw-board.test.ts, board-themes.test.ts): text
// painted on a canvas is invisible to the DOM and to axe.

const SWITCH = { name: "Show coordinates" } as const

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

/** A fingerprint of every pixel the game board has painted. */
function boardPixels(page: Page): Promise<string> {
  return page
    .locator("main .game-canvas-wrapper canvas")
    .first()
    .evaluate((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement)) return ""
      const context = canvas.getContext("2d")
      if (context === null) return ""
      const { data } = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      )
      let hash = 0
      for (let index = 0; index < data.length; index++)
        hash = (Math.imul(hash, 31) + data[index]) | 0
      return `${canvas.width}x${canvas.height}:${hash}`
    })
}

/** Waits for the board to settle on one picture and returns it. */
async function settledBoard(page: Page): Promise<string> {
  let last = ""
  await expect
    .poll(
      async () => {
        const now = await boardPixels(page)
        const same = now === last
        last = now
        return same
      },
      { message: "board painted and still" },
    )
    .toBe(true)
  return last
}

test("the labels are on in play, the switch takes them off and back, and the choice survives a reload", async ({
  page,
}) => {
  const sent: string[] = []
  page.on("request", (request) => {
    sent.push(`${request.url()} ${request.postData() ?? ""}`)
  })

  await startOfflineGame(page, "Pass & Play")
  await playMove(page, "c5", "d5")
  const labelled = await settledBoard(page)

  const dialog = await openSettings(page)
  const toggle = dialog.getByRole("switch", SWITCH)
  await expect(toggle).toBeChecked()
  await expect(dialog).toContainText(
    "Letters and numbers along the edge of the board",
  )

  await toggle.click()
  await expect(toggle).not.toBeChecked()
  await expect.poll(() => boardPixels(page)).not.toBe(labelled)
  const bare = await settledBoard(page)

  await toggle.click()
  await expect(toggle).toBeChecked()
  // On is exactly the board as it was: the labels are the only thing the
  // switch paints, and nothing moves to make room for them.
  await expect.poll(() => boardPixels(page)).toBe(labelled)

  await toggle.click()
  await expect(toggle).not.toBeChecked()
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()

  // A reload puts the game back on the board (offline-restore.spec.ts), so the
  // same game is played on. The reloaded page can still be settling on
  // /offline?mode=local when reload() returns, so the final URL is waited for.
  await page.reload()
  await expect(page).toHaveURL(/\/offline\?mode=local$/)
  await expect(page.getByRole("button", { name: "Resign" })).toBeVisible()
  expect(await settledBoard(page)).toBe(bare)
  const reopened = await openSettings(page)
  await expect(reopened.getByRole("switch", SWITCH)).not.toBeChecked()

  expect(
    sent.filter((line) => /showBoardLabels|showCoordinates/i.test(line)),
    "requests that carry the choice",
  ).toEqual([])
})

// The old switch of the same name printed a debug pair in every cell and was
// off by default, so a stored "off" from it says nothing about the labels.
test("an off saved by the old in-cell overlay does not take the labels away", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("abalone_showCoordinates", "false")
  })
  await startOfflineGame(page, "Pass & Play")
  const dialog = await openSettings(page)
  await expect(dialog.getByRole("switch", SWITCH)).toBeChecked()
})
