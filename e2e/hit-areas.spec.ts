import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp, startOfflineGame } from "./support/app"
import { playMove } from "./support/board"

// Every control on a phone is a 44×44 thumb target (TUD-554 §3, D3). What is
// measured is the element's own box, the same box the devtools check reads:
// a control drawn smaller than that grows its box with padding, and keeps its
// look.
//
// Two things are not controls on their own. A visually hidden input is pressed
// through its label, so the label is what has to fit a thumb. A link inside a
// paragraph is part of a line of text, and stays the height of that line.

const TAP_TARGET = 44

test.use({ viewport: { width: 390, height: 844 } })

/** Every visible control under `scope` smaller than a thumb, as "name w×h". */
function tooSmall(scope: Locator): Promise<string[]> {
  return scope.evaluate((root, minimum) => {
    const controls = root.querySelectorAll<HTMLElement>(
      "button, a, input, [role=button]",
    )
    const found: string[] = []
    for (const control of controls) {
      if (!control.checkVisibility({ visibilityProperty: true })) continue
      if (control.closest("p") !== null && control.tagName === "A")
        continue

      let target: HTMLElement = control
      const box = control.getBoundingClientRect()
      if (
        control instanceof HTMLInputElement &&
        (box.width <= 1 || box.height <= 1)
      ) {
        const label = control.labels?.[0]
        if (label === undefined) continue
        target = label
      }

      const { width, height } = target.getBoundingClientRect()
      if (width === 0 || height === 0) continue
      if (width >= minimum - 0.5 && height >= minimum - 0.5) continue
      const name =
        control.getAttribute("aria-label") ??
        control.textContent?.trim().slice(0, 30) ??
        control.tagName
      found.push(
        `${name || control.tagName} ${Math.round(width)}×${Math.round(height)}`,
      )
    }
    return found
  }, TAP_TARGET)
}

async function expectThumbSized(scope: Locator, screen: string) {
  expect
    .soft(await tooSmall(scope), `${screen}: controls under 44×44`)
    .toEqual([])
}

function body(page: Page): Locator {
  return page.locator("body")
}

async function openSettings(page: Page): Promise<Locator> {
  await page
    .getByRole("button", { name: "Settings" })
    .filter({ visible: true })
    .first()
    .click()
  const sheet = page.getByRole("dialog")
  await expect(sheet).toBeVisible()
  return sheet
}

for (const path of ["/", "/offline", "/rules"]) {
  test(`every control on ${path} is a 44px tap target`, async ({
    page,
  }) => {
    await openApp(page, path)
    await expectThumbSized(body(page), path)
  })
}

test("every control on /online signed out is a 44px tap target", async ({
  page,
}) => {
  await openApp(page, "/online")
  await expectThumbSized(body(page), "/online")
})

test("every control in a bot game, its move list and its drawers is a 44px tap target", async ({
  page,
}) => {
  await startOfflineGame(page, "vs Computer")
  // A phone shows no first-game guide (TUD-1127); its buttons are checked on a
  // desktop in first-game-guide.spec.ts.
  await expectThumbSized(body(page), "game")

  await playMove(page, "c5", "d5")
  await expect(
    page.locator(".font-mono").filter({ hasText: /^[a-i]\d[a-i]\d$/ }),
  ).toHaveCount(2, { timeout: 30_000 })
  await expectThumbSized(body(page), "game with a move list")

  const settings = await openSettings(page)
  await expectThumbSized(settings, "Settings drawer")
  // A phone's drawer has no Close button: it is dragged or tapped away. The
  // top of the screen is the overlay above it.
  await page.mouse.click(195, 20)
  await expect(settings).toBeHidden()

  await page.getByRole("button", { name: "Resign" }).click()
  const confirm = page
    .getByRole("dialog")
    .filter({ hasText: "Resign the game?" })
  await expect(confirm).toBeVisible()
  await expectThumbSized(confirm, "Resign drawer")
})

test("every control in the home Settings drawer is a 44px tap target", async ({
  page,
}) => {
  await openApp(page, "/")
  const settings = await openSettings(page)
  await expectThumbSized(settings, "home Settings drawer")
})

// A desktop is pointed at with a mouse, but a laptop with a touch screen is
// not, so the header and the manual's contents keep the thumb size there too.
for (const width of [1024, 1280, 1440]) {
  test(`the header controls are 44px tap targets at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await openApp(page, "/")
    await expectThumbSized(page.locator("header"), `header at ${width}px`)
  })
}

for (const path of ["/rules", "/strategy", "/opening-moves"]) {
  test(`every contents link on ${path} is a 44px tap target on a desktop`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await openApp(page, path)
    const rail = page.locator("[data-manual-rail]")
    await expect(rail).toBeVisible()
    await expectThumbSized(rail, `${path} contents`)
  })
}
