import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"
import {
  marbleOn,
  moveList,
  selectSquare,
  tapSquare,
} from "./support/board"

// A first-time visitor's first game against the computer opens on the board:
// Gus, the standard layout, black, and the guide's first step. The setup screen
// is one press away ("New game") for whoever wants another bot, layout or side.
// Once the guide is finished or skipped, "vs Computer" opens the setup screen
// as it always did. Pass & Play is not touched: its setup asks for the names.
//
// Every test starts from a fresh browser context, so from empty storage: a
// first game unless the test saves the guide's flag itself.
//
// No service worker, for the reason first-game-guide.spec.ts gives: webkit lets
// one test's worker claim another test's page and reload it mid-game.
test.use({ serviceWorkers: "block" })

const GUIDE_KEY = "abalone.guide.v1"

const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
}

type GameEvent = {
  gameRef: string
  kind: "start" | "finish"
  mode: string
  botLevel?: number | null
  guided?: boolean
  result?: string
}

/** Every game event the page sends from now on, read off the wire. */
function recordGameEvents(page: Page): GameEvent[] {
  const events: GameEvent[] = []
  page.on("request", (request) => {
    if (request.method() !== "POST") return
    if (!request.url().endsWith("/api/v1/events/game")) return
    events.push(JSON.parse(request.postData() ?? "{}") as GameEvent)
  })
  return events
}

function starts(events: GameEvent[]): GameEvent[] {
  return events.filter((event) => event.kind === "start")
}

/** The guide, a labelled region next to the board. */
function guide(page: Page) {
  return page.getByRole("region", { name: "How to move" })
}

/** The setup screen's mode switch, which only the setup screen has. */
function setupSwitch(page: Page) {
  return page.getByRole("tab", { name: "vs Computer" })
}

/**
 * Remembers, from now until the test reads it, whether the setup screen was
 * ever on the page. Checking only the end state would pass a page that shows
 * the setup screen and then starts the game by itself a moment later.
 *
 * Installed on the page that is already loaded: the way to the board is a
 * client-side navigation, so the document and this observer stay.
 */
async function watchForSetupScreen(page: Page): Promise<void> {
  await page.evaluate(() => {
    const probe = window as unknown as { __sawSetup?: boolean }
    probe.__sawSetup = false
    const check = () => {
      for (const tab of document.querySelectorAll('[role="tab"]')) {
        if (tab.textContent?.includes("vs Computer"))
          probe.__sawSetup = true
      }
    }
    new MutationObserver(check).observe(document.body, {
      childList: true,
      subtree: true,
    })
  })
}

function sawSetupScreen(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      (window as unknown as { __sawSetup?: boolean }).__sawSetup === true,
  )
}

/** Home's "vs Computer" card. */
function homeComputerButton(page: Page) {
  return page
    .getByRole("button", { name: /vs Computer/ })
    .filter({ visible: true })
    .first()
}

/**
 * Whether this screen shows the first-game guide: only with the panel beside
 * the board. Under it, on a phone, there is no room for a step's whole text
 * (TUD-1127). 1024px is where the panel goes beside the board on a desktop.
 */
function showsGuide(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= 1024
}

