import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, startOfflineGame } from "./support/app"
import { moveList, playMove } from "./support/board"

// The site's CSP has no 'unsafe-eval', so the app must never reach for eval or
// the Function constructor: not even a caught probe, which still files a
// violation report. Both are wrapped before any page script runs, and every
// call from a page script is recorded. Playwright's page.evaluate runs through
// eval too, but no frame of its stack comes from a URL.
async function recordEvalCalls(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const calls: string[] = []
    Object.defineProperty(window, "__evalCalls", { value: calls })
    const record = (name: string) => {
      const stack = new Error().stack ?? ""
      if (/https?:\/\//.test(stack)) calls.push(`${name}\n${stack}`)
    }

    const NativeFunction = window.Function
    window.Function = new Proxy(NativeFunction, {
      apply(target, thisArg, args) {
        record("Function()")
        return Reflect.apply(target, thisArg, args)
      },
      construct(target, args, newTarget) {
        record("new Function()")
        return Reflect.construct(target, args, newTarget)
      },
    })
    // biome-ignore lint/security/noGlobalEval: wrapped to record calls, never called here
    const nativeEval = window.eval
    window.eval = new Proxy(nativeEval, {
      apply(target, thisArg, args) {
        record("eval()")
        return Reflect.apply(target, thisArg, args)
      },
    })
  })
}

function evalCalls(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as { __evalCalls: string[] }).__evalCalls,
  )
}

test("home and a game against the computer never call eval or Function", async ({
  page,
}) => {
  await recordEvalCalls(page)

  await openApp(page, "/")
  expect(await evalCalls(page), "calls on home").toEqual([])

  await startOfflineGame(page, "vs Computer")
  await playMove(page, "c5", "d5")
  await expect(moveList(page)).toHaveCount(2, { timeout: 30_000 })

  expect(await evalCalls(page), "calls in the game").toEqual([])
})
