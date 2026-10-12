import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"

// /rules and /strategy laid out as a printed game manual (the `rules-redesign`
// document on TUD-893, built on TUD-911): numbered chapters with no card around
// them, a contents rail beside them on a desktop and a contents list under the
// hero on a phone, the diagrams on their own plates beside the words.
//
// Layout only. The words, their order and the anchors are what
// rules-page.spec.ts and strategy-page.spec.ts already hold; this checks where
// those words now sit. The contract the checks read:
//   - a chapter is a `<section aria-labelledby="<its h2 id>">`, so a region
//     named by its title;
//   - the rail and the contents list are each a `<nav>` named by the page's
//     short title, and only one of them is visible at a width;
//   - the rail marks the chapter being read with `aria-current`.

const RULES = {
  path: "/rules",
  // the bar's short title, which names the contents too
  contents: "How to play",
  chapters: [
    ["goal", "The goal"],
    ["turns", "Who moves first"],
    ["directions", "How marbles move"],
    ["moving-groups", "Moving one, two or three marbles"],
    ["sumito", "Pushing: the sumito"],
    ["pushing-off", "Pushing marbles off the board"],
    ["how-to-win", "How to win"],
    ["starting-positions", "Starting positions"],
    ["faq", "Frequently asked"],
  ],
} as const

// The tip titles carry their number in the copy ("1. Control the center"), so
// the page shows that and no second numeral (TUD-911, open point 1, option a).
const STRATEGY = {
  path: "/strategy",
  contents: "Strategy",
  chapters: [
    ["center", "1. Control the center"],
    ["groups-of-three", "2. Keep your groups of three"],
    ["edge", "3. Stay away from the edge"],
    ["count", "4. Count before you push"],
    ["opening", "5. Choose your opening on purpose"],
    ["attack-as-a-group", "6. Attack as a group, not as a hero"],
    ["tempo", "7. Win the tempo, not the marble"],
    ["mistakes", "Common mistakes"],
    ["practise", "Practise"],
  ],
} as const

const DESKTOP = { width: 1440, height: 900 }
const TABLET = { width: 768, height: 1024 }
const PHONE = { width: 390, height: 844 }

/** The contents (rail or list) visible at this width. */
function contents(page: Page, name: string): Locator {
  return page
    .getByRole("navigation", { name, exact: true })
    .filter({ visible: true })
}

function chapter(page: Page, title: string): Locator {
  return page.getByRole("region", { name: title, exact: true })
}

/** Where `locator` is in the viewport, in CSS px from its top edge. */
async function topOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox()
  return box?.y ?? Number.NaN
}

/** Scrolls the page's scroller until `id` is at the top, as a reader would. */
async function readFrom(page: Page, id: string): Promise<void> {
  await page
    .locator(`h2#${id}`)
    .evaluate((heading) => heading.scrollIntoView({ block: "start" }))
}

/** True when the heading sits in the top band of the screen. */
async function expectAtTop(page: Page, id: string): Promise<void> {
  await expect
    .poll(() => topOf(page.locator(`h2#${id}`)), {
      message: `#${id} at top`,
    })
    .toBeGreaterThanOrEqual(0)
  await expect
    .poll(() => topOf(page.locator(`h2#${id}`)))
    .toBeLessThan(120)
}

/** The visible styles a chapter reads as: no card, a hairline on top. */
function chapterSurface(region: Locator) {
  return region.evaluate((section) => {
    const heading = section.querySelector("h2")
    const surfaces: string[] = []
    //every box between the heading and <main> is see-through: a card is a
    //filled, rounded or shadowed box around the heading
    for (
      let node = heading?.parentElement ?? null;
      node !== null && node.tagName !== "MAIN";
      node = node.parentElement
    ) {
      const style = getComputedStyle(node)
      if (
        style.backgroundColor !== "rgba(0, 0, 0, 0)" ||
        style.boxShadow !== "none"
      ) {
        surfaces.push(`${node.tagName}.${node.className}`)
      }
    }
    return {
      surfaces,
      hairline: getComputedStyle(section).borderTopWidth,
    }
  })
}

