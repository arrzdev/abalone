import type { Locator, Page } from "@playwright/test"
import { startOfflineGame } from "./support/app"
import { moveList } from "./support/board"
import { expectNoClippedText } from "./support/layout"
import { expect, test } from "./support/test"

// A phone held sideways has the panel beside the board, and the panel is
// taller than the screen there. The score and the bot's line sit at the top of
// it and stay in view: reaching a control at the foot of the panel with the Tab
// key used to scroll the whole panel, and the card went off its top edge, so
// nobody could read the score while playing.
//
// No service worker: see first-game-guide.spec.ts.
test.use({
  serviceWorkers: "block",
  viewport: { width: 667, height: 375 },
})

// Enough to reach the board from the top of the game screen.
const MAX_TAB_STOPS = 30

/** Presses Tab until the board has focus. The panel comes before it. */
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

/** How far the score card pokes out of the panel's box, top and bottom. */
function scoreCardOverhang(
  panel: Locator,
): Promise<{ top: number; bottom: number }> {
  return panel.evaluate((aside) => {
    const isClear = (colour: string) =>
      colour === "transparent" || /,\s*0\)$/.test(colour)
    // The first box in the panel with a fill of its own is the score card.
    const card = Array.from(aside.querySelectorAll("*")).find(
      (element) => !isClear(getComputedStyle(element).backgroundColor),
    )
    const panelBox = aside.getBoundingClientRect()
    const cardBox = card?.getBoundingClientRect()
    return {
      top: cardBox ? panelBox.top - cardBox.top : Number.NaN,
      bottom: cardBox ? cardBox.bottom - panelBox.bottom : Number.NaN,
    }
  })
}

test("at 667×375 the score card stays inside the panel after a move played by keyboard", async ({
  page,
}) => {
  await startOfflineGame(page, "vs Computer")
  const panel = page.locator("aside").filter({ visible: true }).first()
  const board = page.getByRole("application", { name: /to move/i })

  await tabToBoard(page)
  // e5 → d4 → c3 → c4 → c5, pick it up, then d6 → d5 and put it down.
  for (const key of [
    "ArrowDown",
    "ArrowDown",
    "ArrowRight",
    "ArrowRight",
    "Space",
    "ArrowUp",
    "ArrowLeft",
    "Enter",
  ])
    await page.keyboard.press(key)
  await expect(moveList(page).first()).toHaveText("c5d5")

  // Two frames on, with the computer's reply drawn, whatever it scrolled.
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  )
  await expect(board).toBeFocused()
  await expect
    .poll(
      async () => {
        const { top, bottom } = await scoreCardOverhang(panel)
        return top <= 0.5 && bottom <= 0.5
      },
      {
        message: `the score card inside the panel's box: ${JSON.stringify(await scoreCardOverhang(panel))}`,
        intervals: [100],
      },
    )
    .toBe(true)
})

// The panel scrolls now, and the Game over sheet must not: it still fits the
// short screen whole.
test("at 667×375 the Game over sheet fits without scrolling", async ({
  page,
}) => {
  await startOfflineGame(page, "Pass & Play")
  await page.getByRole("button", { name: "Resign" }).click()
  const confirm = page
    .getByRole("dialog")
    .filter({ hasText: "Resign the game?" })
  await confirm.getByRole("button", { name: "Resign" }).click()

  const sheet = page.getByRole("dialog").filter({ hasText: "White wins" })
  await expect(sheet).toBeVisible()
  await page.waitForFunction(() => document.getAnimations().length === 0)
  await expectNoClippedText(sheet)
  // The dialog's own box runs on past the screen (a drawer keeps room under
  // itself for the keyboard), so what has to be on screen is what is in it.
  const lowest = await sheet.evaluate((dialog) =>
    Math.max(
      ...Array.from(dialog.querySelectorAll("button")).map(
        (button) => button.getBoundingClientRect().bottom,
      ),
    ),
  )
  expect(lowest, "the lowest button's bottom edge").toBeLessThanOrEqual(
    375,
  )
})
