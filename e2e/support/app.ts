import type {
  Browser,
  BrowserContext,
  Locator,
  Page,
} from "@playwright/test"
import { expect } from "@playwright/test"

export const PASSWORD = "e2e-password-1"

/**
 * A username no other test, project or earlier run has taken. Every run starts
 * from an empty database, but the two browser projects share it.
 */
export function uniqueUsername(prefix = "e2e"): string {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  return `${prefix}${suffix}`.slice(0, 20)
}

/**
 * Opens a page and waits until React has hydrated it. The game is server
 * rendered, so the markup is there before anything on it responds; a press that
 * lands in between does nothing. React tags each node it has taken over with a
 * `__reactFiber$…` key, and that is the sign this waits for.
 */
export async function openApp(page: Page, path: string): Promise<void> {
  await page.goto(path)
  // Both layouts render the page into <main>; the header around it differs
  // between a phone and a desktop, so nothing in it is a marker for both.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const content = document.querySelector("main > *")
          return (
            content !== null &&
            Object.keys(content).some((key) =>
              key.startsWith("__reactFiber$"),
            )
          )
        }),
      { message: `${path} hydrated`, timeout: 30_000 },
    )
    .toBe(true)
}

/** Opens /offline and starts a game in the given mode with default settings. */
export async function startOfflineGame(
  page: Page,
  mode: "vs Computer" | "Pass & Play",
): Promise<void> {
  await openApp(page, "/offline")
  await page.getByRole("tab", { name: mode }).click()
  await page.getByRole("button", { name: "Play", exact: true }).click()
  await expect(page.getByRole("button", { name: "Resign" })).toBeVisible()
}

/**
 * Fills the header's sign-in form in the given mode and waits until the account
 * is signed in.
 */
async function authenticate(
  page: Page,
  mode: "Sign in" | "Create account",
  username: string,
): Promise<void> {
  await openApp(page, "/")
  await page.getByRole("button", { name: "Sign in" }).first().click()
  const form = page.getByRole("dialog")
  if (mode === "Create account")
    await form.getByRole("tab", { name: "Create account" }).click()
  await form.getByLabel("Username").fill(username)
  await form.getByLabel("Password", { exact: true }).fill(PASSWORD)
  await form.getByRole("button", { name: mode }).click()
  // Hashing the password is the slowest request the suite makes, and the
  // local Worker does it for every browser running at once.
  await expect(form).toBeHidden({ timeout: 30_000 })
  await expect(page.getByRole("button", { name: "Sign in" })).toHaveCount(
    0,
  )
}

/** Signs a new account up from the header. */
export function signUp(page: Page, username: string): Promise<void> {
  return authenticate(page, "Create account", username)
}

/**
 * Logs out from the profile page, which is where both layouts keep it. The
 * profile is for signed-in players only, so the app goes home and opens the
 * sign-in prompt by itself; that prompt is what this hands back.
 */
export async function signOut(page: Page): Promise<Locator> {
  await openApp(page, "/profile")
  await page.getByRole("button", { name: "Log out" }).click()
  await expect(page).toHaveURL("/")
  const prompt = page.getByRole("dialog")
  await expect(prompt.getByLabel("Username")).toBeVisible()
  return prompt
}

// Online play between two players in two browsers: one invites the other by
// username, the other accepts, and each move reaches the other board through
// the backend's game room (Durable Object) without a reload.
export type OnlinePlayers = {
  host: BrowserContext
  guest: BrowserContext
  hostPage: Page
  guestPage: Page
  guestName: string
}

/** Signs two players up, invites and accepts, and opens the game on both pages. */
export async function startOnlineGame(
  browser: Browser,
): Promise<OnlinePlayers> {
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
  await composer.getByLabel("Opponent", { exact: true }).fill(guestName)
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