test.describe("desktop, 1440", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "desktop layout: the desktop browser project",
  )
  test.use({ viewport: DESKTOP })

  for (const manual of [RULES, STRATEGY]) {
    test(`${manual.path}: a rail lists every chapter, in order, linking to its anchor`, async ({
      page,
    }) => {
      await openApp(page, manual.path)
      const rail = contents(page, manual.contents)
      await expect(rail).toHaveCount(1)

      const links = rail.getByRole("link")
      await expect(links).toHaveCount(manual.chapters.length)
      for (const [index, [id, title]] of manual.chapters.entries()) {
        const link = links.nth(index)
        await expect(link).toContainText(title)
        await expect(link).toHaveAttribute("href", new RegExp(`#${id}$`))
      }

      // the rail sits left of the text, not above it
      const railBox = await rail.boundingBox()
      const headingBox = await page
        .locator(`h2#${manual.chapters[0][0]}`)
        .boundingBox()
      expect(railBox && headingBox).toBeTruthy()
      if (railBox && headingBox) {
        expect(railBox.x + railBox.width).toBeLessThanOrEqual(headingBox.x)
      }
    })

    test(`${manual.path}: the rail stays on screen to the last chapter`, async ({
      page,
    }) => {
      await openApp(page, manual.path)
      const last = manual.chapters[manual.chapters.length - 1][0]
      await readFrom(page, last)

      const rail = contents(page, manual.contents)
      await expect(rail).toBeInViewport()
    })

    test(`${manual.path}: the rail marks the chapter being read`, async ({
      page,
    }) => {
      await openApp(page, manual.path)
      const rail = contents(page, manual.contents)
      const [readId, readTitle] = manual.chapters[4]
      const [clickId, clickTitle] = manual.chapters[6]

      // scrolling there marks it
      await readFrom(page, readId)
      await expect(
        rail.getByRole("link", { name: readTitle }),
      ).toHaveAttribute("aria-current", /^(location|true)$/)

      // pressing one scrolls there and marks it, and only it
      await rail.getByRole("link", { name: clickTitle }).click()
      await expectAtTop(page, clickId)
      await expect(
        rail.getByRole("link", { name: clickTitle }),
      ).toHaveAttribute("aria-current", /^(location|true)$/)
      await expect(
        rail.locator("[aria-current]:not([aria-current=false])"),
      ).toHaveCount(1)
    })

    test(`${manual.path}: chapters are not cards, each opens on a hairline`, async ({
      page,
    }) => {
      await openApp(page, manual.path)
      for (const [, title] of manual.chapters) {
        const region = chapter(page, title)
        await expect(region, title).toHaveCount(1)
        const { surfaces, hairline } = await chapterSurface(region)
        expect(surfaces, `${title}: boxes around its heading`).toEqual([])
        expect(hairline, `${title}: hairline on top`).toBe("1px")
      }
    })

    // reading size (rules-redesign §4 "Type")
    test(`${manual.path}: body text 17px, chapter titles 30px`, async ({
      page,
    }) => {
      await openApp(page, manual.path)
      const region = chapter(page, manual.chapters[0][1])
      await expect(region.locator("h2")).toHaveCSS("font-size", "30px")
      await expect(region.locator("p").first()).toHaveCSS(
        "font-size",
        "17px",
      )
    })
  }

  test("/rules: chapters are numbered 01 to 09 before their title", async ({
    page,
  }) => {
    await openApp(page, RULES.path)
    for (const [index, [, title]] of RULES.chapters.entries()) {
      const number = String(index + 1).padStart(2, "0")
      const text = (await chapter(page, title).innerText()).trim()
      expect(
        text.startsWith(number),
        `${title} starts with ${number}`,
      ).toBe(true)
    }
  })

  test("/strategy: tips show their copy's number once, the closing chapters none", async ({
    page,
  }) => {
    await openApp(page, STRATEGY.path)
    for (const [, title] of STRATEGY.chapters) {
      const text = (await chapter(page, title).innerText()).trim()
      expect(text.startsWith(title), `${title} opens on its title`).toBe(
        true,
      )
    }
  })

  test("/rules: the hero shows the starting position beside the heading", async ({
    page,
  }) => {
    await openApp(page, RULES.path)
    const heading = page.getByRole("heading", { level: 1 })
    // the hero plate is an image, not one of the six captioned figures
    const board = page
      .getByRole("img", { name: "Starting positions", exact: true })
      .filter({ visible: true })
    await expect(board).toHaveCount(1)
    await expect(board).toBeInViewport()

    const headingBox = await heading.boundingBox()
    const boardBox = await board.boundingBox()
    expect(headingBox && boardBox).toBeTruthy()
    if (headingBox && boardBox) {
      expect(boardBox.x).toBeGreaterThanOrEqual(
        headingBox.x + headingBox.width,
      )
    }
  })

  test("/rules: a diagram sits beside its text and stays there while it is read", async ({
    page,
  }) => {
    await openApp(page, RULES.path)
    const region = chapter(page, "Pushing: the sumito")
    const text = region.locator("p").first()
    const diagram = region.getByRole("img").first()

    const textBox = await text.boundingBox()
    const diagramBox = await diagram.boundingBox()
    expect(textBox && diagramBox).toBeTruthy()
    if (textBox && diagramBox) {
      expect(diagramBox.x).toBeGreaterThanOrEqual(
        textBox.x + textBox.width,
      )
    }

    // the plate holding it is sticky inside the chapter
    const sticky = await diagram.evaluate((canvas) => {
      for (
        let node = canvas.parentElement;
        node !== null && node.tagName !== "SECTION";
        node = node.parentElement
      ) {
        if (getComputedStyle(node).position === "sticky") return true
      }
      return false
    })
    expect(sticky).toBe(true)
  })

  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" })

    test("/rules: a rail link jumps, it does not glide", async ({
      page,
    }) => {
      await openApp(page, RULES.path)
      await contents(page, RULES.contents)
        .getByRole("link", { name: "Frequently asked" })
        .click()
      // two frames after the press the heading is already there
      const top = await page.evaluate(
        () =>
          new Promise<number>((resolve) =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() =>
                resolve(
                  document.getElementById("faq")?.getBoundingClientRect()
                    .top ?? Number.NaN,
                ),
              ),
            ),
          ),
      )
      expect(top).toBeGreaterThanOrEqual(0)
      expect(top).toBeLessThan(120)
    })
  })
})

