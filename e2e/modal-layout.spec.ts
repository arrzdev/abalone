import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import {
  openApp,
  signUp,
  startOfflineGame,
  uniqueUsername,
} from "./support/app"
import { playMove } from "./support/board"
import {
  expectEvenRhythm,
  expectNoClippedText,
  expectNoLayoutShift,
  expectNoScrolling,
  waitForRest,
} from "./support/layout"

// Every dialog in the game, on the smallest phone, on a phone Safari with its
// toolbar, and on a desktop: no text is cut off, pressing a button moves
// nothing, and the space between the blocks follows one rhythm. The checks and
// the rules behind them: e2e/support/layout.ts, docs/ui-layout-checks.md.
//
// Dialogs covered: the invite composer, the sign-in and create-account sheet,
// settings, the resign confirmation, the game over dialog. Inline status text:
// the empty online page's invite link.

const VIEWPORTS = [
  { name: "a 375x667 phone", size: { width: 375, height: 667 } },
  { name: "a 402x710 phone Safari", size: { width: 402, height: 710 } },
  { name: "a desktop", size: { width: 1280, height: 800 } },
]

/**
 * The house rhythm (docs/ui-layout-checks.md): 8px from a label to its control,
 * from a title to the line under it and from a control to its hint; 20px
 * between sections and above the primary action.
 */
const RHYTHM = { sizes: [8, 20] }

const INVITE_LINK = /\/invite\/[A-Za-z0-9_-]{43}$/

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

async function openDialog(page: Page, hasText?: string): Promise<Locator> {
  const dialog = hasText
    ? page.getByRole("dialog").filter({ hasText })
    : page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await waitForRest(dialog)
  return dialog
}

/** The one alert in `scope` that has something to say. */
function spokenAlert(scope: Locator): Locator {
  return scope.getByRole("alert").filter({ hasText: /\S/ })
}

