import type { Route } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { PASSWORD, signOut, signUp, uniqueUsername } from "./support/app"

// The service worker would answer the request before page.route sees it.
test.use({ serviceWorkers: "block" })

// Signing in waits on the network. While it does, the button says so (a
// spinner, busy, disabled), and a second press sends nothing.
test("the sign-in button shows it is working and takes one press", async ({
  page,
}) => {
  const username = uniqueUsername("pending")
  await signUp(page, username)
  const form = await signOut(page)

  const held: Route[] = []
  await page.route("**/sign-in/username**", (route) => {
    held.push(route)
  })

  await form.getByLabel("Username").fill(username)
  await form.getByLabel("Password", { exact: true }).fill(PASSWORD)
  const submit = form.locator('button[type="submit"]')
  await submit.click()

  await expect.poll(() => held.length).toBe(1)
  await expect(submit).toBeDisabled()
  await expect(submit).toHaveAttribute("aria-busy", "true")
  await expect(submit.locator("[data-spinner]")).toBeVisible()

  // A second press while the first is out.
  await submit.click({ force: true })
  await page.waitForTimeout(500)
  expect(held).toHaveLength(1)

  await page.unroute("**/sign-in/username**")
  for (const route of held) await route.continue()
  await expect(form).toBeHidden({ timeout: 30_000 })
})
