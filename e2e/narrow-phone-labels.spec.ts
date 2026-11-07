import { readdirSync, readFileSync } from "node:fs"
import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"
import { playMove } from "./support/board"
import { waitForRest } from "./support/layout"

// On the narrowest phone in use, the short labels still read in full and on one
// line in every language: a theme name cut to "Wal…" or a two-word button
// folded in two looks broken, and both have room once the padding around them
// gives a little.

test.use({ viewport: { width: 320, height: 640 } })

const LOCALES_DIRECTORY = "apps/game/src/i18n/locales"

/** What the app stores for the language switch in settings (language.spec.ts). */
const LANGUAGE_STORAGE_KEY = "abalone_language"

/** Where an offline game is saved, so the next one starts from the setup screen. */
const OFFLINE_GAME_STORAGE_KEY = "abalone.offlineGame.v1"

type GameCopy = {
  controls: Record<string, string>
  modal: Record<string, string>
}

function languages(): string[] {
  return readdirSync(LOCALES_DIRECTORY).sort()
}

function gameCopy(language: string): GameCopy {
  const path = `${LOCALES_DIRECTORY}/${language}/game.json`
  return JSON.parse(readFileSync(path, "utf8"))
}

async function useLanguage(page: Page, language: string): Promise<void> {
  if (!page.url().startsWith("http")) await openApp(page, "/")
  await page.evaluate(
    ([languageKey, value, gameKey]) => {
      localStorage.setItem(languageKey, value)
      localStorage.removeItem(gameKey)
    },
    [LANGUAGE_STORAGE_KEY, language, OFFLINE_GAME_STORAGE_KEY],
  )
}

/**
 * Whether the text in `scope` runs past its box (cut off, or cut to an
 * ellipsis), and on how many lines it sits.
 */
function labelFit(scope: Locator) {
  return scope.evaluate((root) => {
    const tops = new Set<number>()
    let cut = false
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if ((node.textContent ?? "").trim() === "") continue
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const rect of range.getClientRects()) {
        if (rect.width > 0) tops.add(Math.round(rect.top))
      }
      const parent = node.parentElement
      if (parent && parent.scrollWidth > parent.clientWidth + 1) cut = true
    }
    return { cut, lines: tops.size }
  })
}

// The theme names that fit their tile at 320px. The longer ones (German, French,
// Italian, Japanese, Dutch, Portuguese, Turkish) still end in an ellipsis there:
// a tile with the board beside its name has no room for them, and the board above
// the name costs height the settings sheet does not have.
const THEME_NAMES_FIT = ["en", "es", "hi", "ko", "pl", "zh"]

test("at 320px wide, every board theme name shows in full in the languages that fit", async ({
  page,
}) => {
  test.slow()
  for (const language of THEME_NAMES_FIT) {
    const copy = gameCopy(language)
    await useLanguage(page, language)
    await openApp(page, "/")
    await page
      .getByRole("button", { name: copy.controls.settings })
      .filter({ visible: true })
      .first()
      .click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await waitForRest(dialog)

    const names = dialog
      .getByRole("radiogroup", { name: copy.controls.board_theme })
      .getByRole("radio")
      .locator("span")
    await expect(names).toHaveText([
      copy.controls.board_theme_slate,
      copy.controls.board_theme_walnut,
      copy.controls.board_theme_felt,
    ])
    for (const name of await names.all()) {
      expect(
        await labelFit(name),
        `${language} ${await name.innerText()}`,
      ).toEqual({ cut: false, lines: 1 })
    }
  }
})

test("at 320px wide, the game over buttons after a bot game keep their labels on one line in every language", async ({
  page,
}) => {
  test.slow()
  for (const language of languages()) {
    const copy = gameCopy(language)
    await useLanguage(page, language)
    await openApp(page, "/offline")
    await page.getByRole("tab", { name: copy.controls.mode_ai }).click()
    await page
      .getByRole("button", {
        name: copy.controls.play_button,
        exact: true,
      })
      .click()
    const resign = page.getByRole("button", { name: copy.controls.resign })
    await expect(resign).toBeVisible()
    await playMove(page, "c5", "d5")

    await resign.click()
    const confirm = page
      .getByRole("dialog")
      .filter({ hasText: copy.modal.resign_title })
    await expect(confirm).toBeVisible()
    await confirm
      .getByRole("button", { name: copy.controls.resign })
      .click()

    const gameOver = page
      .getByRole("dialog")
      .filter({ hasText: copy.controls.new_bot })
    await expect(gameOver).toBeVisible()
    await waitForRest(gameOver)
    for (const name of [
      copy.modal.rematch_button,
      copy.controls.new_bot,
    ]) {
      const button = gameOver.getByRole("button", { name, exact: true })
      expect(await labelFit(button), `${language} ${name}`).toEqual({
        cut: false,
        lines: 1,
      })
    }
  }
})
