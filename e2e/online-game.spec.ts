import type { Browser, BrowserContext, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, signUp, uniqueUsername } from "./support/app"
import { expectMarble, playMove } from "./support/board"

// Online play between two players in two browsers: one invites the other by
// username, the other accepts, and each move reaches the other board through
// the backend's game room (Durable Object) without a reload.
type OnlinePlayers = {
  host: BrowserContext
  guest: BrowserContext
  hostPage: Page
  guestPage: Page
  guestName: string
}

/** Signs two players up, invites and accepts, and opens the game on both pages. */
async function startOnlineGame(browser: Browser): Promise<OnlinePlayers> {
  const host = await browser.newContext()
  const guest = await browser.newContext()
  const hostPage = await host.newPage()
  const guestPage = await guest.newPage()

  const hostName = uniqueUsername("host")
  const guestName = uniqueUsername("guest")
  await signUp(hostPage, hostName)
  await signUp(guestPage, guestName)

  // The host invites the guest and takes black, so the host moves first.
  // A new account's page is empty, so invite by username is the text link
  // under the link and bot buttons (TUD-850).
  await openApp(hostPage, "/online")
  await hostPage
    .locator("main")
    .getByRole("link", { name: "Invite by username" })
    .click()
  const composer = hostPage.getByRole("dialog")
  await composer.getByLabel("Who are you playing?").fill(guestName)
  await composer.getByRole("radio", { name: "Play as black" }).click()
  await composer.getByRole("button", { name: "Send invite" }).click()
  await expect(composer).toBeHidden()

  // The guest accepts, which opens the game.
  await openApp(guestPage, "/online")
  await guestPage
    .getByRole("button", { name: "Accept" })
    .filter({ visible: true })
    .first()
    .click({ timeout: 30_000 })
  await expect(guestPage).toHaveURL(/\/online\/(?!history)[^/]+$/)

  // The host's list picks the new game up and opens it.
  await hostPage
    .locator('main a[href^="/online/"]:not([href="/online/history"])')
    .filter({ visible: true })
    .first()
    .click({ timeout: 30_000 })
  await expect(hostPage).toHaveURL(guestPage.url())

  return { host, guest, hostPage, guestPage, guestName }
}

test("an invited player joins and both players see each other's moves", async ({
  browser,
}) => {
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

  await expect(
    guestPage.getByText("You lost by resignation"),
  ).toBeVisible()
  await expect(hostPage.getByText("You won by resignation")).toBeVisible({
    timeout: 30_000,
  })

  await openApp(hostPage, "/online/history")
  await expect(hostPage.getByRole("main")).toContainText(guestName)
  await expect(hostPage.getByRole("main")).not.toContainText(
    "No finished games yet.",
  )

  await host.close()
  await guest.close()
})
