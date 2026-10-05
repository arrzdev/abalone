import { expect, test } from "@playwright/test"
import { startOfflineGame } from "./support/app"
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
