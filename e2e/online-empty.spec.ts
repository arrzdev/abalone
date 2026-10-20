import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, signUp, uniqueUsername } from "./support/app"

// The empty online page (TUD-850): an account with no games and no invites.
// Its friends are not on Abalone yet, so the page leads with a link to send
// them, keeps a bot game one tap away, and still offers invite by username.
// Design: docs/invite-links.md, "The empty online page".

const EMPTY_TITLE = "Nothing here yet"
const INVITE_LINK = /\/invite\/[A-Za-z0-9_-]{43}$/

/**
 * Replaces the share sheet with a recorder, so a test can see what the app
 * handed it. `null` takes the share sheet away instead, which is a desktop
 * browser: the app copies to a recorded clipboard then.
 */
async function recordHandOff(
  page: Page,
  shareSheet: "present" | "absent",
): Promise<void> {
  await page.addInitScript((mode) => {
    const record = { shared: [] as ShareData[], copied: [] as string[] }
    Object.assign(window, { __handOff: record })
    if (mode === "present") {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: ShareData) => {
          record.shared.push(data)
        },
      })
    } else {
      // `"share" in navigator` is what the app asks, so the property has to go
      // from the prototype, not be set to undefined
      delete (Navigator.prototype as { share?: unknown }).share
      delete (navigator as { share?: unknown }).share
    }
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          record.copied.push(text)
        },
      },
    })
  }, shareSheet)
}

function handOff(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __handOff: { shared: ShareData[]; copied: string[] }
        }
      ).__handOff,
  )
}

/** Signs a fresh account up and opens its online page, empty. */
async function openEmptyOnline(page: Page): Promise<string> {
  const username = uniqueUsername("fresh")
  await signUp(page, username)
  await openApp(page, "/online")
  await expect(
    page.getByRole("heading", { name: EMPTY_TITLE }),
  ).toBeVisible()
  return username
}

function emptyActions(page: Page) {
  const main = page.locator("main")
  return {
    link: main.getByRole("button", { name: "Invite with a link" }),
    bot: main.getByRole("button", { name: "Play a bot" }),
    byName: main.getByRole("link", { name: "Invite by username" }),
  }
}

/** Waits for the one request that makes the link and hands back its URL. */
function linkCreated(page: Page): Promise<string> {
  return page
    .waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/v1/invite-links",
    )
    .then(async (response) => {
      expect(response.status()).toBe(201)
      const body = await response.json()
      return body.data.url as string
    })
}

/** Another browser, signed out, opens the link and finds who sent it. */
async function expectLinkOpensFor(
  page: Page,
  url: string,
  sender: string,
): Promise<void> {
  const visitor = await page.context().browser()?.newContext()
  if (!visitor) throw new Error("no browser to open the link in")
  const visitorPage = await visitor.newPage()
  await openApp(visitorPage, new URL(url).pathname)
  await expect(
    visitorPage.getByRole("heading", {
      name: `${sender} invited you to a game of Abalone`,
    }),
  ).toBeVisible()
  await visitor.close()
}

test("a new account shares an invite link in one tap", async ({
  page,
}) => {
  await recordHandOff(page, "present")
  const username = await openEmptyOnline(page)

  // The page says how a game starts without asking for anybody's username.
  const main = page.locator("main")
  const body = main.locator("h1 + p")
  await expect(body).toBeVisible()
  await expect(body).not.toContainText(/username|by name/i)

  const created = linkCreated(page)
  await emptyActions(page).link.click()
  const url = await created
  expect(url).toMatch(INVITE_LINK)

  // One tap: the share sheet got the link, nothing else was pressed.
  await expect
    .poll(async () => (await handOff(page)).shared.length)
    .toBe(1)
  const [shared] = (await handOff(page)).shared
  expect(shared.url).toBe(url)
  expect(shared.text).toBe(
    "Want a game of Abalone? Open this link to play me.",
  )

  // The link stays on screen to send again.
  await expect(main.getByLabel("Invite link")).toHaveValue(url)

  await expectLinkOpensFor(page, url, username)
})

