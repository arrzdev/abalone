import type { Page } from "@playwright/test"
import { startOfflineGame } from "./support/app"
import { moveList, playMove } from "./support/board"
import { expect, test } from "./support/test"

// Rematch starts the next game with the keyboard where the player left it: on
// the board, at its centre, and the board says nothing about the cell it was on
// in the game before. It is the "play again" step, so a keyboard or switch user
// who lands on the page's top has to Tab through the header to carry on.

test.use({ viewport: { width: 375, height: 667 } })

//what a cell is called out as, e.g. "a4, white marble" or "e5, empty"
const CELL_TEXT = /\b(empty|marble)\b/

/** Plays one move, then resigns from the sheet: the quickest end to a game. */
async function resignTheGame(
  page: Page,
  mode: "vs Computer" | "Pass & Play",
): Promise<void> {
  await playMove(page, "c5", "d5")
  if (mode === "vs Computer")
    await expect(moveList(page)).toHaveCount(2, { timeout: 30_000 })
  await page.getByRole("button", { name: "Resign" }).click()
  await page
    .getByRole("dialog", { name: "Resign the game?" })
    .getByRole("button", { name: "Resign" })
    .click()
  await expect(
    page.getByRole("dialog").getByText("by resignation").first(),
  ).toBeVisible()
}

/**
 * Writes down every text a live region takes from here on, as a screen reader
 * would be handed it. A region that is mounted with its text counts too.
 */
async function recordAnnouncements(page: Page): Promise<void> {
  await page.evaluate(() => {
    const spoken: string[] = []
    Object.assign(window, { spoken })
    const regionOf = (node: Node): Element | null => {
      const element = node instanceof Element ? node : node.parentElement
      return (
        element?.closest(
          "[aria-live]:not([aria-live=off]), [role=status], [role=alert]",
        ) ?? null
      )
    }
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of [mutation.target, ...mutation.addedNodes]) {
          const text = regionOf(node)?.textContent?.trim()
          if (text && text !== spoken.at(-1)) spoken.push(text)
        }
      }
    }).observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    })
  })
}

function announcements(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as { spoken: string[] }).spoken,
  )
}

async function expectFocusOnTheCentreOfTheBoard(
  page: Page,
): Promise<void> {
  const board = page.getByRole("application", { name: /to move/i })
  await expect(board).toBeFocused()
  await expect(board).toHaveAccessibleDescription("e5, empty")
  // Nothing was read out of the board's cells, old or new.
  await page.waitForTimeout(500)
  expect(await announcements(page)).not.toContainEqual(
    expect.stringMatching(CELL_TEXT),
  )
}

for (const mode of ["Pass & Play", "vs Computer"] as const) {
  test.describe(mode, () => {
    test("Rematch from the Game over sheet leaves focus on the board", async ({
      page,
    }) => {
      await startOfflineGame(page, mode)
      await resignTheGame(page, mode)
      const rematch = page
        .getByRole("dialog")
        .getByRole("button", { name: "Rematch" })
      await rematch.focus()
      await expect(rematch).toBeFocused()

      await recordAnnouncements(page)
      await page.keyboard.press("Enter")

      await expect(page.getByRole("dialog")).toHaveCount(0)
      await expectFocusOnTheCentreOfTheBoard(page)
    })

    test("Rematch after Escape leaves focus on the board", async ({
      page,
    }) => {
      await startOfflineGame(page, mode)
      await resignTheGame(page, mode)
      await page.keyboard.press("Escape")
      await expect(page.getByRole("dialog")).toHaveCount(0)
      const rematch = page.locator("[data-postgame-rematch]")
      await expect(rematch).toBeFocused()

      await recordAnnouncements(page)
      await page.keyboard.press("Enter")

      await expectFocusOnTheCentreOfTheBoard(page)
    })
  })
}

test("the cell the keyboard was on is not kept for the next game", async ({
  page,
}) => {
  await startOfflineGame(page, "Pass & Play")
  const board = page.getByRole("application", { name: /to move/i })
  await board.focus()
  // e5 → d4 → c3: a cell with a marble on it, away from the centre.
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowDown")
  await expect(board).toHaveAccessibleDescription("c3, black marble")

  await page.getByRole("button", { name: "Resign" }).click()
  await page
    .getByRole("dialog", { name: "Resign the game?" })
    .getByRole("button", { name: "Resign" })
    .click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Rematch" })
    .press("Enter")

  await expect(board).toBeFocused()
  await expect(board).toHaveAccessibleDescription("e5, empty")
})

test.describe("on a desktop, where the Game over sheet is a dialog", () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test("Rematch leaves focus on the board", async ({ page }) => {
    await startOfflineGame(page, "Pass & Play")
    await resignTheGame(page, "Pass & Play")
    const rematch = page
      .getByRole("dialog")
      .getByRole("button", { name: "Rematch" })
    await rematch.focus()

    await recordAnnouncements(page)
    await page.keyboard.press("Enter")

    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expectFocusOnTheCentreOfTheBoard(page)
  })
})
