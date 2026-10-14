import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, signUp, uniqueUsername } from "./support/app"

// Accessibility beyond colour: axe's WCAG 2.0 A/AA and 2.1 AA rules on the
// public pages and the invite page. Colour contrast has its own spec
// (e2e/text-contrast.spec.ts), so that rule is off here.
//
// A violation that is known and filed goes in KNOWN_VIOLATIONS below, named by
// rule and page, with the task that fixes it. The scan still runs for every
// other rule, and an exception that no longer matches fails the test, so the
// list cannot outlive the fix.

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "markup rules do not differ per engine",
)

type KnownViolation = {
  rule: string
  /** The page the rule fails on; "*" for every page. */
  path: string
  /** The task that fixes it. */
  task: string
}

const KNOWN_VIOLATIONS: KnownViolation[] = [
  // The shell's viewport meta disables pinch zoom (WCAG 1.4.4).
  { rule: "meta-viewport", path: "*", task: "TUD-1050" },
]

const TAGS = ["wcag2a", "wcag2aa", "wcag21aa"]

async function scan(page: Page, path: string) {
  const results = await new AxeBuilder({ page })
    .withTags(TAGS)
    .disableRules(["color-contrast"])
    .analyze()
  const known = KNOWN_VIOLATIONS.filter(
    (exception) => exception.path === path || exception.path === "*",
  )
  const found = results.violations.filter(
    (violation) =>
      !known.some((exception) => exception.rule === violation.id),
  )
  expect(
    found.map((violation) => ({
      rule: violation.id,
      nodes: violation.nodes.map((node) => node.target.join(" ")),
    })),
    `${path} violations`,
  ).toEqual([])
  const fixed = known.filter(
    (exception) =>
      !results.violations.some(
        (violation) => violation.id === exception.rule,
      ),
  )
  expect(
    fixed.map((exception) => `${exception.rule} (${exception.task})`),
    `${path} exceptions that no longer fail: remove them`,
  ).toEqual([])
}

for (const path of ["/", "/rules", "/strategy", "/offline"]) {
  test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
    await openApp(page, path)
    await scan(page, path)
  })
}

test("an invite page has no WCAG A/AA violations", async ({ browser }) => {
  const host = await browser.newContext()
  const guest = await browser.newContext()
  const hostPage = await host.newPage()
  const guestPage = await guest.newPage()
  await signUp(hostPage, uniqueUsername("axe"))
  await openApp(hostPage, "/online?invite=new")
  const composer = hostPage.getByRole("dialog")
  await composer
    .getByRole("button", { name: "Invite with a link" })
    .click()
  const field = composer.getByLabel("Invite link")
  await expect(field).toHaveValue(/\/invite\/[A-Za-z0-9_-]{43}$/)
  const path = new URL(await field.inputValue()).pathname

  await openApp(guestPage, path)
  await expect(
    guestPage.getByRole("button", { name: "Create account" }),
  ).toBeVisible()
  await scan(guestPage, "/invite")
  await host.close()
  await guest.close()
})
