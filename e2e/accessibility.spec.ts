import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import {
  openApp,
  signUp,
  startOfflineGame,
  uniqueUsername,
} from "./support/app"

// Accessibility beyond colour: axe on every public page, the overlays opened
// from the header, a game in progress and the invite page, in both engines (the
// WebKit project lays the pages out as a phone, which renders other markup).
// A page fails on any WCAG 2.0 A/AA or 2.1 AA violation, and on any other rule
// axe rates serious or critical. Colour contrast has its own spec
// (e2e/text-contrast.spec.ts), so that rule is off here.
//
// A violation that is known and filed goes in KNOWN_VIOLATIONS below, named by
// rule and page, with the task that fixes it. The scan still runs for every
// other rule, and an exception that no longer matches fails the test, so the
// list cannot outlive the fix.

type KnownViolation = {
  rule: string
  /** The page the rule fails on; "*" for every page. */
  path: string
  /** The task that fixes it. */
  task: string
}

const KNOWN_VIOLATIONS: KnownViolation[] = []

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21aa"]
const BLOCKING_IMPACTS = ["serious", "critical"]

async function scan(page: Page, path: string) {
  const results = await new AxeBuilder({ page })
    .disableRules(["color-contrast"])
    .analyze()
  const violations = results.violations.filter(
    (violation) =>
      violation.tags.some((tag) => WCAG_TAGS.includes(tag)) ||
      BLOCKING_IMPACTS.includes(violation.impact ?? ""),
  )
  const known = KNOWN_VIOLATIONS.filter(
    (exception) => exception.path === path || exception.path === "*",
  )
  const found = violations.filter(
    (violation) =>
      !known.some((exception) => exception.rule === violation.id),
  )
  expect(
    found.map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target.join(" ")),
    })),
    `${path} violations`,
  ).toEqual([])
  const fixed = known.filter(
    (exception) =>
      !violations.some((violation) => violation.id === exception.rule),
  )
  expect(
    fixed.map((exception) => `${exception.rule} (${exception.task})`),
    `${path} exceptions that no longer fail: remove them`,
  ).toEqual([])
}

for (const path of ["/", "/rules", "/strategy", "/offline", "/online"]) {
  test(`${path} has no accessibility violations`, async ({ page }) => {
    await openApp(page, path)
    await scan(page, path)
  })
}

for (const overlay of ["Settings", "Sign in"]) {
  test(`the ${overlay} overlay has no accessibility violations`, async ({
    page,
  }) => {
    await openApp(page, "/")
    await page
      .getByRole("button", { name: overlay })
      .filter({ visible: true })
      .first()
      .click()
    await expect(page.getByRole("dialog")).toBeVisible()
    // An overlay slides in; axe reads what is on screen once it has settled.
    await page.waitForFunction(() => document.getAnimations().length === 0)
    await scan(page, `/ (${overlay})`)
  })
}

test("a game in progress has no accessibility violations", async ({
  page,
}) => {
  await startOfflineGame(page, "Pass & Play")
  await scan(page, "/game/offline")
})

test("an invite page has no accessibility violations", async ({
  browser,
}) => {
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
