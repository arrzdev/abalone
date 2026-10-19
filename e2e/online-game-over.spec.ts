import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, startOnlineGame } from "./support/app"
import { expectMarble, playMove } from "./support/board"
import { expectNoClippedText } from "./support/layout"

// Every locale the app ships, by the code the settings sheet stores.
const LOCALES = [
  "en",
  "pt",
  "de",
  "es",
  "fr",
  "it",
  "nl",
  "pl",
  "tr",
  "hi",
  "ja",
  "ko",
  "zh",
] as const

const LANGUAGE_STORAGE_KEY = "abalone_language"

/** How many lines the text of a button runs to, its icon left out. */
function labelLines(button: Locator): Promise<number> {
  return button.evaluate((element) => {
    const tops = new Set<number>()
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const rect of range.getClientRects())
        if (rect.width > 0) tops.add(Math.round(rect.top))
    }
    return tops.size
  })
}

/**
 * The two buttons under the finished game's move list: each label on one line,
 * each with an icon, and the way back to the list not drawn as a `+`.
 */
async function expectPostgameButtonsFit(
  page: Page,
  where: string,
): Promise<void> {
  const panel = page.locator("aside").filter({ visible: true })
  const buttons = panel
    .getByRole("button")
    .filter({ hasText: /\S/ })
    .filter({ visible: true })
    // The move list's rows are labelled buttons too, and draw no icon.
    .filter({ has: page.locator("svg") })
  await expect(buttons, `${where}: two labelled buttons`).toHaveCount(2)

  for (const button of await buttons.all()) {
    const label = (await button.innerText()).trim()
    expect(await labelLines(button), `${where}: "${label}" wraps`).toBe(1)
    await expect(
      button.locator("svg"),
      `${where}: "${label}" keeps its icon`,
    ).toHaveCount(1)
    await expect(
      button.locator("svg.lucide-plus"),
      `${where}: "${label}" is not a new game, so no +`,
    ).toHaveCount(0)
    // The button, not the panel: the move list above scrolls to its end, and
    // the row it scrolled past is cut by its own scroller on purpose.
    await expectNoClippedText(button)
  }
}

// The result sheet is news once. Opening a finished game again goes straight
// to the board and its record, and the buttons under it fit on a phone in
// every language.
test("an online game's result sheet shows once, and the finished game's buttons fit on one line", async ({
  browser,
}) => {
  // Two phone browsers and a live game, then a reload per locale and width.
  test.slow()

  const { host, guest, hostPage, guestPage } =
    await startOnlineGame(browser)

  await playMove(hostPage, "c5", "d5")
  await expectMarble(guestPage, "d5", "black")

  await guestPage.getByRole("button", { name: "Resign" }).click()
  await guestPage
    .getByRole("dialog")
    .filter({ hasText: "Resign the game?" })
    .getByRole("button", { name: "Resign" })
    .click()

  const result = guestPage
    .getByRole("dialog")
    .filter({ hasText: "Game over" })
  await expect(result.getByText("You lost")).toBeVisible()

  // Not dismissed: having seen it is enough. A reload is the game opened again.
  const gameUrl = new URL(guestPage.url()).pathname
  await openApp(guestPage, gameUrl)
  await expect(guestPage.getByText("This game is over")).toBeVisible()
  await expect(guestPage.getByText("You lost")).toHaveCount(0)
  await expect(
    guestPage.getByRole("dialog").filter({ hasText: "Game over" }),
  ).toHaveCount(0)

  // The other player, who watched it end live, also sees it only once.
  await expect(
    hostPage.getByRole("dialog").filter({ hasText: "Game over" }),
  ).toBeVisible({ timeout: 30_000 })
  await openApp(hostPage, gameUrl)
  await expect(hostPage.getByText("This game is over")).toBeVisible()
  await expect(
    hostPage.getByRole("dialog").filter({ hasText: "Game over" }),
  ).toHaveCount(0)

  // 320 is the narrowest phone, so every locale is checked there; the two the
  // players use most are checked at the common widths too.
  const runs = [
    ...LOCALES.map((locale) => ({ width: 320, locale })),
    ...(["en", "pt"] as const).flatMap((locale) =>
      [375, 402].map((width) => ({ width, locale })),
    ),
  ]
  for (const { width, locale } of runs) {
    await guestPage.setViewportSize({ width, height: 700 })
    await guestPage.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      [LANGUAGE_STORAGE_KEY, locale],
    )
    await openApp(guestPage, gameUrl)
    await expect(guestPage.locator("html")).toHaveAttribute("lang", locale)
    await expect(guestPage.getByRole("dialog")).toHaveCount(0)
    await expectPostgameButtonsFit(guestPage, `${locale} at ${width}`)
  }

  await host.close()
  await guest.close()
})
