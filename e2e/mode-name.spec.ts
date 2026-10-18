import { readFileSync } from "node:fs"
import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, startOfflineGame } from "./support/app"

// Each offline mode has one name, and a player meets it in the same words on
// the setup tab, the game header and the browser tab (TUD-853). The computer
// mode used to be "vs Computer" on home, "Play Bots" in the game and "Play
// Offline" in the nav. Home names the action now, "Play now" (TUD-2287 C3), and
// the game it opens still has the mode's name.
//
// The game header is the phone's: above `lg` the app header replaces it, so on
// a desktop the tab title is the place that names the game.
//
// No service worker, for the reason first-game-guide.spec.ts gives.
test.use({ serviceWorkers: "block" })

const GUIDE_KEY = "abalone.guide.v1"
const LANGUAGE_KEY = "abalone_language"

const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
}

/** A locale's mode names, as the app reads them. */
function modeNames(locale: string): { computer: string; local: string } {
  const path = `apps/game/src/i18n/locales/${locale}/game.json`
  const controls = JSON.parse(readFileSync(path, "utf8")).controls
  return { computer: controls.mode_ai, local: controls.mode_local }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** The tab title of a game in progress: the mode, then the brand. */
function gameTitle(mode: string): RegExp {
  return new RegExp(`^${escapeRegExp(mode)} · Abalone$`)
}

/** The phone's header over the board, found by its back link. */
function gameHeader(page: Page, backLabel = "Back") {
  const back = page.getByRole("link", { name: backLabel })
  return page.locator("header").filter({ has: back }).locator("p").first()
}

/** Home's Play now, the computer game: a link, by its title in the locale. */
function homePlayNow(page: Page, title = "Play now") {
  return page
    .getByRole("main")
    .getByRole("link", { name: new RegExp(`^${escapeRegExp(title)}`) })
}

/** A home card, a tile under Play now. */
function homeCard(page: Page, name: string) {
  return page
    .getByRole("button", { name: new RegExp(escapeRegExp(name)) })
    .filter({ visible: true })
    .first()
}

for (const [size, viewport] of Object.entries(VIEWPORTS)) {
  const isPhone = size === "phone"

  test.describe(`on a ${size}`, () => {
    test.use({ viewport })

    test("home → Play now: the game is called vs Computer", async ({
      page,
    }) => {
      await openApp(page, "/")
      await homePlayNow(page).click()
      await expect(
        page.getByRole("button", { name: "Resign" }),
      ).toBeVisible()

      await expect(page).toHaveTitle(gameTitle("vs Computer"))
      if (isPhone) await expect(gameHeader(page)).toHaveText("vs Computer")
      await expect(page.getByText("Play Bots")).toHaveCount(0)
    })

    test("the setup screen for the computer names the mode, and so does the game it starts", async ({
      page,
    }) => {
      await page.addInitScript((key) => {
        localStorage.setItem(key, "done")
      }, GUIDE_KEY)
      await openApp(page, "/")
      await homePlayNow(page).click()

      await expect(
        page.getByRole("tab", { name: "vs Computer", selected: true }),
      ).toBeVisible()
      if (isPhone) {
        await expect(gameHeader(page)).toHaveText("New game · vs Computer")
      }

      await page.getByRole("button", { name: "Play", exact: true }).click()
      await expect(
        page.getByRole("button", { name: "Resign" }),
      ).toBeVisible()
      await expect(page).toHaveTitle(gameTitle("vs Computer"))
      if (isPhone) await expect(gameHeader(page)).toHaveText("vs Computer")
    })

    test("Pass & Play keeps its name in the same places", async ({
      page,
    }) => {
      await openApp(page, "/")
      await homeCard(page, "Pass & Play").click()

      await expect(
        page.getByRole("tab", { name: "Pass & Play", selected: true }),
      ).toBeVisible()
      if (isPhone) {
        await expect(gameHeader(page)).toHaveText("New game · Pass & Play")
      }

      await startOfflineGame(page, "Pass & Play")
      await expect(page).toHaveTitle(gameTitle("Pass & Play"))
      if (isPhone) await expect(gameHeader(page)).toHaveText("Pass & Play")
    })

    test("in Portuguese, the computer mode has its one Portuguese name", async ({
      page,
    }) => {
      const { computer } = modeNames("pt")
      await page.addInitScript(
        ([key, locale]) => {
          localStorage.setItem(key, locale)
        },
        [LANGUAGE_KEY, "pt"],
      )
      await openApp(page, "/")
      await homePlayNow(page, computer).click()
      await expect(
        page.getByRole("button", { name: "Desistir" }),
      ).toBeVisible()

      await expect(page).toHaveTitle(gameTitle(computer))
      if (isPhone)
        await expect(gameHeader(page, "Voltar")).toHaveText(computer)
    })
  })
}

// The nav item opens the setup screen, which has both modes on it, so it names
// neither. Only a desktop has the nav.
test.describe("the desktop nav", () => {
  test.use({ viewport: VIEWPORTS.desktop })

  test("calls the way to the setup screen Play", async ({ page }) => {
    await openApp(page, "/")
    const nav = page.getByRole("navigation", { name: "Main navigation" })

    await expect(
      nav.getByRole("link", { name: "Play", exact: true }),
    ).toHaveAttribute("href", "/offline")
    await expect(nav.getByText("Play Offline")).toHaveCount(0)
  })
})
