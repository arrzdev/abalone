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
