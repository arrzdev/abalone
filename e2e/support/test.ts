import type { Browser, BrowserContext } from "@playwright/test"
import { test as base, expect } from "@playwright/test"

/**
 * `test` for every spec: the Playwright one, plus a guard that fails the spec
 * when the page breaks its own Content-Security-Policy. The policy is enforced
 * (apps/game/src/server/security-headers.ts), so a violation is a script, style,
 * image or request the browser refused, which a spec that only looks at the
 * page might never notice.
 *
 * A violation is read two ways: the `securitypolicyviolation` event in every
 * page and frame, and the console error each browser prints for it, which is
 * the only sign of one in a worker. `e2e/csp.spec.ts` keeps every spec on this
 * `test`, and checks the guard itself.
 */

const REPORT_BINDING = "reportCspViolation"
const CONSOLE_VIOLATION = /Content[- ]Security[- ]Policy|Refused to/i

//runs in every document before its own scripts; the binding is exposed on the context
const listenForViolations = `
  document.addEventListener("securitypolicyviolation", (event) => {
    window.${REPORT_BINDING}?.(
      event.violatedDirective +
        " blocked " + (event.blockedURI || "inline") +
        " (" + event.disposition + ") on " + event.documentURI,
    )
  })
`

async function watchContext(
  context: BrowserContext,
  violations: string[],
): Promise<void> {
  await context.exposeFunction(REPORT_BINDING, (violation: string) => {
    violations.push(violation)
  })
  await context.addInitScript(listenForViolations)
  context.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return
    if (CONSOLE_VIOLATION.test(message.text()))
      violations.push(`console: ${message.text()}`)
  })
}

/**
 * Every context a spec opens is watched, whether it comes from the `page`
 * fixture or from `browser.newContext()` (a second player). Returns the undo.
 */
function watchEveryContext(
  browser: Browser,
  violations: string[],
): () => void {
  const openContext = browser.newContext.bind(browser)
  browser.newContext = async (options) => {
    const context = await openContext(options)
    await watchContext(context, violations)
    return context
  }
  return () => {
    browser.newContext = openContext
  }
}

export const test = base.extend<{
  /** What this spec's pages broke; a spec that provokes one on purpose clears it. */
  cspViolations: string[]
}>({
  cspViolations: [
    async ({ browser }, use) => {
      const violations: string[] = []
      const stopWatching = watchEveryContext(browser, violations)
      await use(violations)
      stopWatching()
      expect(violations, "Content-Security-Policy violations").toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