for (const viewport of VIEWPORTS) {
  test.describe(`on ${viewport.name}`, () => {
    test.use({ viewport: viewport.size })

    test("the invite composer shows all its text, keeps one rhythm and moves nothing when a link is made and copied", async ({
      page,
    }) => {
      await copyToRecordedClipboard(page)
      await signUp(page, uniqueUsername("rhythm"))
      await openApp(page, "/online?invite=new")
      const composer = await openDialog(page)

      await expectNoClippedText(composer)
      await expectEvenRhythm(composer, RHYTHM)

      // A name nobody has: the answer lands in space that was already there.
      await composer
        .getByLabel("Opponent", { exact: true })
        .fill(uniqueUsername("nobody"))
      await expectNoLayoutShift(
        composer,
        () =>
          composer.getByRole("button", { name: "Send invite" }).click(),
        { until: () => expect(spokenAlert(composer)).toBeVisible() },
      )
      await expectNoClippedText(composer)
      await expectNoScrolling(composer)

      await expectNoLayoutShift(
        composer,
        () =>
          composer
            .getByRole("button", { name: "Invite with a link" })
            .click(),
        {
          until: () =>
            expect(composer.getByLabel("Invite link")).toHaveValue(
              INVITE_LINK,
            ),
        },
      )
      // The whole link is still the field's value, to select or copy.
      await expect(composer.getByLabel("Invite link")).toHaveValue(
        INVITE_LINK,
      )
      await expectNoClippedText(composer)

      await expectNoLayoutShift(
        composer,
        () => composer.getByRole("button", { name: "Copy link" }).click(),
        {
          until: () =>
            expect(composer.getByText(/^Link copied/)).toBeVisible(),
        },
      )
      await expectNoClippedText(composer)
      await expectEvenRhythm(composer, RHYTHM)
    })

    test("the empty online page makes and copies a link without moving anything", async ({
      page,
    }) => {
      await copyToRecordedClipboard(page)
      await signUp(page, uniqueUsername("empty"))
      await openApp(page, "/online")
      const main = page.locator("main")
      await expect(
        main.getByRole("heading", { name: "Nothing here yet" }),
      ).toBeVisible()

      await expectNoLayoutShift(
        main,
        () =>
          main.getByRole("button", { name: "Invite with a link" }).click(),
        {
          until: () =>
            expect(main.getByText(/^Link copied/)).toBeVisible(),
        },
      )
      await expectNoClippedText(main)

      await expectNoLayoutShift(
        main,
        () => main.getByRole("button", { name: "Copy link" }).click(),
        {
          until: () =>
            expect(main.getByText(/^Link copied/)).toBeVisible(),
        },
      )
      await expectNoClippedText(main)
    })

    test("the sign-in sheet shows all its text, keeps one rhythm and moves nothing on a tab switch or a refused sign-in", async ({
      page,
    }) => {
      await openApp(page, "/")
      await page
        .getByRole("button", { name: "Sign in" })
        .filter({ visible: true })
        .first()
        .click()
      const form = await openDialog(page)

      await expectNoClippedText(form)
      await expectEvenRhythm(form, RHYTHM)

      await expectNoLayoutShift(form, () =>
        form.getByRole("tab", { name: "Create account" }).click(),
      )
      await expectNoClippedText(form)
      await expectEvenRhythm(form, RHYTHM)

      await expectNoLayoutShift(form, () =>
        form.getByRole("tab", { name: "Sign in" }).click(),
      )

      //no room is kept for an error that may never come (TUD-2781): a
      //refused sign-in grows the form by its one line, under the fields
      await form.getByLabel("Username").fill(uniqueUsername("nobody"))
      const password = form.getByLabel("Password", { exact: true })
      await password.fill("not-the-password")
      await form.getByRole("button", { name: "Sign in" }).click()
      const alert = spokenAlert(form)
      await expect(alert).toBeVisible({ timeout: 30_000 })
      const passwordBox = await password.boundingBox()
      const alertBox = await alert.boundingBox()
      if (passwordBox === null || alertBox === null)
        throw new Error("password or alert not drawn")
      expect(alertBox.y).toBeGreaterThan(
        passwordBox.y + passwordBox.height,
      )
      await expectNoClippedText(form)
    })

    test("settings shows all its text, keeps one rhythm and moves nothing when a switch is flipped", async ({
      page,
    }) => {
      await openApp(page, "/")
      await page
        .getByRole("button", { name: "Settings" })
        .filter({ visible: true })
        .first()
        .click()
      const settings = await openDialog(page)

      await expectNoClippedText(settings)
      await expectEvenRhythm(settings, RHYTHM)

      for (const toggle of await settings.getByRole("switch").all()) {
        await expectNoLayoutShift(settings, () => toggle.click())
      }
      await expectNoClippedText(settings)
    })

    test("the resign confirmation and the game over dialog show all their text and keep one rhythm", async ({
      page,
    }) => {
      await startOfflineGame(page, "Pass & Play")
      await playMove(page, "c5", "d5")

      await page.getByRole("button", { name: "Resign" }).click()
      const confirm = await openDialog(page, "Resign the game?")
      await expectNoClippedText(confirm)
      await expectEvenRhythm(confirm, RHYTHM)

      await confirm.getByRole("button", { name: "Resign" }).click()
      const gameOver = await openDialog(page, "wins")
      await expectNoClippedText(gameOver)
      await expectEvenRhythm(gameOver, RHYTHM)
    })
  })
}

// German runs among the longest of the translations, and its refusal of a name
// is longer than the English one. On the smallest phone the composer has to fit
// that too, without its content scrolling under the sheet's bottom fade.
test.describe("in German on a 375x667 phone", () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test("the invite composer shows all its text with a refused name, without scrolling", async ({
    page,
  }) => {
    await signUp(page, uniqueUsername("german"))
    // What the language switch in settings stores, and a reload keeps
    // (language.spec.ts).
    await page.evaluate(() =>
      localStorage.setItem("abalone_language", "de"),
    )
    await openApp(page, "/online?invite=new")
    const composer = await openDialog(page)
    await expectNoClippedText(composer)

    await composer
      .getByLabel("Gegen wen spielst du?")
      .fill(uniqueUsername("nobody"))
    await composer
      .getByRole("button", { name: "Einladung senden" })
      .click()
    await expect(spokenAlert(composer)).toHaveText(
      "Unter diesem Namen spielt niemand.",
    )
    await waitForRest(composer)
    await expectNoClippedText(composer)
    await expectNoScrolling(composer)
  })
})
