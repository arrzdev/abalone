import type { Browser, Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, signUp, uniqueUsername } from "./support/app"
import { playMove } from "./support/board"

// The online hub shows every game as the same board card: whose move it is,
// when the last move was, when the game started and the score. It keeps
// itself up to date: a move made on the other device turns the card over on
// this one without a reload (TUD-974, contract in docs/online-hub.md).

// Shorter than the 15 s list poll, so only the realtime path can pass it.
const LIVE_MS = 8_000

/** Two signed-up players with one game open; the host holds black. */
async function openGame(browser: Browser) {
  const host = await browser.newContext()
  const guest = await browser.newContext()
  const hostPage = await host.newPage()
  const guestPage = await guest.newPage()

  const hostName = uniqueUsername("host")
  const guestName = uniqueUsername("guest")
  await signUp(hostPage, hostName)
  await signUp(guestPage, guestName)

  await openApp(hostPage, "/online")
  await hostPage
    .locator("main")
    .getByRole("link", { name: "Invite by username" })
    .click()
  const composer = hostPage.getByRole("dialog")
  await composer.getByLabel("Opponent", { exact: true }).fill(guestName)
  await composer.getByRole("radio", { name: "Play as black" }).click()
  await composer.getByRole("button", { name: "Send invite" }).click()
  await expect(composer).toBeHidden()

  await openApp(guestPage, "/online")
  await guestPage
    .getByRole("button", { name: "Accept" })
    .filter({ visible: true })
    .first()
    .click({ timeout: 30_000 })
  await expect(guestPage).toHaveURL(/\/online\/(?!history)[^/]+$/)

  return { host, guest, hostPage, guestPage, hostName, guestName }
}

/** The one card on the hub for the game against `opponent`. */
function cardFor(page: Page, opponent: string): Locator {
  return page
    .locator("main [data-game-card]")
    .filter({ visible: true })
    .filter({ hasText: opponent })
}

test("every game on the hub is a board card with turn, times and score", async ({
  browser,
}) => {
  test.slow(
    browser.browserType().name() === "webkit",
    "two WebKit pages paint in software",
  )
  const { host, guest, hostPage, guestPage, hostName, guestName } =
    await openGame(browser)

  // Black moves first, so the host's card says it is their move, in the
  // accent, and the guest's says it is the other player's.
  await openApp(hostPage, "/online")
  const hostCard = cardFor(hostPage, guestName)
  await expect(hostCard).toHaveCount(1, { timeout: 30_000 })
  await expect(hostCard).toHaveAttribute("data-turn", "mine")
  await expect(hostCard).toContainText("Your move")
  await expect(hostCard).toContainText("0–0")
  await expect(hostCard).toContainText("Started")
  await expect(hostCard).toContainText("No moves yet")
  await expect(hostCard.locator("svg")).toBeVisible()

  await openApp(guestPage, "/online")
  const guestCard = cardFor(guestPage, hostName)
  await expect(guestCard).toHaveCount(1, { timeout: 30_000 })
  await expect(guestCard).toHaveAttribute("data-turn", "theirs")
  await expect(guestCard).toContainText("Their move")
  await expect(guestCard.locator("svg")).toBeVisible()

  // No game on the hub is drawn any other way: each game link is a card.
  const gameLinks = guestPage
    .locator('main a[href^="/online/"]:not([href="/online/history"])')
    .filter({ visible: true })
  await expect(gameLinks).toHaveCount(
    await guestPage
      .locator("main [data-game-card]")
      .filter({ visible: true })
      .count(),
  )

  await host.close()
  await guest.close()
})

test("a move on the other device turns the card over without a reload", async ({
  browser,
}) => {
  test.slow(
    browser.browserType().name() === "webkit",
    "two WebKit pages paint in software",
  )
  const { host, guest, hostPage, guestPage, hostName } =
    await openGame(browser)

  // The guest waits on the hub while the host plays the first move.
  await openApp(guestPage, "/online")
  const guestCard = cardFor(guestPage, hostName)
  await expect(guestCard).toHaveAttribute("data-turn", "theirs", {
    timeout: 30_000,
  })

  await openApp(hostPage, "/online")
  await hostPage
    .locator('main a[href^="/online/"]:not([href="/online/history"])')
    .filter({ visible: true })
    .first()
    .click({ timeout: 30_000 })
  await playMove(hostPage, "c5", "d5")

  await expect(guestCard).toHaveAttribute("data-turn", "mine", {
    timeout: LIVE_MS,
  })
  await expect(guestCard).toContainText("Your move")
  await expect(guestCard).toContainText("Last move")
  await expect(guestCard).not.toContainText("No moves yet")

  await host.close()
  await guest.close()
})
