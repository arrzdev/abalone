import type { Browser, Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, signUp, uniqueUsername } from "./support/app"
import {
  expectNoClippedText,
  expectNoLayoutShift,
  expectNoScrolling,
  waitForRest,
} from "./support/layout"

// The New invite sheet, who first: the people you played lately, a field for
// anybody else, the link as a card, and the terms in one line that Change opens
// into a panel of their own (TUD-3855, acceptance criteria 1 to 11). Layout is
// held with the shared checks: nothing moves when something is pressed, no text
// is cut off, and the sheet does not scroll on the phones it was drawn for.

const INVITE_LINK = /\/invite\/[A-Za-z0-9_-]{43}$/

/** What the app stores for the language switch in settings. */
const LANGUAGE_STORAGE_KEY = "abalone_language"

/** Phones the sheet fits on without scrolling, and the smallest it may scroll on. */
const FITTING_PHONES = [
  { width: 375, height: 667 },
  { width: 375, height: 548 },
  { width: 390, height: 664 },
]
const SMALLEST_PHONE = { width: 320, height: 460 }

/** Takes the share sheet away and records the clipboard, as a desktop has. */
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

async function openComposer(page: Page): Promise<Locator> {
  await openApp(page, "/online?invite=new")
  const composer = page.getByRole("dialog")
  await expect(composer).toBeVisible()
  await waitForRest(composer)
  return composer
}

/** The one alert in `scope` that has something to say. */
function spokenAlert(scope: Locator): Locator {
  return scope.getByRole("alert").filter({ hasText: /\S/ })
}

/** A host who has played one guest, so the host's composer has a chip. */
async function hostWithOneOpponent(browser: Browser) {
  const host = await browser.newContext({ serviceWorkers: "block" })
  const guest = await browser.newContext()
  const hostPage = await host.newPage()
  const guestPage = await guest.newPage()

  const hostName = uniqueUsername("host")
  const guestName = uniqueUsername("guest")
  await signUp(hostPage, hostName)
  await signUp(guestPage, guestName)

  const composer = await openComposer(hostPage)
  await composer.getByLabel("Opponent", { exact: true }).fill(guestName)
  await composer
    .getByRole("button", { name: `Invite ${guestName}` })
    .click()
  await expect(composer).toBeHidden()

  await openApp(guestPage, "/online")
  await guestPage
    .getByRole("button", { name: "Accept" })
    .filter({ visible: true })
    .first()
    .click({ timeout: 30_000 })
  await expect(guestPage).toHaveURL(/\/online\/(?!history)[^/]+$/)
  await guest.close()

  return { host, hostPage, guestName }
}

for (const viewport of FITTING_PHONES) {
  test.describe(`on a ${viewport.width}x${viewport.height} phone`, () => {
    test.use({ viewport })

    test("a first invite has no chips, asks for an opponent and does not scroll", async ({
      page,
    }) => {
      await signUp(page, uniqueUsername("first"))
      const composer = await openComposer(page)

      await expect(composer.getByText("Play again with")).toHaveCount(0)
      await expect(composer.getByRole("radio")).toHaveCount(0)
      await expect(
        composer.getByLabel("Opponent", { exact: true }),
      ).toBeVisible()
      await expect(
        composer.getByRole("button", { name: "Send invite" }),
      ).toBeDisabled()

      await expectNoClippedText(composer)
      await expectNoScrolling(composer)
    })

    test("a refused name lands in the line that was already there, with a chip or without", async ({
      page,
    }) => {
      await signUp(page, uniqueUsername("refused"))
      const composer = await openComposer(page)

      const nobody = uniqueUsername("nobody")
      await composer.getByLabel("Opponent", { exact: true }).fill(nobody)
      await expectNoLayoutShift(
        composer,
        () =>
          composer
            .getByRole("button", { name: `Invite ${nobody}` })
            .click(),
        { until: () => expect(spokenAlert(composer)).toBeVisible() },
      )
      await expect(spokenAlert(composer)).toHaveText(
        "Nobody goes by that name.",
      )
      await expectNoClippedText(composer)
      await expectNoScrolling(composer)
    })

    test("with someone to play again, the chip is picked, ringed and sent, and a refusal leaves the sheet where it was", async ({
      browser,
    }) => {
      const { host, hostPage, guestName } =
        await hostWithOneOpponent(browser)
      await hostPage.setViewportSize(viewport)
      const composer = await openComposer(hostPage)

      const chip = composer.getByRole("radio", {
        name: guestName,
        exact: true,
      })
      await expect(composer.getByText("Play again with")).toBeVisible()
      await expect(chip).toBeVisible()
      await expect(
        composer.getByLabel("Someone else", { exact: true }),
      ).toBeVisible()
      await expect(
        composer.getByRole("button", { name: "Send invite" }),
      ).toBeDisabled()
      await expectNoClippedText(composer)
      await expectNoScrolling(composer)

      // Picked: the send names them, and the field stays empty.
      await chip.check()
      await expect(chip).toBeChecked()
      await expect(
        composer.getByLabel("Someone else", { exact: true }),
      ).toHaveValue("")
      const send = composer.getByRole("button", {
        name: `Invite ${guestName}`,
      })
      await expect(send).toBeEnabled()
      await send.click()
      await expect(composer).toBeHidden()

      // Ask them again while that invite is still out: the refusal is spoken
      // in the line that was reserved for it, and the picked chip is at fault.
      const again = await openComposer(hostPage)
      await again
        .getByRole("radio", { name: guestName, exact: true })
        .check()
      await expectNoLayoutShift(composer, () => send.click(), {
        until: () => expect(spokenAlert(composer)).toBeVisible(),
      })
      await expect(spokenAlert(composer)).toHaveText(
        "You already have an invite out to them.",
      )
      await expectNoClippedText(composer)
      await expectNoScrolling(composer)

      // The next edit clears it.
      await composer.getByLabel("Someone else", { exact: true }).fill("x")
      await expect(spokenAlert(composer)).toHaveCount(0)
      await host.close()
    })
  })
}

