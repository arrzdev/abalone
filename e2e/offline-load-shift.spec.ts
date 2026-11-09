import { expect, test } from "./support/test"

// The first visit to /offline on a desktop does not move once the page is in:
// whatever the setup screen is going to be, its box is the right size from the
// first frame. A second visit never showed the jump, which is why it takes a
// context with nothing cached, stored or signed in.

test.use({ viewport: { width: 1280, height: 800 } })

//Chromium only: no other engine reports layout shifts to a page
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "layout-shift entries exist in Chromium only",
)

const SETTLE_MS = 2_000
const MAX_SHIFT = 0.01

type Shift = {
  value: number
  at: number
  sources: string[]
}

test("a cold first load of /offline does not shift", async ({ page }) => {
  await page.addInitScript(() => {
    const shifts: Shift[] = []
    Object.assign(window, { shifts })
    const locate = (node: Node | null): string => {
      if (!(node instanceof Element)) return "?"
      const box = node.getBoundingClientRect()
      return `${node.tagName}.${[...node.classList].slice(0, 3).join(".")} y${Math.round(box.y)} h${Math.round(box.height)}`
    }
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          value: number
          hadRecentInput: boolean
          sources: { node: Node | null }[]
        }
        if (shift.hadRecentInput) continue
        shifts.push({
          value: shift.value,
          at: Math.round(shift.startTime),
          sources: shift.sources.map((source) => locate(source.node)),
        })
      }
    }).observe({ type: "layout-shift", buffered: true })
  })

  await page.goto("/offline")
  await page.waitForTimeout(SETTLE_MS)

  const shifts = await page.evaluate(
    () => (window as unknown as { shifts: Shift[] }).shifts,
  )
  expect(
    shifts.filter((shift) => shift.value > MAX_SHIFT),
    `layout shifts: ${JSON.stringify(shifts)}`,
  ).toEqual([])
})
