import type { Page } from "@playwright/test"
import { openApp, startOfflineGame } from "./support/app"
import { expectMarble, moveList, playMove } from "./support/board"
import { waitForRest } from "./support/layout"
import { expect, test } from "./support/test"

// An offline game survives the page going away: iOS Safari reloads a tab it
// discarded in the background, and the player comes back to the same board,
// silently. A finished game never comes back as a live one.

test.use({ viewport: { width: 375, height: 667 } })

const SAVE_KEY = "abalone.offlineGame.v1"

/**
 * From the next page load on, notes whether the setup screen was ever on
 * screen: checked on every frame and every DOM change for the first seconds,
 * so a setup panel that paints for one frame before the game replaces it is
 * caught.
 */
async function watchForSetupScreen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const flags = window as unknown as { __setupSeen?: boolean }
    flags.__setupSeen = false
    const visible = (element: Element) =>
      element instanceof HTMLElement &&
      element.checkVisibility({ opacityProperty: true })
    const check = () => {
      const play = [...document.querySelectorAll("button")].some(
        (button) =>
          button.textContent?.trim() === "Play" && visible(button),
      )
      const tabs = [...document.querySelectorAll('[role="tab"]')].some(
        (tab) => tab.textContent?.includes("vs Computer") && visible(tab),
      )
      if (play || tabs) flags.__setupSeen = true
    }
    new MutationObserver(check).observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
    })
    const until = performance.now() + 5_000
    const frame = () => {
      check()
      if (performance.now() < until) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })
}

function setupScreenSeen(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      (window as unknown as { __setupSeen?: boolean }).__setupSeen ===
      true,
  )
}

/** The page loaded again at the URL it is on, as a discarded tab comes back. */
async function reload(page: Page): Promise<void> {
  await openApp(page, page.url())
}

/**
 * Paints the page afresh. A page that has been played on carries the pixels of
 * its earlier paints: a seat card that changed turn leaves one or two levels of
 * antialiasing on a rounded corner that a page loaded straight into the same
 * state does not have. Screenshots are only comparable between fresh paints.
 */
async function repaint(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.body.style.willChange = "transform"
  })
  await page.waitForTimeout(300)
  await page.evaluate(() => {
    document.body.style.willChange = ""
  })
  await page.waitForTimeout(500)
}

function board(page: Page) {
  return page.getByRole("application")
}

test("a game against the computer comes back after a reload, exactly as it was", async ({
  page,
}) => {
  await startOfflineGame(page, "vs Computer")
  await playMove(page, "c5", "d5")
  await expect(moveList(page)).toHaveCount(2, { timeout: 30_000 })
  await playMove(page, "c3", "d3")
  await expect(moveList(page)).toHaveCount(4, { timeout: 30_000 })

  const main = page.locator("main")
  await waitForRest(main)
  const history = await moveList(page).allTextContents()
  const boardName = await board(page).getAttribute("aria-label")
  const boardBefore = await board(page).screenshot({
    animations: "disabled",
  })

  await watchForSetupScreen(page)
  await reload(page)

  await expect(moveList(page)).toHaveText(history)
  await expect(page.getByRole("button", { name: "Resign" })).toBeVisible()
  await expect(board(page)).toHaveAttribute("aria-label", boardName ?? "")
  await expectMarble(page, "d5", "black")
  await expectMarble(page, "d3", "black")
  await expectMarble(page, "c5", null)
  await expectMarble(page, "c3", null)
  expect(
    await setupScreenSeen(page),
    "setup screen painted on restore",
  ).toBe(false)

  await waitForRest(main)
  const boardAfter = await board(page).screenshot({
    animations: "disabled",
  })
  expect(boardAfter.equals(boardBefore), "board pixels after reload").toBe(
    true,
  )

  // Undo works on the restored game as it did before: it takes back the
  // player's move and the bot's answer.
  await page.getByRole("button", { name: "Undo" }).click()
  await expect(moveList(page)).toHaveText(history.slice(0, 2))
  await expectMarble(page, "c3", "black")
})

test("when the page went away on the bot's turn, the bot plays after the restore", async ({
  page,
}) => {
  await startOfflineGame(page, "vs Computer")
  await playMove(page, "c5", "d5")
  // Straight away: the bot waits a moment before it answers.
  await reload(page)

  await expect(moveList(page).first()).toHaveText("c5d5")
  await expect(moveList(page)).toHaveCount(2, { timeout: 30_000 })
})

test("a Pass and Play game comes back on a cold reopen of /offline, pixel for pixel", async ({
  page,
}) => {
  await startOfflineGame(page, "Pass & Play")
  await playMove(page, "c5", "d5")
  await playMove(page, "g5", "f5")
  await expect(moveList(page)).toHaveText(["c5d5", "g5f5"])

  const main = page.locator("main")
  await waitForRest(main)
  const boardName = await board(page).getAttribute("aria-label")
  await repaint(page)
  const before = await page.screenshot({ animations: "disabled" })

  await watchForSetupScreen(page)
  // No ?mode= in the address: the saved game says which game it was.
  await openApp(page, "/offline")

  await expect(moveList(page)).toHaveText(["c5d5", "g5f5"])
  await expect(board(page)).toHaveAttribute("aria-label", boardName ?? "")
  expect(
    await setupScreenSeen(page),
    "setup screen painted on restore",
  ).toBe(false)
  await waitForRest(main)
  const after = await page.screenshot({ animations: "disabled" })
  expect(after.equals(before), "screen pixels after reopen").toBe(true)

  // Still black to move, on the board as it was.
  await playMove(page, "c4", "d4")
  await expect(moveList(page)).toHaveText(["c5d5", "g5f5", "c4d4"])
})

test("a finished game never comes back as a live board", async ({
  page,
}) => {
  await startOfflineGame(page, "Pass & Play")
  await playMove(page, "c5", "d5")
  await playMove(page, "g5", "f5")

  await page.getByRole("button", { name: "Resign" }).click()
  const confirm = page
    .getByRole("dialog")
    .filter({ hasText: "Resign the game?" })
  await confirm.getByRole("button", { name: "Resign" }).click()
  await expect(
    page.getByRole("dialog").getByText("White wins").first(),
  ).toBeVisible()

  await reload(page)

  // It opens on the setup screen.
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Resign" })).toHaveCount(0)
  await expect(moveList(page)).toHaveCount(0)
  expect(
    await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY),
  ).toBe(null)
})

test("an unreadable save opens the setup screen with no error", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.addInitScript((key) => {
    localStorage.setItem(key, '{"state":{"black":[')
  }, SAVE_KEY)

  await openApp(page, "/offline")

  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible()
  await expect(moveList(page)).toHaveCount(0)
  expect(errors).toEqual([])
})