test("without a share sheet, one tap copies the link and says so", async ({
  page,
}) => {
  await recordHandOff(page, "absent")
  const username = await openEmptyOnline(page)

  const created = linkCreated(page)
  await emptyActions(page).link.click()
  const url = await created

  await expect
    .poll(async () => (await handOff(page)).copied)
    .toEqual([url])
  await expect(
    page.getByText("Link copied", { exact: true }),
  ).toBeVisible()
  expect((await handOff(page)).shared).toEqual([])

  await expectLinkOpensFor(page, url, username)
})

test("play a bot opens the computer game", async ({ page }) => {
  await openEmptyOnline(page)

  await emptyActions(page).bot.click()

  await expect(page).toHaveURL(/\/offline\?mode=ai$/)
  await expect(page.getByRole("button", { name: "Resign" })).toBeVisible()
})

test("invite by username is still there, under the buttons", async ({
  page,
}) => {
  await openEmptyOnline(page)

  await emptyActions(page).byName.click()

  await expect(page).toHaveURL(/\/online\?invite=new$/)
  await expect(
    page.getByRole("dialog").getByLabel("Opponent", { exact: true }),
  ).toBeVisible()
})

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`at ${viewport.width}×${viewport.height} the link comes first, then the bot, then the username`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "layout: one engine is enough")
    await page.setViewportSize(viewport)
    await openEmptyOnline(page)

    const { link, bot, byName } = emptyActions(page)
    for (const action of [link, bot, byName])
      await expect(action).toBeInViewport()

    const [linkBox, botBox, byNameBox] = await Promise.all(
      [link, bot, byName].map((action) => action.boundingBox()),
    )
    if (!linkBox || !botBox || !byNameBox) throw new Error("no layout")
    expect(linkBox.y).toBeLessThan(botBox.y)
    expect(botBox.y).toBeLessThan(byNameBox.y)
    // Thumb-sized: the two buttons, and the text link's hit area.
    expect(linkBox.height).toBeGreaterThanOrEqual(52)
    expect(botBox.height).toBeGreaterThanOrEqual(52)
    expect(byNameBox.height).toBeGreaterThanOrEqual(44)

    // The link is the first thing a keyboard reaches on the page.
    await link.focus()
    await page.keyboard.press("Tab")
    await expect(bot).toBeFocused()
    await page.keyboard.press("Tab")
    await expect(byName).toBeFocused()

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
}

test("with an invite out, the online page is the usual list", async ({
  browser,
}) => {
  const host = await browser.newContext()
  const friend = await browser.newContext()
  const hostPage = await host.newPage()
  const friendPage = await friend.newPage()

  const friendName = uniqueUsername("friend")
  await signUp(friendPage, friendName)
  await openEmptyOnline(hostPage)

  await emptyActions(hostPage).byName.click()
  const composer = hostPage.getByRole("dialog")
  await composer.getByLabel("Opponent", { exact: true }).fill(friendName)
  await composer.getByRole("button", { name: "Send invite" }).click()
  await expect(composer).toBeHidden()

  // Sent or received, an open invite makes it the usual hub, with its own
  // "New invite" button and none of the empty page.
  for (const page of [hostPage, friendPage]) {
    await openApp(page, "/online")
    await expect(
      page
        .locator("main")
        .getByRole("button", { name: "New invite" })
        .filter({ visible: true })
        .first(),
    ).toBeVisible({ timeout: 30_000 })
    await expect(
      page.getByRole("heading", { name: EMPTY_TITLE }),
    ).toHaveCount(0)
    await expect(emptyActions(page).link).toHaveCount(0)
    await expect(emptyActions(page).byName).toHaveCount(0)
  }

  await host.close()
  await friend.close()
})