test.describe(`on a ${SMALLEST_PHONE.width}x${SMALLEST_PHONE.height} phone`, () => {
  test.use({ viewport: SMALLEST_PHONE })

  test("the send stays in view while the rest scrolls, with no text cut off", async ({
    page,
  }) => {
    await signUp(page, uniqueUsername("small"))
    const composer = await openComposer(page)

    await expectNoClippedText(composer)
    const send = composer.getByRole("button", { name: "Send invite" })
    const box = await send.boundingBox()
    expect(box).not.toBeNull()
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
      SMALLEST_PHONE.height,
    )
    expect(box?.y ?? 0).toBeGreaterThanOrEqual(0)
  })

  for (const [language, verb] of [
    ["pt", "Convidar"],
    ["de", "einladen"],
  ]) {
    test(`in ${language}, a long name wraps the send to at most two lines and cuts nothing off`, async ({
      page,
    }) => {
      await signUp(page, uniqueUsername("locale"))
      await page.evaluate(
        ([key, value]) => localStorage.setItem(key, value),
        [LANGUAGE_STORAGE_KEY, language],
      )
      const composer = await openComposer(page)
      const longName = "abcdefghijklmnopqrst"
      await composer.getByRole("textbox").fill(longName)

      const send = composer.getByRole("button", {
        name: new RegExp(`${verb} ${longName}|${longName} ${verb}`),
      })
      await expect(send).toContainText(longName)
      const lines = await send.evaluate((button) => {
        const { lineHeight } = getComputedStyle(button)
        return Math.round(
          button.scrollHeight / Number.parseFloat(lineHeight),
        )
      })
      expect(lines).toBeLessThanOrEqual(2)
      // pinned: the whole button is on the screen, however far the body scrolls
      const box = await send.boundingBox()
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
        SMALLEST_PHONE.height,
      )
      // typing moved the body under the keyboard; what is cut off is read from
      // the top of it, once the field is let go and the sheet is back at rest
      const field = composer.getByRole("textbox")
      await field.blur()
      await waitForRest(composer)
      await expect
        .poll(async () => {
          await field.evaluate((input) => {
            for (let up = input.parentElement; up; up = up.parentElement) {
              if (up.scrollHeight > up.clientHeight) up.scrollTop = 0
            }
          })
          return (await field.boundingBox())?.y ?? -1
        })
        .toBeGreaterThanOrEqual(0)
      await expectNoClippedText(composer)
    })
  }
})

