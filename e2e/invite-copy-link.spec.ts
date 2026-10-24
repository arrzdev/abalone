import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, signUp, uniqueUsername } from "./support/app"
import { expectNoScrolling, waitForRest } from "./support/layout"

// The link in the composer keeps the row: copy and share are icons beside it,
// so a phone shows enough of the link to tell it is one, and the copy puts the
// whole link on the clipboard.

const INVITE_LINK = /\/invite\/[A-Za-z0-9_-]{43}$/

type Recorded = { copied: string[]; shared: string[] }

/**
 * Records what the page copies and shares instead of doing either. Without
 * `share`, the browser has no share sheet, as a desktop has none.
 */
async function recordHandOffs(
  page: Page,
  { share }: { share: boolean },
): Promise<void> {
  await page.addInitScript((withShare) => {
    const recorded: Recorded = { copied: [], shared: [] }
    ;(window as unknown as { recorded: Recorded }).recorded = recorded
    delete (Navigator.prototype as { share?: unknown }).share
    delete (navigator as { share?: unknown }).share
    if (withShare) {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async ({ url }: { url: string }) => {
          recorded.shared.push(url)
        },
      })
    }
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          recorded.copied.push(text)
        },
      },
    })
  }, share)
}

function recorded(page: Page): Promise<Recorded> {
  return page.evaluate(
    () => (window as unknown as { recorded: Recorded }).recorded,
  )
}

async function makeLink(page: Page) {
  await openApp(page, "/online?invite=new")
  const composer = page.getByRole("dialog")
  await expect(composer).toBeVisible()
  await waitForRest(composer)
  await composer
    .getByRole("button", { name: "Invite with a link" })
    .click()
  const field = composer.getByLabel("Invite link")
  await expect(field).toHaveValue(INVITE_LINK)
  return { composer, field }
}

test.describe("on a 375x667 phone", () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test("the copy icon copies the whole link and the field keeps most of the row", async ({
    page,
  }) => {
    await recordHandOffs(page, { share: false })
    await signUp(page, uniqueUsername("copy"))
    const { composer, field } = await makeLink(page)

    const copy = composer.getByRole("button", { name: "Copy link" })
    await expect(copy).toBeVisible()
    await expect(
      composer.getByRole("button", { name: "Share link" }),
    ).toHaveCount(0)

    // An icon button, and the field takes the rest of the row.
    const copyBox = await copy.boundingBox()
    const fieldBox = await field.boundingBox()
    expect(copyBox?.width).toBeLessThanOrEqual(56)
    expect(fieldBox?.width).toBeGreaterThan(240)

    await copy.click()
    await expect(composer.getByText(/^Link copied/)).toBeVisible()
    expect((await recorded(page)).copied).toEqual([
      await field.inputValue(),
    ])
    await expectNoScrolling(composer)
  })

  test("with a share sheet, share sits next to copy and hands the link on", async ({
    page,
  }) => {
    await recordHandOffs(page, { share: true })
    await signUp(page, uniqueUsername("share"))
    const { composer, field } = await makeLink(page)

    const copy = composer.getByRole("button", { name: "Copy link" })
    const share = composer.getByRole("button", { name: "Share link" })
    await expect(copy).toBeVisible()
    await expect(share).toBeVisible()
    const fieldBox = await field.boundingBox()
    expect(fieldBox?.width).toBeGreaterThan(190)

    const link = await field.inputValue()
    await share.click()
    await expect
      .poll(async () => (await recorded(page)).shared)
      .toEqual([link])

    await copy.click()
    await expect(composer.getByText(/^Link copied/)).toBeVisible()
    expect((await recorded(page)).copied).toEqual([link])
    await expectNoScrolling(composer)
  })
})