test.describe("tablet, 768", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "tablet layout: the desktop browser project",
  )
  test.use({ viewport: TABLET })

  test("/rules: the contents list sits in two columns, no rail", async ({
    page,
  }) => {
    await openApp(page, RULES.path)
    const list = contents(page, RULES.contents)
    await expect(list).toHaveCount(1)
    const links = list.getByRole("link")
    await expect(links).toHaveCount(RULES.chapters.length)

    const lefts = new Set<number>()
    for (const link of await links.all()) {
      const box = await link.boundingBox()
      if (box) lefts.add(Math.round(box.x))
    }
    expect(lefts.size).toBe(2)
  })
})

test.describe("phone, 390", () => {
  test.use({ viewport: PHONE })

  for (const manual of [RULES, STRATEGY]) {
    test(`${manual.path}: a contents list follows the hero, one thumb-sized row per chapter`, async ({
      page,
    }) => {
      await openApp(page, manual.path)
      const list = contents(page, manual.contents)
      await expect(list).toHaveCount(1)

      const links = list.getByRole("link")
      await expect(links).toHaveCount(manual.chapters.length)
      for (const [index, [id, title]] of manual.chapters.entries()) {
        const link = links.nth(index)
        await expect(link).toContainText(title)
        await expect(link).toHaveAttribute("href", new RegExp(`#${id}$`))
        const box = await link.boundingBox()
        expect(
          box?.height ?? 0,
          `${title} row height`,
        ).toBeGreaterThanOrEqual(43.5)
        expect(
          box?.width ?? 0,
          `${title} row width`,
        ).toBeGreaterThanOrEqual(43.5)
      }

      // under the hero, above the first chapter
      const listTop = await topOf(list)
      expect(listTop).toBeGreaterThan(
        await topOf(page.getByRole("heading", { level: 1 })),
      )
      expect(listTop).toBeLessThan(
        await topOf(page.locator(`h2#${manual.chapters[0][0]}`)),
      )
    })

    test(`${manual.path}: a contents link jumps to its chapter`, async ({
      page,
    }) => {
      await openApp(page, manual.path)
      const [id, title] = manual.chapters[4]
      await contents(page, manual.contents)
        .getByRole("link", { name: title })
        .click()
      await expectAtTop(page, id)
    })

    // reading size on a phone (rules-redesign §4 "Type")
    test(`${manual.path}: body text 16px, chapter titles 24px`, async ({
      page,
    }) => {
      await openApp(page, manual.path)
      const region = chapter(page, manual.chapters[0][1])
      await expect(region.locator("h2")).toHaveCSS("font-size", "24px")
      await expect(region.locator("p").first()).toHaveCSS(
        "font-size",
        "16px",
      )
    })
  }

  // a shared link to one rule (/rules#sumito) still opens on that rule
  test("/rules#sumito opens on the sumito chapter", async ({ page }) => {
    await openApp(page, "/rules#sumito")
    await expectAtTop(page, "sumito")
  })
})

// nothing wider than the screen, from the smallest phone to a wide monitor
test.describe("no horizontal overflow", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "layout widths: one browser is enough",
  )

  for (const width of [320, 375, 390, 768, 1024, 1440, 1920, 2560]) {
    for (const manual of [RULES, STRATEGY]) {
      test(`${manual.path} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await openApp(page, manual.path)
        const overflowing = await page.evaluate(() =>
          [
            document.documentElement,
            ...document.querySelectorAll("main *"),
          ]
            .filter((element) => {
              const style = getComputedStyle(element)
              const scrolls =
                element === document.documentElement ||
                ["auto", "scroll"].includes(style.overflowX) ||
                ["auto", "scroll"].includes(style.overflowY)
              return scrolls && element.scrollWidth > element.clientWidth
            })
            .map((element) => element.tagName),
        )
        expect(overflowing).toEqual([])
      })
    }
  }
})