/** The opponent's seat names the bot, so the board says who you are playing. */
async function expectBoardAgainstGus(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Resign" })).toBeVisible()
  await expect(setupSwitch(page)).toHaveCount(0)
  await expect(
    page
      .getByText("Gus", { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible()
  if (showsGuide(page)) {
    await expect(guide(page)).toBeVisible()
    await expect(guide(page)).toContainText("Step 1 of 3")
  } else {
    await expect(guide(page)).toHaveCount(0)
  }
  // The standard layout, with the player on black: black's c5 is theirs to
  // move, and black moves first.
  expect(await marbleOn(page, "c5")).toBe("black")
  expect(await marbleOn(page, "g5")).toBe("white")
}

for (const [size, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`on a ${size}`, () => {
    test.use({ viewport })

    test("the first game against the computer opens on the board, and the first move is three taps from home", async ({
      page,
    }) => {
      const events = recordGameEvents(page)
      await openApp(page, "/")
      await watchForSetupScreen(page)

      // Tap 1.
      await homeComputerButton(page).click()
      await expect(page).toHaveURL(/\/offline/)
      await expectBoardAgainstGus(page)
      expect(await sawSetupScreen(page), "the setup screen showed").toBe(
        false,
      )

      // Taps 2 and 3: a marble, then a highlighted space next to it.
      await selectSquare(page, "c5")
      await tapSquare(page, "d5")
      await expect(moveList(page).first()).toHaveText("c5d5")

      // One game started, counted once, against Gus, guided where the
      // guide shows.
      await expect.poll(() => starts(events).length).toBe(1)
      expect(starts(events)[0]).toMatchObject({
        kind: "start",
        mode: "ai",
        botLevel: 1,
        guided: showsGuide(page),
      })
      // Nothing more once the bot has answered: still the one start.
      await expect(moveList(page)).toHaveCount(2, { timeout: 30_000 })
      expect(starts(events)).toHaveLength(1)
    })

    test("after the guide is done, vs Computer opens the setup screen", async ({
      page,
    }) => {
      await page.addInitScript((key) => {
        localStorage.setItem(key, "done")
      }, GUIDE_KEY)
      const events = recordGameEvents(page)
      await openApp(page, "/")

      await homeComputerButton(page).click()
      await expect(page).toHaveURL(/\/offline/)
      await expect(setupSwitch(page)).toBeVisible()
      await expect(
        page.getByRole("button", { name: "Play", exact: true }),
      ).toBeVisible()
      await expect(
        page.getByRole("button", { name: "Resign" }),
      ).toHaveCount(0)
      // Nothing has started yet, so nothing is counted.
      await page.waitForTimeout(500)
      expect(starts(events)).toEqual([])
    })
  })
}

// The links that offer a game against the computer from the two reading pages
// lead to the same board on a first game. Each page has two play buttons
// (play-block.spec.ts); the first, under the intro, stands for them.
const READING_PAGE_LINKS = [
  { path: "/rules", name: "Play against the computer" },
  { path: "/rules", name: "try it against the computer" },
  { path: "/strategy", name: "Play against the computer" },
  { path: "/strategy", name: "free game against the computer" },
]

for (const { path, name } of READING_PAGE_LINKS) {
  test(`"${name}" on ${path} opens a first game on the board`, async ({
    page,
  }) => {
    const events = recordGameEvents(page)
    await openApp(page, path)
    await watchForSetupScreen(page)

    await page.getByRole("link", { name, exact: true }).first().click()
    await expect(page).toHaveURL(/\/offline/)
    await expectBoardAgainstGus(page)
    expect(await sawSetupScreen(page), "the setup screen showed").toBe(
      false,
    )

    await expect.poll(() => starts(events)).toHaveLength(1)
    expect(starts(events)[0]).toMatchObject({ mode: "ai", botLevel: 1 })
  })
}

// Pass & Play keeps its setup screen on a first game: the names are asked there.
test("a first Pass & Play game still opens on its setup screen", async ({
  page,
}) => {
  await openApp(page, "/")
  await page
    .getByRole("button", { name: /Pass & Play/ })
    .filter({ visible: true })
    .first()
    .click()
  await expect(page).toHaveURL(/mode=local/)
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Resign" })).toHaveCount(0)
})

// The setup screen is one press from that first board, and what is chosen there
// is the game that starts. The first game is left, so it is counted as abandoned
// rather than lost.
test("New game on the first board opens the setup screen, and the side chosen there is the next game's", async ({
  page,
}) => {
  const events = recordGameEvents(page)
  await openApp(page, "/")
  await homeComputerButton(page).click()
  await expectBoardAgainstGus(page)
  await expect.poll(() => starts(events)).toHaveLength(1)

  // One press.
  await page
    .getByRole("button", { name: /new game/i })
    .filter({ visible: true })
    .first()
    .click()
  await expect(setupSwitch(page)).toBeVisible()

  await page.getByRole("radio", { name: "White" }).click()
  await page.getByRole("button", { name: "Play", exact: true }).click()
  await expect(page.getByRole("button", { name: "Resign" })).toBeVisible()

  // Playing white, so the bot opens: a move appears without one from here.
  await expect(moveList(page)).toHaveCount(1, { timeout: 30_000 })

  await expect.poll(() => starts(events)).toHaveLength(2)
  const [first, second] = starts(events)
  expect(second).toMatchObject({ kind: "start", mode: "ai" })
  expect(second.gameRef).not.toBe(first.gameRef)
  const left = events.find(
    (event) => event.kind === "finish" && event.gameRef === first.gameRef,
  )
  expect(left).toMatchObject({ result: "abandoned" })
})
