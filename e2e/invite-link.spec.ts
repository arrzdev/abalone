import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, PASSWORD, signUp, uniqueUsername } from "./support/app"
import { expectMarble, playMove } from "./support/board"
import { expireInviteLink } from "./support/database"

// Invite by link: a signed-in player makes a link, sends it anywhere, and
// whoever opens it first plays them. The friend does not need an account yet;
// signing up from the link lands them back on it.

/**
 * Makes an invite link from the hub's composer, playing black, and hands back
 * the URL the app shows for copying or sharing.
 */
async function createInviteLink(page: Page): Promise<string> {
  await openApp(page, "/online")
  await page
    .getByRole("button", { name: "New invite" })
    .filter({ visible: true })
    .first()
    .click()
  const composer = page.getByRole("dialog")
  await composer.getByRole("radio", { name: "Play as black" }).click()
  await composer
    .getByRole("button", { name: "Invite with a link" })
    .click()
  const field = composer.getByLabel("Invite link")
  await expect(field).toHaveValue(/\/invite\/[A-Za-z0-9_-]{43}$/)
  return field.inputValue()
}

test("a friend signs up from an invite link and both see each other's moves", async ({
  browser,
}) => {
  const host = await browser.newContext()
  const guest = await browser.newContext()
  const hostPage = await host.newPage()
  const guestPage = await guest.newPage()

  const hostName = uniqueUsername("host")
  const guestName = uniqueUsername("guest")
  await signUp(hostPage, hostName)
  const link = await createInviteLink(hostPage)

  // The guest has no account. The link says who sent it and offers both doors.
  await openApp(guestPage, new URL(link).pathname)
  await expect(
    guestPage.getByRole("heading", {
      name: `${hostName} invited you to a game of Abalone`,
    }),
  ).toBeVisible()
  await guestPage.getByRole("button", { name: "Create account" }).click()
  const form = guestPage.getByRole("dialog")
  await form.getByRole("tab", { name: "Create account" }).click()
  await form.getByLabel("Username").fill(guestName)
  await form.getByLabel("Password", { exact: true }).fill(PASSWORD)
  await form.getByRole("button", { name: "Create account" }).click()
  await expect(form).toBeHidden({ timeout: 30_000 })

  // Signing up kept the link: the guest is back on it, signed in, and accepts.
  await expect(guestPage).toHaveURL(new URL(link).pathname)
  await guestPage.getByRole("button", { name: "Accept and play" }).click()
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

test("a link that was already used says so and offers the way home", async ({
  browser,
}) => {
  const host = await browser.newContext()
  const guest = await browser.newContext()
  const latecomer = await browser.newContext()
  const hostPage = await host.newPage()
  const guestPage = await guest.newPage()
  const latecomerPage = await latecomer.newPage()

  const hostName = uniqueUsername("host")
  await signUp(hostPage, hostName)
  await signUp(guestPage, uniqueUsername("guest"))
  const link = await createInviteLink(hostPage)

  await openApp(guestPage, new URL(link).pathname)
  await guestPage.getByRole("button", { name: "Accept and play" }).click()
  await expect(guestPage).toHaveURL(/\/online\/(?!history)[^/]+$/)

  // Anyone after the first finds it spent, signed in or not.
  await openApp(latecomerPage, new URL(link).pathname)
  await expect(
    latecomerPage.getByRole("heading", {
      name: "This invite has already been used",
    }),
  ).toBeVisible()
  await expect(
    latecomerPage.getByRole("button", { name: "Accept and play" }),
  ).toHaveCount(0)
  await latecomerPage.getByRole("link", { name: "Go home" }).click()
  await expect(latecomerPage).toHaveURL("/")

  await host.close()
  await guest.close()
  await latecomer.close()
})

test("an expired link says so and offers the way home", async ({
  browser,
}) => {
  const host = await browser.newContext()
  const visitor = await browser.newContext()
  const hostPage = await host.newPage()
  const visitorPage = await visitor.newPage()

  await signUp(hostPage, uniqueUsername("host"))
  const link = await createInviteLink(hostPage)
  await expireInviteLink(new URL(link).pathname.split("/").pop() ?? "")

  await openApp(visitorPage, new URL(link).pathname)
  await expect(
    visitorPage.getByRole("heading", { name: "This invite has expired" }),
  ).toBeVisible()
  await expect(
    visitorPage.getByRole("button", { name: "Accept and play" }),
  ).toHaveCount(0)
  await visitorPage.getByRole("link", { name: "Go home" }).click()
  await expect(visitorPage).toHaveURL("/")

  await host.close()
  await visitor.close()
})
