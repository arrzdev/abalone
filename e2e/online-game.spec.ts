import { expect, test } from "@playwright/test"
import { startOnlineGame } from "./support/app"
import { expectMarble, playMove } from "./support/board"

// Online play between two players in two browsers: each move reaches the other
// board through the backend's game room (Durable Object) without a reload.
test("an invited player joins and both players see each other's moves", async ({
  browser,
}) => {
  // Two phone browsers, two sign-ups and a live game in one test. WebKit has no
  // GPU on a Linux runner and paints in software, so on a two-core machine this
  // runs past the default 60s while every step stays inside its own timeout
  // (TUD-964). The browser itself is asked: the project's device sets WebKit,
  // and the `browserName` option does not follow it.
  test.slow(
    browser.browserType().name() === "webkit",
    "two WebKit pages paint in software",
  )

  const { host, guest, hostPage, guestPage } =
    await startOnlineGame(browser)

  await playMove(hostPage, "c5", "d5")
  await expectMarble(guestPage, "d5", "black")
  await expectMarble(guestPage, "c5", null)

  await playMove(guestPage, "g5", "f5")
  await expectMarble(hostPage, "f5", "white")
  await expectMarble(hostPage, "g5", null)

  await host.close()
  await guest.close()
})

// A finished game ends the same way for both players, and the host's history
// keeps it.
test("an online game ended by resignation shows the result to both players and lands in history", async ({
  browser,
}) => {
  // Same WebKit-sized budget as the test above (TUD-964).
  test.slow(
    browser.browserType().name() === "webkit",
    "two WebKit pages paint in software",
  )

  const { host, guest, hostPage, guestPage, guestName } =
    await startOnlineGame(browser)

  await playMove(hostPage, "c5", "d5")
  await expectMarble(guestPage, "d5", "black")
  await playMove(guestPage, "g5", "f5")
  await expectMarble(hostPage, "f5", "white")

  await guestPage.getByRole("button", { name: "Resign" }).click()
  const confirm = guestPage
    .getByRole("dialog")
    .filter({ hasText: "Resign the game?" })
  await confirm.getByRole("button", { name: "Resign" }).click()

  // The result sheet names the outcome and the reason in separate lines.
  const guestResult = guestPage
    .getByRole("dialog")
    .filter({ hasText: "Game over" })
  await expect(guestResult.getByText("You lost")).toBeVisible()
  await expect(guestResult.getByText("by resignation")).toBeVisible()
  const hostResult = hostPage
    .getByRole("dialog")
    .filter({ hasText: "Game over" })
  await expect(hostResult.getByText("You won")).toBeVisible({
    timeout: 30_000,
  })
  await expect(hostResult.getByText("by resignation")).toBeVisible()

  await openApp(hostPage, "/online/history")
  await expect(hostPage.getByRole("main")).toContainText(guestName)
  await expect(hostPage.getByRole("main")).not.toContainText(
    "No finished games yet.",
  )

  await host.close()
  await guest.close()
})
