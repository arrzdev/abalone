import type { Page } from "@playwright/test"
import { openApp } from "./support/app"
import { expectMarble, marbleOn } from "./support/board"
import { expect, test } from "./support/test"

// Each layout chapter on /starting-positions ends in a button that starts a
// game against the computer on that layout, in one tap. The generic play block
// at the end of the page still starts the default one.
//
// Every test starts from a fresh browser context, so from empty storage: a
// first game unless the test saves the guide's flag itself.
//
// No service worker, for the reason first-game-guide.spec.ts gives: webkit lets
// one test's worker claim another test's page and reload it mid-game.
test.use({ serviceWorkers: "block" })

const GUIDE_KEY = "abalone.guide.v1"

/** A phone's width, the one most of this page's visitors read it at. */
const PHONE = { width: 375, height: 667 }

type Layout = {
  label: string
  /** The chapter the button sits in. */
  chapter: string
  /** Three marbles that tell this layout from the other two, by square. */
  marbles: ReadonlyArray<readonly [string, "black" | "white"]>
}

const LAYOUTS: Layout[] = [
  {
    label: "Play the standard start",
    chapter: "standard",
    marbles: [
      ["a5", "black"],
      ["i9", "white"],
      ["c3", "black"],
    ],
  },
  {
    label: "Play the Belgian daisy",
    chapter: "belgian-daisy",
    marbles: [
      ["g8", "black"],
      ["c6", "white"],
      ["a5", "white"],
    ],
  },
  {
    label: "Play the German daisy",
    chapter: "german-daisy",
    marbles: [
      ["f7", "black"],
      ["f4", "white"],
      ["d3", "black"],
    ],
  },
]

/** Every square of the board, as the move list names them: rows a to i from
 * black's side, columns 1 to 9 along the row (a5 is black's middle rear). */
const SQUARES = Array.from({ length: 9 }, (_, i) => 4 - i).flatMap((r) =>
  Array.from({ length: 9 }, (_, i) => i - 4)
    .filter((q) => Math.abs(q + r) <= 4)
    .map((q) => `${"abcdefghi"[4 - r]}${q + 5}`),
)

/** How many marbles of each colour are on the board right now. */
async function marbleCounts(
  page: Page,
): Promise<{ black: number; white: number }> {
  const marbles = await Promise.all(
    SQUARES.map((square) => marbleOn(page, square)),
  )
  return {
    black: marbles.filter((marble) => marble === "black").length,
    white: marbles.filter((marble) => marble === "white").length,
  }
}

function chapterButton(page: Page, layout: Layout) {
  return page
    .locator(`section[aria-labelledby="${layout.chapter}"]`)
    .getByRole("link", { name: layout.label, exact: true })
}

for (const layout of LAYOUTS) {
  test(`${layout.label} opens the game on that layout at a phone's width`, async ({
    page,
  }) => {
    await page.setViewportSize(PHONE)
    await openApp(page, "/starting-positions")

    await chapterButton(page, layout).click()
    await expect(page).toHaveURL(/\/offline\?mode=ai$/)

    // the first board the player sees: 14 a side, and the diagram's squares
    for (const [square, colour] of layout.marbles) {
      await expectMarble(page, square, colour)
    }
    expect(await marbleCounts(page)).toEqual({ black: 14, white: 14 })
  })
}

test("a visitor who has finished the guide lands on the layout too, not the setup screen", async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  await page.addInitScript((key) => {
    localStorage.setItem(key, "done")
  }, GUIDE_KEY)
  await openApp(page, "/starting-positions")

  await chapterButton(page, LAYOUTS[1]).click()

  await expectMarble(page, "g8", "black")
  await expect(page.getByRole("button", { name: "Resign" })).toBeVisible()
})

test("the play block at the end of the page still starts the standard layout", async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  await openApp(page, "/starting-positions")

  await page
    .locator(`section[aria-labelledby="try-them"]`)
    .getByRole("link", { name: "Play against the computer" })
    .click()

  await expectMarble(page, "a5", "black")
  await expectMarble(page, "i9", "white")
  expect(await marbleCounts(page)).toEqual({ black: 14, white: 14 })
})

for (const width of [320, 1024]) {
  test(`the buttons are reachable and big enough at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 })
    await openApp(page, "/starting-positions")

    for (const layout of LAYOUTS) {
      const button = chapterButton(page, layout)
      await button.scrollIntoViewIfNeeded()
      const box = await button.boundingBox()
      expect(box?.width, layout.label).toBeGreaterThanOrEqual(44)
      expect(box?.height, layout.label).toBeGreaterThanOrEqual(44)

      // the accessible name is the visible text, nothing added
      await expect(button).toHaveText(layout.label)
      await button.focus()
      await expect(button).toBeFocused()
    }
  })
}
