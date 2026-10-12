import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, startOfflineGame } from "./support/app"
import {
  expectMarble,
  marbleOn,
  moveList,
  playMove,
  selectedSquares,
  selectSquare,
  tapSquare,
} from "./support/board"

// Against the computer: a legal move is played and answered, and the board
// refuses moves the rules do not allow.
test("a game against a bot takes a legal move, refuses an illegal one, and the bot replies", async ({
  page,
}) => {
  await startOfflineGame(page, "vs Computer")

  // Black moves first, and the player is black by default.
  expect(await marbleOn(page, "c5")).toBe("black")

  // Two squares in one step is not a move: the marble stays where it was.
  await selectSquare(page, "c5")
  await tapSquare(page, "e5")
  await expect.poll(() => selectedSquares(page)).toEqual([])
  await expectMarble(page, "c5", "black")
  await expectMarble(page, "e5", null)

  // Nor is moving the opponent's marble.
  await tapSquare(page, "g5")
  await tapSquare(page, "f5")
  await expectMarble(page, "g5", "white")
  await expectMarble(page, "f5", null)
  await expect(moveList(page)).toHaveCount(0)

  await playMove(page, "c5", "d5")
  await expect(moveList(page).first()).toHaveText("c5d5")

  // The bot answers with a move of its own.
  await expect(moveList(page)).toHaveCount(2, { timeout: 30_000 })
})

type GameEvent = {
  gameRef: string
  kind: "start" | "finish"
  mode: string
  botLevel?: number | null
  result?: string
  moveCount?: number
}

/**
 * Every game event the page sends from now on, read off the wire. The game
 * sends them as beacons, which no response ever answers, so the request itself
 * is the only place to see one.
 */
function recordGameEvents(page: Page): GameEvent[] {
  const events: GameEvent[] = []
  page.on("request", (request) => {
    if (request.method() !== "POST") return
    if (!request.url().endsWith("/api/v1/events/game")) return
    events.push(JSON.parse(request.postData() ?? "{}") as GameEvent)
  })
  return events
}

/** Plays one move, waits for the bot's answer, and resigns. */
async function playToTheEnd(page: Page): Promise<void> {
  await playMove(page, "c5", "d5")
  await expect(moveList(page)).toHaveCount(2, { timeout: 30_000 })

  await page.getByRole("button", { name: "Resign" }).click()
  // Not by accessible name: the phone's sheet does not label itself.
  const confirm = page
    .getByRole("dialog")
    .filter({ hasText: "Resign the game?" })
  await confirm.getByRole("button", { name: "Resign" }).click()

  await expect(
    page.getByRole("dialog").getByText("by resignation").first(),
  ).toBeVisible()
}

// Games are counted: one start and one finish per game, nothing that names the
// player, and nothing more when they leave after it ended.
test("a bot game played to the end is counted once as started and once as finished", async ({
  page,
}) => {
  const events = recordGameEvents(page)

  await startOfflineGame(page, "vs Computer")
  await playToTheEnd(page)

  await expect.poll(() => events.length).toBe(2)
  const [started, finished] = events
  // A test drives this browser, so the backend keeps neither event.
  expect(started).toMatchObject({
    kind: "start",
    mode: "ai",
    automated: true,
  })
  expect(finished).toMatchObject({ automated: true })
  expect(started.botLevel).toEqual(expect.any(Number))
  expect(finished).toMatchObject({
    kind: "finish",
    mode: "ai",
    gameRef: started.gameRef,
    botLevel: started.botLevel,
    result: "loss",
    moveCount: 2,
  })

  // Leaving a game that already ended is not abandoning it.
  await openApp(page, "/")
  await page.waitForTimeout(500)
  expect(events).toHaveLength(2)
})

// Counting is never in the way: with no network at all the game plays to its
// end exactly as it does online.
test("a bot game plays to the end with the network offline", async ({
  page,
  context,
}) => {
  const errors: Error[] = []
  page.on("pageerror", (error) => errors.push(error))

  await startOfflineGame(page, "vs Computer")
  await context.setOffline(true)

  await playToTheEnd(page)

  await context.setOffline(false)
  expect(errors).toEqual([])
})
