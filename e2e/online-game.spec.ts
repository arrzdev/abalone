import { expect, test } from "@playwright/test"
import { openApp, signUp, uniqueUsername } from "./support/app"
import { expectMarble, playMove } from "./support/board"

// Online play between two players in two browsers: one invites the other by
// username, the other accepts, and each move reaches the other board through
// the backend's game room (Durable Object) without a reload.
test("an invited player joins and both players see each other's moves", async ({
  browser,
}) => {
  const host = await browser.newContext()
  const guest = await browser.newContext()
  const hostPage = await host.newPage()
  const guestPage = await guest.newPage()

  const hostName = uniqueUsername("host")
  const guestName = uniqueUsername("guest")
  await signUp(hostPage, hostName)
  await signUp(guestPage, guestName)

  // The host invites the guest and takes black, so the host moves first.
  await openApp(hostPage, "/online")
  await hostPage
    .getByRole("button", { name: "New invite" })
    .filter({ visible: true })
    .first()
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

  await playMove(hostPage, "c5", "d5")
  await expectMarble(guestPage, "d5", "black")
  await expectMarble(guestPage, "c5", null)

  await playMove(guestPage, "g5", "f5")
  await expectMarble(hostPage, "f5", "white")
  await expectMarble(hostPage, "g5", null)

  await host.close()
  await guest.close()
})