test.describe("on a 375x667 phone", () => {
  // a service worker would answer for the page and skip the mocked refusal
  test.use({
    viewport: { width: 375, height: 667 },
    serviceWorkers: "block",
  })

  test("the link card makes the link without moving anything, and the failed one says so and retries on a tap", async ({
    page,
  }) => {
    await copyToRecordedClipboard(page)
    await signUp(page, uniqueUsername("card"))
    const composer = await openComposer(page)

    // The first request is refused, the second goes through.
    let refused = false
    await page.route("**/api/v1/invite-links", async (route) => {
      if (route.request().method() !== "POST" || refused)
        return route.continue()
      refused = true
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin":
            route.request().headers().origin ?? "*",
          "access-control-allow-credentials": "true",
        },
        body: JSON.stringify({
          status: "error",
          error_code: "api_internal_server_error",
        }),
      })
    })

    const card = composer.getByRole("button", {
      name: /Invite with a link/,
    })
    await expectNoLayoutShift(composer, () => card.click(), {
      until: () =>
        expect(
          composer.getByText("Couldn't make it. Tap to retry"),
        ).toBeVisible(),
    })
    await expectNoClippedText(composer)

    await expectNoLayoutShift(composer, () => card.click(), {
      until: () =>
        expect(composer.getByLabel("Invite link")).toHaveValue(
          INVITE_LINK,
        ),
    })
    await expect(composer.getByText(/^Copied, lasts 7 days/)).toBeVisible()
    await expectNoClippedText(composer)
    await expectNoScrolling(composer)
  })

  test("Change opens the game panel, Done returns with the summary updated, and a link made before is dropped", async ({
    page,
  }) => {
    await copyToRecordedClipboard(page)
    await signUp(page, uniqueUsername("panel"))
    const composer = await openComposer(page)

    await expect(composer.getByText("You play either side")).toBeVisible()
    await composer
      .getByRole("button", { name: /Invite with a link/ })
      .click()
    await expect(composer.getByLabel("Invite link")).toHaveValue(
      INVITE_LINK,
    )

    await composer.getByRole("button", { name: "Change" }).click()
    await expect(
      composer.getByRole("button", { name: "Next board setup" }),
    ).toBeVisible()
    await expect(
      composer.getByRole("radio", { name: "Play as black" }),
    ).toBeVisible()
    await expect(
      composer.getByRole("button", { name: "Done" }),
    ).toBeVisible()
    await expectNoClippedText(composer)

    await composer.getByRole("radio", { name: "Play as black" }).click()
    await composer.getByRole("button", { name: "Done" }).click()

    await expect(composer.getByText("You play black")).toBeVisible()
    await expect(
      composer.getByRole("button", { name: /Invite with a link/ }),
    ).toBeVisible()
    await expect(composer.getByLabel("Invite link")).toBeHidden()
  })

  test("Back returns from the game panel and leaves the terms alone", async ({
    page,
  }) => {
    await signUp(page, uniqueUsername("back"))
    const composer = await openComposer(page)

    await composer.getByRole("button", { name: "Change" }).click()
    await composer.getByRole("button", { name: "Back" }).click()
    await expect(composer.getByText("You play either side")).toBeVisible()
    await expect(
      composer.getByRole("button", { name: "Send invite" }),
    ).toBeVisible()
  })

  test("typing a chip's name, in any case, checks that chip, and picking a chip clears the field", async ({
    browser,
  }) => {
    const { host, hostPage, guestName } =
      await hostWithOneOpponent(browser)
    await hostPage.setViewportSize({ width: 375, height: 667 })
    const composer = await openComposer(hostPage)
    const field = composer.getByLabel("Someone else", { exact: true })
    const chip = composer.getByRole("radio", {
      name: guestName,
      exact: true,
    })

    await field.fill(guestName.toUpperCase(), { timeout: 5000 })
    await expect(chip).toBeChecked({ timeout: 5000 })

    await field.fill("somebody")
    await expect(chip).not.toBeChecked()

    await field.fill("somebody")
    await chip.check({ timeout: 5000 })
    await expect(field).toHaveValue("")
    await expect(
      composer.getByRole("button", { name: `Invite ${guestName}` }),
    ).toBeVisible()

    // One radio group: the arrow keys are the chips' own.
    await chip.focus()
    await expect(chip).toBeFocused()
    await host.close()
  })

  test("while the games load the row holds four empty chips, and the chip lands in its place", async ({
    browser,
  }) => {
    const { host, hostPage } = await hostWithOneOpponent(browser)
    await hostPage.setViewportSize({ width: 375, height: 667 })

    // The saved copy of the games would fill the row at once: start without it.
    await hostPage.addInitScript(() => {
      indexedDB.deleteDatabase("keyval-store")
    })

    let release: () => void = () => {}
    const released = new Promise<void>((resolve) => {
      release = resolve
    })
    await hostPage.route(/\/api\/v1\/games\?/, async (route) => {
      await released
      await route.continue()
    })
    const composer = await openComposer(hostPage)

    await expect(composer.getByRole("radiogroup")).toHaveAttribute(
      "aria-busy",
      "true",
    )
    await expectNoLayoutShift(composer, async () => release(), {
      until: () => expect(composer.getByRole("radio")).toHaveCount(1),
    })
    await host.close()
  })
})
