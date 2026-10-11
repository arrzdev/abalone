import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, startOfflineGame } from "./support/app"
import { moveList, playMove } from "./support/board"

// Every line of text reads at WCAG AA: 4.5:1 against its background, the
// secondary grey and the label on a blue button included. axe's
// `color-contrast` rule measures what the browser paints, at both widths.

const WIDTHS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
]

async function expectReadableText(page: Page, screen: string) {
  const results = await new AxeBuilder({ page })
    .withRules(["color-contrast"])
    .analyze()
  const failures = results.violations.flatMap((violation) =>
    violation.nodes.map(
      (node) => `${node.target.join(" ")}: ${node.failureSummary}`,
    ),
  )
  // Soft, so one run lists every page that falls short, not only the first.
  expect.soft(failures, `${screen} text below 4.5:1`).toEqual([])
}

for (const { name, width, height } of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height } })

    test(`home, rules and New Game text is readable on a ${name}`, async ({
      page,
    }) => {
      for (const path of ["/", "/rules", "/offline"]) {
        await openApp(page, path)
        await expectReadableText(page, path)
      }
    })

    test(`a game against a bot is readable on a ${name}`, async ({
      page,
    }) => {
      await startOfflineGame(page, "vs Computer")
      // A move and the bot's reply fill the move list with numbers and moves.
      await playMove(page, "c5", "d5")
      await expect(moveList(page)).toHaveCount(2, { timeout: 30_000 })
      await expectReadableText(page, "game")
    })
  })
}
