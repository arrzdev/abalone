import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { startOfflineGame } from "./support/app"
import { moveList } from "./support/board"

// A player with only a keyboard plays a whole move. Tab reaches the board, the
// arrow keys walk a focus cell across it, Space picks a marble up and Enter puts
// it down. The board says which cell has focus, since the canvas shows it only
// to the eye.
//
// The key map, on the board as the player sees it:
//   ArrowLeft / ArrowRight  the next cell along the row
//   ArrowUp                 the row above: up-right, or up-left at the edge
//   ArrowDown               the row below: down-left, or down-right at the edge
//   Space / Enter           the same as a tap on the focused cell
// Focus starts on the centre, e5.

// Enough to reach the board from the top of the game screen.
const MAX_TAB_STOPS = 30

/**
 * Presses Tab until the board has focus, and fails when it never does. Asks
 * the page rather than the locator, so a board that is no Tab stop fails here
 * and says so, instead of waiting out the test on an element that never comes.
 */
async function tabToBoard(page: Page): Promise<void> {
  for (let stop = 0; stop < MAX_TAB_STOPS; stop++) {
    await page.keyboard.press("Tab")
    const focused = await page.evaluate(
      () => document.activeElement?.tagName === "CANVAS",
    )
    if (focused) return
  }
  throw new Error(
    `the board is not one of the first ${MAX_TAB_STOPS} Tab stops`,
  )
}

test("a keyboard alone moves a marble from c5 to d5", async ({ page }) => {
  await startOfflineGame(page, "Pass & Play")
  const board = page.getByRole("application", { name: /to move/i })

  await tabToBoard(page)

  // Focus shows on the board itself, not only on the cell inside it.
  const outline = await board.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
    }
  })
  expect(outline.style).not.toBe("none")
  expect(outline.width).toBeGreaterThanOrEqual(2)

  await expect(board).toHaveAccessibleDescription("e5, empty")

  // e5 → d4 → c3 → c4 → c5
  await page.keyboard.press("ArrowDown")
  await expect(board).toHaveAccessibleDescription("d4, empty")
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("ArrowRight")
  await expect(board).toHaveAccessibleDescription("c5, black marble")

  await page.keyboard.press("Space")
  await expect(board).toHaveAccessibleDescription(
    "c5, black marble, selected",
  )

  // c5 → d6 → d5
  await page.keyboard.press("ArrowUp")
  await expect(board).toHaveAccessibleDescription(
    "d6, empty, you can move here",
  )
  await page.keyboard.press("ArrowLeft")
  await expect(board).toHaveAccessibleDescription(
    "d5, empty, you can move here",
  )

  await page.keyboard.press("Enter")

  await expect(moveList(page)).toHaveText(["c5d5"])
  await expect(board).toHaveAccessibleName(/Last move: c5d5\./)
  // The board keeps focus, so the next player carries on from the same cell.
  await expect(board).toBeFocused()
  await expect(board).toHaveAccessibleDescription("d5, black marble")
})

// A screen reader hears nothing of the canvas, so a status line under it says
// each move in words and whose turn it is next, the computer's reply included.
// An empty cell the selection can move to says so, where it used to read the
// same as one it cannot reach.
test("a screen reader hears each move and the turn after it", async ({
  page,
}) => {
  await startOfflineGame(page, "vs Computer")
  const board = page.getByRole("application", { name: /to move/i })
  const status = page.getByRole("status").filter({ hasText: /to move/ })

  await tabToBoard(page)

  // e5 → d4 → c3, then up to d4
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowDown")
  await expect(board).toHaveAccessibleDescription("c3, black marble")
  await page.keyboard.press("Enter")
  await page.keyboard.press("ArrowUp")
  await expect(board).toHaveAccessibleDescription(
    "d4, empty, you can move here",
  )
  // Out of reach of the selection: two rows up.
  await page.keyboard.press("ArrowUp")
  await expect(board).toHaveAccessibleDescription("e5, empty")
  await page.keyboard.press("ArrowDown")

  await page.keyboard.press("Enter")
  await expect(status).toHaveText("Black moved c3 to d4. White to move.")

  await expect(moveList(page)).toHaveCount(2, { timeout: 30_000 })
  await expect(status).toHaveText(
    /^White moved [a-i][1-9] to [a-i][1-9]\. Black to move\.$/,
  )
})

test("the arrow keys stop at the edge of the board", async ({ page }) => {
  await startOfflineGame(page, "Pass & Play")
  const board = page.getByRole("application", { name: /to move/i })

  await tabToBoard(page)
  for (let step = 0; step < 6; step++)
    await page.keyboard.press("ArrowLeft")
  await expect(board).toHaveAccessibleDescription("e1, empty")

  // The page does not scroll under the arrow keys while the board has focus.
  const scroll = await page.evaluate(() => window.scrollY)
  await page.keyboard.press("ArrowDown")
  await expect(board).toHaveAccessibleDescription("d1, empty")
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll)
})
