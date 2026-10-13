import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, startOfflineGame } from "./support/app"
import { playMove, selectedSquares, selectSquare } from "./support/board"

// A first-time visitor's first offline game shows a three-step guide on the
// real board: pick marbles, choose a direction, push 6 off to win. Finishing or
// skipping it is saved on the device, so it does not come back; the "?" in the
// game's side bar brings it back. Every test starts from a fresh browser context, so from empty
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

/** Whether each game start the page sends from now on says it was guided. */
function recordGuidedStarts(page: Page): unknown[] {
  const guided: unknown[] = []
  page.on("request", (request) => {
    if (request.method() !== "POST") return
    if (!request.url().endsWith("/api/v1/events/game")) return
    const event = JSON.parse(request.postData() ?? "{}") as {
      kind?: string
      guided?: unknown
    }
    if (event.kind === "start") guided.push(event.guided)
  })
  return guided
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

test("a skipped guide stays away after a reload, and the ? beside the board brings it back", async ({
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

  // Settings has no way back to the guide any more: the ? is the only one.
  const settings = await openSettings(page)
  await expect(settings.getByText("How to move")).toHaveCount(0)
  await page.keyboard.press("Escape")
  await expect(settings).toBeHidden()

  // The ? in the game's side bar shows the guide on the game in progress.
  const help = page
    .getByRole("button", { name: "How to move" })
    .filter({ visible: true })
  await expect(help).toHaveText("?")
  await help.click()
  await expect(guide(page)).toBeVisible()
  await expect(guide(page)).toContainText("Step 1 of 3")
  expect(await savedFlag(page)).toBeNull()
})

test("the guide speaks the player's language", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("abalone_language", "de")
  })
  await openApp(page, "/offline")
  await page.getByRole("tab", { name: "Gegen Computer" }).click()
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

// The game start event says whether the guide was showing, so first games with
// the guide can be compared with the games played before it.
test("the first game is counted as guided and the game after the guide is not", async ({
  page,
}) => {
  const guidedStarts = recordGuidedStarts(page)

  await startOfflineGame(page, "vs Computer")
  await expect(guide(page)).toBeVisible()
  await expect.poll(() => guidedStarts).toEqual([true])

  await guide(page).getByRole("button", { name: "Skip" }).click()
  await expect(guide(page)).toHaveCount(0)

  await page.reload()
  await startOfflineGame(page, "Pass & Play")
  await expect.poll(() => guidedStarts).toEqual([true, false])
})

// The board is the action on steps 1 and 2, so nothing in the guide may look
// like it (TUD-852): Next is a text button, still a 44×44 target, and the board
// move still moves the guide on.
test("on steps 1 and 2 the guide has no filled button", async ({
  page,
}) => {
  await startOfflineGame(page, "vs Computer")
  await expect(guide(page)).toContainText("Step 1 of 3")
  await expectTextButtonsOnly(page)

  await selectSquare(page, "c5")
  await expect(guide(page)).toContainText("Step 2 of 3")
  await expectTextButtonsOnly(page)
})

// Step 2 talks about the spaces a selection highlights. Reached with Next,
// nothing is highlighted, so Next on step 1 passes it.
test("Next on step 1 never shows step 2 without a selection", async ({
  page,
}) => {
  await startOfflineGame(page, "vs Computer")
  await expect(guide(page)).toContainText("Step 1 of 3")

  await guide(page).getByRole("button", { name: "Next" }).click()
  await expect(guide(page)).toContainText("Step 3 of 3")
  await expect(guide(page)).not.toContainText("highlighted")
  expect(await selectedSquares(page)).toEqual([])
})

// On a wide screen the guide sits by the marbles it talks about rather than at
// the top of the panel, ~800 px away. It stays in the page, never over the board.
test("on a desktop the guide sits near the starting marbles", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "a desktop layout")
  await page.setViewportSize({ width: 1440, height: 900 })
  await startOfflineGame(page, "vs Computer")
  await expect(guide(page)).toContainText("Step 1 of 3")

  const card = await guide(page).boundingBox()
  const marble = await page.evaluate(
    () =>
      (
        window as Window & {
          __abaloneBoard?: {
            point: (square: string) => DOMPointInit | null
          }
        }
      ).__abaloneBoard?.point("c3") ?? null,
  )
  expect(card).not.toBeNull()
  expect(marble).not.toBeNull()
  if (card === null || marble === null) return
  const y = marble.y ?? 0
  const distance = Math.max(0, card.y - y, y - (card.y + card.height))
  expect(distance, "px from the guide card to c3").toBeLessThanOrEqual(320)
  await expectBoardUncovered(page)
})

/**
 * Every button in the guide draws no fill of its own (a hover tint is fine), and
 * Next is still a 44×44 target.
 */
async function expectTextButtonsOnly(page: Page): Promise<void> {
  await page.mouse.move(0, 0)
  const filled = await guide(page)
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons
        .filter((button) => {
          const fill = getComputedStyle(button).backgroundColor
          return fill !== "transparent" && !fill.endsWith(", 0)")
        })
        .map((button) => button.textContent?.trim()),
    )
  expect(filled, "filled buttons in the guide").toEqual([])

  const next = await guide(page)
    .getByRole("button", { name: "Next" })
    .boundingBox()
  expect(next).not.toBeNull()
  if (next === null) return
  expect(next.width).toBeGreaterThanOrEqual(43.5)
  expect(next.height).toBeGreaterThanOrEqual(43.5)
}
