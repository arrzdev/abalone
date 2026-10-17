import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, signUp, uniqueUsername } from "./support/app"
import { expectNoClippedText, expectNoLayoutShift } from "./support/layout"

// The inline status text outside the dialogs: the profile's line under the
// name, the hub's line under its heading, and the invite link page's lines
// under its buttons. Each has room for what it can say from the first render,
// so the message arriving moves nothing, and the message is shown in full.
// The checks and the rules behind them: e2e/support/layout.ts,
// docs/ui-layout-checks.md. The dialogs: e2e/modal-layout.spec.ts.

const VIEWPORTS = [
  { name: "a 375x667 phone", size: { width: 375, height: 667 } },
  { name: "a 402x710 phone Safari", size: { width: 402, height: 710 } },
  { name: "a desktop", size: { width: 1280, height: 800 } },
]

/** Answers every request to `path` (a glob) with a server error. */
async function failRequests(
  page: Page,
  path: string,
  method: string,
): Promise<void> {
  await page.route(path, async (route) => {
    if (route.request().method() !== method) return route.fallback()
    // The api is on its own origin, and WebKit drops an answer that does not
    // say this page may read it, as the real one does.
    const origin = (await route.request().headerValue("origin")) ?? "*"
    return route.fulfill({
      status: 500,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-credentials": "true",
      },
      body: JSON.stringify({ ok: false }),
    })
  })
}

/**
 * Takes the share sheet away and records the clipboard, so "Copy link" is the
 * button on every browser and the copy succeeds.
 */
async function copyToRecordedClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    delete (Navigator.prototype as { share?: unknown }).share
    delete (navigator as { share?: unknown }).share
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => {} },
    })
  })
}

/** Makes a link from the composer and hands back its address on this site. */
async function createInviteLink(page: Page): Promise<string> {
  await openApp(page, "/online?invite=new")
  const composer = page.getByRole("dialog")
  await composer
    .getByRole("button", { name: "Invite with a link" })
    .click()
  const field = composer.getByLabel("Invite link")
  await expect(field).toHaveValue(/\/invite\/[A-Za-z0-9_-]{43}$/)
  return new URL(await field.inputValue()).pathname
}

/** The one alert in the page that has something to say. */
function spokenAlert(page: Page) {
  return page.getByRole("alert").filter({ hasText: /\S/ })
}

for (const viewport of VIEWPORTS) {
  test.describe(`on ${viewport.name}`, () => {
    // The failures are answered here rather than by the api, and a request
    // the app's service worker makes is not seen by `page.route`.
    test.use({ viewport: viewport.size, serviceWorkers: "block" })

    test("a picture that does not upload says so on the profile without moving anything", async ({
      page,
    }) => {
      await signUp(page, uniqueUsername("pic"))
      await openApp(page, "/profile")
      await failRequests(page, "**/api/v1/profile/me/avatar", "POST")
      const main = page.locator("main")

      await expectNoLayoutShift(
        main,
        () =>
          page.locator('input[type="file"]').setInputFiles({
            name: "avatar.png",
            mimeType: "image/png",
            //a 1x1 png: the upload is refused before anything reads it
            buffer: Buffer.from(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
              "base64",
            ),
          }),
        { until: () => expect(spokenAlert(page)).toBeVisible() },
      )
      await expectNoClippedText(main)
    })

    test("a hub action that fails says so under the heading without moving the cards", async ({
      page,
      browser,
    }) => {
      // Somebody to invite, so the hub has a sent invite with a Cancel on it.
      const friend = await browser.newContext()
      const friendName = uniqueUsername("friend")
      await signUp(await friend.newPage(), friendName)
      await friend.close()

      await signUp(page, uniqueUsername("hub"))
      await openApp(page, "/online?invite=new")
      const composer = page.getByRole("dialog")
      await composer.getByLabel("Who are you playing?").fill(friendName)
      await composer.getByRole("button", { name: "Send invite" }).click()
      await expect(composer).toBeHidden()

      const main = page.locator("main")
      const cancel = main
        .getByRole("button", { name: "Cancel" })
        .filter({ visible: true })
        .first()
      await expect(cancel).toBeVisible()
      await failRequests(page, "**/api/v1/invites/*", "DELETE")

      await expectNoLayoutShift(main, () => cancel.click(), {
        until: () => expect(spokenAlert(page)).toBeVisible(),
      })
      await expectNoClippedText(main)
    })

    test("the invite link page copies its link and refuses an accept without moving anything", async ({
      page,
      browser,
    }) => {
      await copyToRecordedClipboard(page)
      await signUp(page, uniqueUsername("own"))
      const path = await createInviteLink(page)

      // The sender's own link: a copy button and the line under it.
      await openApp(page, path)
      const main = page.locator("main")
      await expect(
        main.getByRole("heading", { name: "This is your invite link" }),
      ).toBeVisible()
      await expectNoLayoutShift(
        main,
        () => main.getByRole("button", { name: "Copy link" }).click(),
        {
          until: () =>
            expect(main.getByText(/^Link copied/)).toBeVisible(),
        },
      )
      await expectNoClippedText(main)

      // Somebody else's: an accept the server refuses.
      const guest = await browser.newContext({ serviceWorkers: "block" })
      const guestPage = await guest.newPage()
      await signUp(guestPage, uniqueUsername("guest"))
      await openApp(guestPage, path)
      const guestMain = guestPage.locator("main")
      const accept = guestMain.getByRole("button", {
        name: "Accept and play",
      })
      await expect(accept).toBeVisible()
      await failRequests(
        guestPage,
        "**/api/v1/invite-links/*/accept",
        "POST",
      )

      await expectNoLayoutShift(guestMain, () => accept.click(), {
        until: () => expect(spokenAlert(guestPage)).toBeVisible(),
      })
      await expectNoClippedText(guestMain)
      await guest.close()
    })
  })
}
