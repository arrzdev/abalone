import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, signUp, uniqueUsername } from "./support/app"

// The way out of every secondary screen on a phone is the arrow in the corner
// of its header, so it is a full 44px thumb target and the title stays centred.

const TAP_TARGET = 44

test.use({ viewport: { width: 390, height: 844 } })

async function expectBackArrowFitsAThumb(page: Page, path: string) {
  await openApp(page, path)
  const back = page.getByRole("link", { name: "Back", exact: true })
  const header = page.locator("header").filter({ has: back })
  const box = await back.boundingBox()
  expect(box, `${path} back arrow`).not.toBeNull()
  expect(box?.width, `${path} back arrow width`).toBeGreaterThanOrEqual(
    TAP_TARGET,
  )
  expect(box?.height, `${path} back arrow height`).toBeGreaterThanOrEqual(
    TAP_TARGET,
  )

  // Same width on both sides of the title keeps it on the bar's centre line.
  const title = await header.locator("h1, p").first().boundingBox()
  const bar = await header.boundingBox()
  if (title === null || bar === null) throw new Error(`${path} header`)
  expect(
    Math.abs(title.x + title.width / 2 - (bar.x + bar.width / 2)),
    `${path} title centred`,
  ).toBeLessThanOrEqual(1)
}

for (const path of ["/rules", "/strategy", "/offline"]) {
  test(`the back arrow on ${path} is a 44px tap target`, async ({
    page,
  }) => {
    await expectBackArrowFitsAThumb(page, path)
  })
}

test("the back arrow on the signed-in subpages is a 44px tap target", async ({
  page,
}) => {
  await signUp(page, uniqueUsername("back"))
  for (const path of ["/profile", "/online/history"]) {
    await expectBackArrowFitsAThumb(page, path)
  }
})
