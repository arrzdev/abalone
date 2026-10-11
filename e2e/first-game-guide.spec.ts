import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, startOfflineGame } from "./support/app"
import { playMove, selectSquare } from "./support/board"

// A first-time visitor's first offline game shows a three-step guide on the
// real board: pick marbles, choose a direction, push 6 off to win. Finishing or
// skipping it is saved, so it does not come back; "How to move" in Settings
// brings it back. Every test starts from a fresh browser context, so from empty
// storage.
//
// "After a reload" means opening /offline again: startOfflineGame loads the
// page fresh. Reloading first and then opening it makes two loads back to back,
// and on webkit the second one cancels the first page's route preloads. The
// router reloads a page whose route chunk failed to import, and that reload
// interrupts the load the test asked for.
//
// No service worker either: webkit lets the worker one test activates claim a
// page in another test's context. That page's own install then looks like an
// update, and the app reloads it in the middle of a game. The guide does not
// depend on the worker.
test.use({ serviceWorkers: "block" })

const GUIDE_KEY = "abalone.guide.v1"

/** The guide, a labelled region next to the board (not a dialog over it). */
function guide(page: Page, name = "How to move") {
  return page.getByRole("region", { name })
}

function savedFlag(page: Page): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), GUIDE_KEY)
}

/**
 * The guide is there to teach the board, so it must never sit on top of it: a
 * press meant for a marble would land on the guide instead.
 */
async function expectBoardUncovered(page: Page): Promise<void> {
  const panel = await guide(page).boundingBox()
  const board = await page
    .locator(".game-canvas-wrapper canvas")
    .filter({ visible: true })
    .first()
    .boundingBox()
  expect(panel).not.toBeNull()
  expect(board).not.toBeNull()
  if (panel === null || board === null) return
  const overlaps =
    panel.x < board.x + board.width &&
    board.x < panel.x + panel.width &&
    panel.y < board.y + board.height &&
    board.y < panel.y + panel.height
  expect(overlaps, "the guide overlaps the board").toBe(false)
}

async function openSettings(page: Page) {
  await page
    .getByRole("button", { name: "Settings" })
    .filter({ visible: true })
    .first()
    .click()
  return page.getByRole("dialog")
}

test("a first game walks through the three steps and the next game has no guide", async ({
  page,
}) => {
  await startOfflineGame(page, "vs Computer")

  await expect(guide(page)).toBeVisible()
  await expect(guide(page)).toContainText("Step 1 of 3")
  await expect(guide(page)).toContainText("Pick your marbles")
  await expect(
    guide(page).getByRole("button", { name: "Skip" }),
  ).toBeVisible()
  await expectBoardUncovered(page)

  // Step 1 moves on when the player picks a marble, on the board itself.
  await selectSquare(page, "c5")
  await expect(guide(page)).toContainText("Step 2 of 3")
  await expect(guide(page)).toContainText("Choose a direction")
  await expect(
    guide(page).getByRole("button", { name: "Skip" }),
  ).toBeVisible()

  // Step 2 moves on when the move lands.
  await playMove(page, "c5", "d5")
  await expect(guide(page)).toContainText("Step 3 of 3")
  await expect(guide(page)).toContainText("Push 6 off to win")
  await expect(
    guide(page).getByRole("button", { name: "Skip" }),
  ).toBeVisible()

  await guide(page).getByRole("button", { name: "Got it" }).click()
  await expect(guide(page)).toHaveCount(0)
  expect(await savedFlag(page)).toBe("done")

  // The second game, in the other mode, is not guided.
  await startOfflineGame(page, "Pass & Play")
  await selectSquare(page, "c5")
  await expect(guide(page)).toHaveCount(0)
})

test("a skipped guide stays away after a reload, and How to move in Settings brings it back", async ({
  page,
}) => {
  await startOfflineGame(page, "Pass & Play")
  await expect(guide(page)).toBeVisible()

  await guide(page).getByRole("button", { name: "Skip" }).click()
  await expect(guide(page)).toHaveCount(0)
  expect(await savedFlag(page)).toBe("done")

  await startOfflineGame(page, "vs Computer")
  // The board takes input by now, so the guide had its chance to show.
  await selectSquare(page, "c5")
  await expect(guide(page)).toHaveCount(0)

  // How to move closes Settings and shows the guide on the game in progress.
  const settings = await openSettings(page)
  await settings.getByRole("button", { name: "How to move" }).click()
  await expect(settings).toBeHidden()
  await expect(guide(page)).toBeVisible()
  await expect(guide(page)).toContainText("Step 1 of 3")
  expect(await savedFlag(page)).toBeNull()
})

test("the guide speaks the player's language", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("abalone_language", "de")
  })
  await openApp(page, "/offline")
  await page.getByRole("tab", { name: "gegen Computer" }).click()
  await page.getByRole("button", { name: "Spielen", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Aufgeben" }),
  ).toBeVisible()

  const panel = guide(page, "So ziehst du")
  await expect(panel).toBeVisible()
  await expect(panel).toContainText("Schritt 1 von 3")
  await expect(panel).toContainText("Wähle deine Kugeln")
  await expect(
    panel.getByRole("button", { name: "Überspringen" }),
  ).toBeVisible()
  await expect(panel).not.toContainText("Pick your marbles")
})
