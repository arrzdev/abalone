import type { Locator, Page } from "@playwright/test"
import { startOfflineGame } from "./support/app"
import { moveList, playMove } from "./support/board"
import { expect, test } from "./support/test"

// The position bar is a picture, and its name is the picture in words: who is
// ahead and by how much, or that nobody is. The phone shows it under the board
// and a wide screen beside it; either way it is named the same, and it is read
// when a reader gets to it, not announced at every move.

const FRESH_GAME = "Position: even"
const ANY_READING = /^Position: (even|(Black|White) ahead by \d\.\d)$/

function positionBar(page: Page): Locator {
  return page.getByRole("img", { name: /^Position: / })
}

async function expectSilentPicture(bar: Locator): Promise<void> {
  await expect(bar).not.toHaveAttribute("title", /./)
  const liveAncestor = await bar.evaluate((element) =>
    element.closest("[aria-live], [role=status], [role=alert]"),
  )
  expect(liveAncestor).toBeNull()
}

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test("the bar under the board is named by the position", async ({
    page,
  }) => {
    await startOfflineGame(page, "vs Computer")
    const bar = positionBar(page)
    await expect(bar).toHaveAccessibleName(FRESH_GAME)
    await expectSilentPicture(bar)

    await playMove(page, "c5", "d5")
    await expect(moveList(page)).toHaveCount(2, { timeout: 30_000 })
    await expect(bar).toHaveAccessibleName(ANY_READING)
    await expectSilentPicture(bar)
  })
})

test.describe("beside the board", () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test("the column against the panel is named by the position", async ({
    page,
  }) => {
    await startOfflineGame(page, "vs Computer")
    const bar = positionBar(page)
    await expect(bar).toHaveCount(1)
    await expect(bar).toHaveAccessibleName(FRESH_GAME)
    await expectSilentPicture(bar)
  })
})
