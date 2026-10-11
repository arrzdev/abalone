import { expect, test } from "@playwright/test"
import { startOfflineGame } from "./support/app"
import { moveList, playMove } from "./support/board"

// Pass & play: both sides move on one device, and the side to move can resign,
// which ends the game for the other.
test("a pass and play game takes moves from both sides and ends on a resignation", async ({
  page,
}) => {
  await startOfflineGame(page, "Pass & Play")

  await playMove(page, "c5", "d5")
  await playMove(page, "g5", "f5")
  await expect(moveList(page)).toHaveText(["c5d5", "g5f5"])

  // Black is to move again, so black is the side that gives up.
  await page.getByRole("button", { name: "Resign" }).click()
  // Not by accessible name: the phone's sheet does not label itself.
  const confirm = page
    .getByRole("dialog")
    .filter({ hasText: "Resign the game?" })
  await confirm.getByRole("button", { name: "Resign" }).click()

  await expect(
    page.getByRole("dialog").getByText("White wins").first(),
  ).toBeVisible()
})

// The board is a canvas, so a screen reader hears only what its name says: how
// many marbles each side has, whose turn it is, and the move just played.
test("the board names the position and the last move after every move", async ({
  page,
}) => {
  await startOfflineGame(page, "Pass & Play")

  await playMove(page, "c5", "d5")
  const board = page.getByRole("img", { name: /last move/i })
  await expect(board).toHaveAccessibleName(
    "Black 14 marbles, White 14 marbles. White to move. Last move: c5d5.",
  )

  await playMove(page, "g5", "f5")
  await expect(board).toHaveAccessibleName(
    "Black 14 marbles, White 14 marbles. Black to move. Last move: g5f5.",
  )
})
