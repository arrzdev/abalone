import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, startOfflineGame } from "./support/app"

// Every bot and pass and play start says which kind of page the tab first
// landed on (home, rules, strategy, invite, other), so the counts show whether
// the rules and strategy pages bring games. Kept for the tab's life in
// sessionStorage: a reload or a walk through the app does not move it, a new
// tab starts over. Only the kind of page is sent, never the address.
//
// Every test starts from a fresh browser context, so from an empty tab.
// No service worker: on webkit one test's worker can claim another test's
// page and reload it mid-game (see first-game-guide.spec.ts).
test.use({ serviceWorkers: "block" })

type StartEvent = Record<string, unknown> & {
  kind?: string
  entry?: unknown
}

/** Every game start the page sends from now on, read off the wire. */
function recordStarts(page: Page): StartEvent[] {
  const starts: StartEvent[] = []
  page.on("request", (request) => {
    if (request.method() !== "POST") return
    if (!request.url().endsWith("/api/v1/events/game")) return
    const event = JSON.parse(request.postData() ?? "{}") as StartEvent
    if (event.kind === "start") starts.push(event)
  })
  return starts
}

test("a game started after reading the rules is counted as landed on the rules", async ({
  page,
}) => {
  const starts = recordStarts(page)

  await openApp(page, "/rules?utm_source=search")
  await startOfflineGame(page, "vs Computer")

  await expect.poll(() => starts.length).toBe(1)
  expect(starts[0]).toMatchObject({ mode: "ai", entry: "rules" })
  // The kind of page, nothing of the address it came from.
  expect(JSON.stringify(starts[0])).not.toContain("utm")
  expect(JSON.stringify(starts[0])).not.toContain("/rules")
})

test("the landing page stays the same for the rest of the tab, reloads included", async ({
  page,
}) => {
  const starts = recordStarts(page)

  await openApp(page, "/strategy")
  await openApp(page, "/")
  await startOfflineGame(page, "Pass & Play")
  // Loads /offline afresh: the reload. Not page.reload() first, since two
  // loads back to back cancel each other's route preloads on webkit.
  await startOfflineGame(page, "vs Computer")

  await expect.poll(() => starts.length).toBe(2)
  expect(starts.map((start) => [start.mode, start.entry])).toEqual([
    ["local", "strategy"],
    ["ai", "strategy"],
  ])
})

test("a tab that opens straight on the game is counted as another page, and a new tab starts over", async ({
  page,
  browser,
}) => {
  const starts = recordStarts(page)

  await startOfflineGame(page, "vs Computer")

  await expect.poll(() => starts.length).toBe(1)
  expect(starts[0].entry).toBe("other")

  // A tab of its own: sessionStorage is per tab, so it lands afresh.
  const context = await browser.newContext({ serviceWorkers: "block" })
  const home = await context.newPage()
  const homeStarts = recordStarts(home)
  await openApp(home, "/")
  await startOfflineGame(home, "vs Computer")

  await expect.poll(() => homeStarts.length).toBe(1)
  expect(homeStarts[0].entry).toBe("home")
  await context.close()
})
