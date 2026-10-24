import { expect, test } from "@playwright/test"
import {
  openApp,
  PASSWORD,
  signOut,
  signUp,
  uniqueUsername,
} from "./support/app"

// An account is a username and a password: create one, leave, and come back in
// with the same pair. A wrong password is turned away.
test("a player signs up, signs out, and signs back in with their username", async ({
  page,
}) => {
  const username = uniqueUsername("auth")

  await signUp(page, username)
  await openApp(page, "/profile")
  await expect(page.getByRole("heading", { name: username })).toBeVisible()

  // Logging out of the profile asks to sign back in.
  const form = await signOut(page)
  await form.getByLabel("Username").fill(username)
  await form
    .getByLabel("Password", { exact: true })
    .fill(`${PASSWORD}-wrong`)
  await form.getByRole("button", { name: "Sign in" }).click()
  await expect(
    form
      .getByText("That name and password don't match.")
      .filter({ visible: true }),
  ).toBeVisible({ timeout: 30_000 })

  await form.getByLabel("Password", { exact: true }).fill(PASSWORD)
  await form.getByRole("button", { name: "Sign in" }).click()
  await expect(form).toBeHidden({ timeout: 30_000 })
  await openApp(page, "/profile")
  await expect(page.getByRole("heading", { name: username })).toBeVisible()
})

// A rate-limit 429 on sign-in is the same refusal as a lock to the player: the
// try-again-later sentence, with no wait in it and never "Something went wrong."
test.describe("a rate-limited sign-in", () => {
  // The service worker would answer the request before page.route sees it.
  test.use({ serviceWorkers: "block" })

  test("says try again later, without a number", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    const username = uniqueUsername("limited")
    await signUp(page, username)
    const form = await signOut(page)

    await page.route("**/sign-in/username**", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        headers: { "Retry-After": "840" },
        body: JSON.stringify({
          status: "error",
          error_code: "rate_limit_exceeded",
        }),
      }),
    )

    await form.getByLabel("Username").fill(username)
    await form.getByLabel("Password", { exact: true }).fill(PASSWORD)
    await form.getByRole("button", { name: "Sign in" }).click()

    const message = form
      .getByText("Too many attempts. Try again later.")
      .filter({ visible: true })
    await expect(message).toBeVisible({ timeout: 30_000 })
    await expect(message).not.toHaveText(/\d/)
    await expect(form.getByText("Something went wrong")).toHaveCount(0)

    await testInfo.attach("rate-limited-768", {
      body: await page.screenshot(),
      contentType: "image/png",
    })
  })
})
