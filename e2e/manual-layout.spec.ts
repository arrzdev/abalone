import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { openApp } from "./support/app"

// /rules and /strategy laid out as a printed manual: numbered chapters with no
// cards, a contents rail with scroll-spy on a desktop, a contents list on a
// phone, and the diagrams on plates beside the text (the `rules-redesign`
// document on TUD-893, checks in its section 9; TUD-910).
//
// The hooks the layout exposes, so these checks do not depend on class names:
//   [data-chapter]          one chapter; `h2[id]` inside it is its link target
//   [data-chapter-number]   the printed numeral before the heading (aria-hidden)
//   [data-plate]            the dark surface a diagram sits on
//   nav[data-manual-rail]   the desktop rail; the current link has
//                           aria-current="location"
//   [data-rail-bar]         the bar that marks the current rail link
//   nav[data-manual-contents]  the phone and tablet contents list
// The page scrolls inside `main [data-scroll-view]`, not the window.

const RULES_CHAPTERS = [
  ["goal", "The goal"],
  ["turns", "Who moves first"],
  ["directions", "How marbles move"],
  ["moving-groups", "Moving one, two or three marbles"],
  ["sumito", "Pushing: the sumito"],
  ["pushing-off", "Pushing marbles off the board"],
  ["how-to-win", "How to win"],
  ["starting-positions", "Starting positions"],
  ["faq", "Frequently asked"],
] as const

// The tips print their number once, in the numeral column; the heading keeps
// the words (rules-redesign §10.1).
const STRATEGY_TIPS = [
  ["center", "Control the center"],
  ["groups-of-three", "Keep your groups of three"],
  ["edge", "Stay away from the edge"],
  ["count", "Count before you push"],
  ["opening", "Choose your opening on purpose"],
  ["attack-as-a-group", "Attack as a group, not as a hero"],
  ["tempo", "Win the tempo, not the marble"],
] as const

const DESKTOP = { width: 1440, height: 900 }
const _PHONE = { width: 390, height: 664 }

/** The first-screen budget: the primary CTA ends inside each of these. */
const CTA_BUDGET = [
  { width: 320, height: 460 },
  { width: 375, height: 548 },
  { width: 390, height: 664 },
]

// 720 and 2880 stand for 1440 at 200% and 50% zoom.
const OVERFLOW_WIDTHS = [
  320, 375, 390, 720, 768, 1024, 1440, 1920, 2560, 2880,
]

const SCROLLER = "main [data-scroll-view]"

const rail = (page: Page) => page.locator("nav[data-manual-rail]")
const contents = (page: Page) => page.locator("nav[data-manual-contents]")

/** A heading's distance from the top of the scroller, in CSS pixels. */
function headingOffset(page: Page, id: string): Promise<number> {
  return page.evaluate(
    ({ id, scroller }) => {
      const heading = document.getElementById(id)
      const view = document.querySelector(scroller)
      if (!heading || !view) return Number.NaN
      return (
        heading.getBoundingClientRect().top -
        view.getBoundingClientRect().top
      )
    },
    { id, scroller: SCROLLER },
  )
}

/** Scrolls the page until `id`'s heading sits `offset` px below the top. */
async function scrollHeadingTo(page: Page, id: string, offset: number) {
  await page.evaluate(
    ({ id, offset, scroller }) => {
      const heading = document.getElementById(id)
      const view = document.querySelector(scroller)
      if (!heading || !view) throw new Error(`no #${id} or scroller`)
      view.scrollTop +=
        heading.getBoundingClientRect().top -
        view.getBoundingClientRect().top -
        offset
    },
    { id, offset, scroller: SCROLLER },
  )
}

/** Desktop checks need one browser; phone checks run in the iPhone project. */
test.describe("desktop", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "layout at fixed widths: one engine is enough",
  )
  test.use({ viewport: DESKTOP })

  test("rules chapters have no cards, a hairline each, and numbers 01-09", async ({
    page,
  }) => {
    await openApp(page, "/rules")

    const chapters = page.locator("[data-chapter]")
    await expect(chapters).toHaveCount(RULES_CHAPTERS.length)

    const found = await chapters.evaluateAll((elements) =>
      elements.map((chapter) => {
        const heading = chapter.querySelector("h2")
        const number = chapter.querySelector("[data-chapter-number]")
        // a card is a painted surface somewhere between the heading and <main>
        const painted: string[] = []
        for (
          let node = heading?.parentElement ?? null;
          node && node.tagName !== "MAIN";
          node = node.parentElement
        ) {
          const background = getComputedStyle(node).backgroundColor
          if (
            background !== "rgba(0, 0, 0, 0)" &&
            background !== "transparent"
          )
            painted.push(background)
        }
        const numberFirst =
          number !== null &&
          heading !== null &&
          Boolean(
            number.compareDocumentPosition(heading) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          )
        return {
          id: heading?.id,
          number: number?.textContent?.trim(),
          numberHidden: number?.getAttribute("aria-hidden"),
          numberFirst,
          painted,
          hairline: Number.parseFloat(
            getComputedStyle(chapter).borderTopWidth,
          ),
        }
      }),
    )

    expect(found.map(({ id }) => id)).toEqual(
      RULES_CHAPTERS.map(([id]) => id),
    )
    found.forEach((chapter, index) => {
      expect(chapter.number, chapter.id).toBe(
        String(index + 1).padStart(2, "0"),
      )
      expect(chapter.numberHidden, chapter.id).toBe("true")
      expect(chapter.numberFirst, chapter.id).toBe(true)
      expect(chapter.painted, chapter.id).toEqual([])
      expect(chapter.hairline, chapter.id).toBeGreaterThanOrEqual(1)
    })
  })

  test("the hero shows the whole board in the standard opening", async ({
    page,
  }) => {
    await openApp(page, "/rules")
    const board = page.getByRole("img", { name: "Starting positions" })
    await expect(board).toBeVisible()
    // in the first screen, beside the heading
    const box = await board.boundingBox()
    expect(box?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(DESKTOP.height)
  })

  test("the rail follows the reader and jumps on a click", async ({
    page,
  }) => {
    await openApp(page, "/rules")
    await expect(rail(page)).toBeVisible()
    await expect(contents(page)).toBeHidden()

    const links = rail(page).getByRole("link")
    await expect(links).toHaveCount(RULES_CHAPTERS.length)
    const current = rail(page).locator('[aria-current="location"]')

    // scroll-spy: the chapter whose heading crossed the top 30% is current
    await scrollHeadingTo(page, "sumito", 40)
    await expect(current).toHaveCount(1)
    await expect(current).toHaveAttribute("href", /#sumito$/)
    await expect(current).toContainText("Pushing: the sumito")

    // sticky: still in view far down the page
    const railBox = await rail(page).boundingBox()
    expect(railBox?.y ?? -1).toBeGreaterThanOrEqual(0)
    expect(railBox?.y ?? DESKTOP.height).toBeLessThan(DESKTOP.height / 2)

    await rail(page)
      .getByRole("link", { name: /How to win/ })
      .click()
    await expect(current).toHaveAttribute("href", /#how-to-win$/)
    await expect
      .poll(() => headingOffset(page, "how-to-win"))
      .toBeLessThanOrEqual(48)
    expect(await headingOffset(page, "how-to-win")).toBeGreaterThanOrEqual(
      0,
    )
  })

  // The page is server rendered: the browser follows the link before the
  // diagrams above the chapter have their height (TUD-916, TUD-919).
  test("a link to a chapter lands its heading 40px down, as a rail click does", async ({
    page,
  }) => {
    for (const id of ["moving-groups", "sumito", "pushing-off", "faq"]) {
      await openApp(page, `/rules#${id}`)
      await expect
        .poll(async () => Math.abs((await headingOffset(page, id)) - 40), {
          message: id,
        })
        .toBeLessThanOrEqual(2)
    }
  })

  test("every title starts at the same x, whatever its numeral", async ({
    page,
  }) => {
    for (const path of ["/rules", "/strategy"]) {
      await openApp(page, path)
      const starts = await titleStarts(page, "nav[data-manual-rail]")
      expect(starts.length, path).toBeGreaterThan(1)
      expect(
        new Set(starts),
        `${path} ${starts.join(", ")}`,
      ).toHaveProperty("size", 1)
    }

    // the list under the hero, in one column
    await page.setViewportSize({ width: 390, height: 844 })
    await openApp(page, "/rules")
    const starts = await titleStarts(page, "nav[data-manual-contents]")
    expect(starts.length).toBe(RULES_CHAPTERS.length)
    expect(new Set(starts), starts.join(", ")).toHaveProperty("size", 1)
  })

  test("the goal's plate is as tall as the text beside it", async ({
    page,
  }) => {
    await openApp(page, "/rules")
    const { text, plate } = await page.evaluate(() => {
      const block = document.getElementById("goal")?.parentElement
      const surface = document.querySelector(
        "[data-chapter]:has(#goal) [data-plate] > *",
      )
      if (!block || !surface) throw new Error("no goal chapter or plate")
      const box = block.getBoundingClientRect()
      const padding = Number.parseFloat(
        getComputedStyle(block).paddingBottom,
      )
      const plateBox = surface.getBoundingClientRect()
      return {
        text: { top: box.top, bottom: box.bottom - padding },
        plate: { top: plateBox.top, bottom: plateBox.bottom },
      }
    })
    expect(Math.abs(plate.top - text.top)).toBeLessThanOrEqual(1)
    expect(Math.abs(plate.bottom - text.bottom)).toBeLessThanOrEqual(1)
  })

  test("a diagram stays beside its chapter while the chapter scrolls", async ({
    page,
  }) => {
    await openApp(page, "/rules")

    const plates = page.locator("[data-chapter] [data-plate]")
    await expect(plates).not.toHaveCount(0)
    for (const position of await plates.evaluateAll((elements) =>
      elements.map((plate) => getComputedStyle(plate).position),
    ))
      expect(position).toBe("sticky")

    // in every chapter longer than its plate, scroll halfway through the
    // stretch the plate can travel: the plate is still wholly on screen
    const ids = await page
      .locator("[data-chapter]:has([data-plate]) h2")
      .evaluateAll((headings) => headings.map((heading) => heading.id))
    let checked = 0
    for (const id of ids) {
      const travel = await page.evaluate((id) => {
        const chapter = document
          .getElementById(id)
          ?.closest("[data-chapter]")
        const plate = chapter?.querySelector("[data-plate]")
        if (!chapter || !plate) return 0
        return (
          chapter.getBoundingClientRect().height -
          plate.getBoundingClientRect().height
        )
      }, id)
      if (travel < 120) continue
      await scrollHeadingTo(page, id, -travel / 2)
      const box = await page
        .locator(`[data-chapter]:has(#${id}) [data-plate]`)
        .boundingBox()
      expect(box?.y ?? -1, id).toBeGreaterThanOrEqual(0)
      expect((box?.y ?? 0) + (box?.height ?? 0), id).toBeLessThanOrEqual(
        DESKTOP.height,
      )
      checked++
    }
    expect(
      checked,
      "chapters long enough to scroll past a plate",
    ).toBeGreaterThan(0)
  })

  test("strategy uses the same template, without plates, numbering the seven tips once", async ({
    page,
  }) => {
    await openApp(page, "/strategy")
    await expect(rail(page)).toBeVisible()
    await expect(page.locator("[data-plate]")).toHaveCount(0)

    for (const [index, [id, title]] of STRATEGY_TIPS.entries()) {
      const chapter = page.locator(`[data-chapter]:has(h2#${id})`)
      await expect(chapter.locator("h2")).toHaveText(title)
      await expect(chapter.locator("[data-chapter-number]")).toHaveText(
        String(index + 1).padStart(2, "0"),
      )
    }
    // the copy's own "1." is not printed anywhere as well
    const text = await page.locator("main").innerText()
    for (const [index, [, title]] of STRATEGY_TIPS.entries())
      expect(text).not.toContain(`${index + 1}. ${title}`)
  })

  test("body text is 17px and nothing is under 14px", async ({ page }) => {
    for (const path of ["/rules", "/strategy"]) {
      await openApp(page, path)
      expect(await smallestText(page), path).toBeGreaterThanOrEqual(14)
      for (const size of await bodySizes(page))
        expect(size, path).toBeGreaterThanOrEqual(17)
    }
  })
})

test.describe("phone", () => {
  test.skip(
    ({ browserName }) => browserName !== "webkit",
    "the iPhone project is the phone",
  )

  test("a contents list of every chapter follows the hero and jumps to each", async ({
    page,
  }) => {
    await openApp(page, "/rules")
    await expect(rail(page)).toBeHidden()

    const links = contents(page).getByRole("link")
    await expect(links).toHaveCount(RULES_CHAPTERS.length)

    // after the hero's play block, before the first chapter
    const order = await page.evaluate(() => {
      const list = document.querySelector("nav[data-manual-contents]")
      const cta = [...document.querySelectorAll("main a")].find(
        (link) => link.textContent?.trim() === "Play against the computer",
      )
      const first = document.querySelector("[data-chapter]")
      if (!list || !cta || !first) return null
      return {
        afterCta: Boolean(
          cta.compareDocumentPosition(list) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ),
        beforeChapters: Boolean(
          list.compareDocumentPosition(first) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      }
    })
    expect(order).toEqual({ afterCta: true, beforeChapters: true })

    for (const [index, [id, title]] of RULES_CHAPTERS.entries()) {
      const link = links.nth(index)
      await expect(link).toContainText(title)
      await expect(link).toHaveAttribute("href", new RegExp(`#${id}$`))
      const box = await link.boundingBox()
      expect(box?.width ?? 0, id).toBeGreaterThanOrEqual(44)
      expect(box?.height ?? 0, id).toBeGreaterThanOrEqual(44)
    }

    await links.nth(4).click()
    await expect
      .poll(() => headingOffset(page, "sumito"))
      .toBeLessThanOrEqual(48)
    expect(await headingOffset(page, "sumito")).toBeGreaterThanOrEqual(0)
  })

  test("the starting position follows the play block", async ({
    page,
  }) => {
    await openApp(page, "/rules")
    await expect(
      page.getByRole("img", { name: "Starting positions" }),
    ).toBeVisible()
  })

  test("body text is 16px or more and nothing is under 14px", async ({
    page,
  }) => {
    for (const path of ["/rules", "/strategy"]) {
      await openApp(page, path)
      expect(await smallestText(page), path).toBeGreaterThanOrEqual(14)
      for (const size of await bodySizes(page))
        expect(size, path).toBeGreaterThanOrEqual(16)
    }
  })
})

test.describe("every width", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "layout at fixed widths: one engine is enough",
  )

  test("nothing overflows sideways from 320 to 2880", async ({ page }) => {
    for (const path of ["/rules", "/strategy"]) {
      await page.setViewportSize({ width: 1440, height: 900 })
      await openApp(page, path)
      for (const width of OVERFLOW_WIDTHS) {
        await page.setViewportSize({ width, height: 900 })
        const overflow = await page.evaluate((scroller) => {
          const view = document.querySelector(scroller)
          return Math.max(
            document.documentElement.scrollWidth - window.innerWidth,
            view ? view.scrollWidth - view.clientWidth : 0,
          )
        }, SCROLLER)
        expect(overflow, `${path} at ${width}`).toBeLessThanOrEqual(0)
      }
    }
  })

  test("the primary CTA ends inside the first screen", async ({
    page,
  }) => {
    for (const path of ["/rules", "/strategy"]) {
      for (const viewport of CTA_BUDGET) {
        await page.setViewportSize(viewport)
        await openApp(page, path)
        const cta = page
          .getByRole("link", { name: "Play against the computer" })
          .first()
        const box = await cta.boundingBox()
        expect(
          (box?.y ?? Number.POSITIVE_INFINITY) + (box?.height ?? 0),
          `${path} at ${viewport.width}x${viewport.height}`,
        ).toBeLessThanOrEqual(viewport.height)
      }
    }
  })
})

test.describe("motion", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "frame sampling: one engine is enough",
  )
  test.use({ viewport: DESKTOP })

  // Motion is behavior: the path is sampled frame by frame, not only its end.
  test("a rail click scrolls smoothly and the bar slides", async ({
    page,
  }) => {
    await openApp(page, "/rules")
    const bar = rail(page).locator("[data-rail-bar]")
    await expect(bar).toHaveCount(1)
    expect(
      await bar.evaluate(
        (element) => getComputedStyle(element).transitionDuration,
      ),
    ).toBe("0.2s")

    const landed = (offset: number) => offset >= 0 && offset <= 48
    const traces: string[] = []
    let glided = false
    // A loaded machine can stall the main thread past the whole glide, so the
    // first frame already shows it landed (TUD-920). A jump lands on the first
    // frame every time, so seeing the glide once in three clicks is proof.
    for (let attempt = 0; attempt < 3 && !glided; attempt++) {
      await scrollToTop(page)
      const { start, frames } = await clickAndSample(page, "faq")
      const path = frames.map((frame) => frame.offset)
      const trace = `start ${start}, path ${frames.map((frame) => `${frame.offset}@${frame.at}ms`).join(", ")}`
      traces.push(trace)
      // closing in on every frame, and it lands
      for (let index = 1; index < path.length; index++)
        expect(path[index], trace).toBeLessThanOrEqual(path[index - 1] + 1)
      expect(landed(path.at(-1) ?? Number.NaN), trace).toBe(true)
      // more than a jump: not there on the first frame, a frame on the way,
      // and the glide takes time. Counted in time, not frames, so dropped
      // frames do not fail it.
      const between = path.filter(
        (offset) => offset > 48 && offset < start - 48,
      )
      const arrival = frames.find((frame) => landed(frame.offset))?.at ?? 0
      glided = !landed(path[0]) && between.length >= 1 && arrival >= 100
    }
    expect(glided, traces.join("\n")).toBe(true)
  })

  test("a second rail click during a glide keeps the mark on the second chapter", async ({
    page,
  }) => {
    await openApp(page, "/rules")
    const marked = await page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const link = (id: string) =>
            document.querySelector<HTMLAnchorElement>(
              `nav[data-manual-rail] a[href$="#${id}"]`,
            )
          link("moving-groups")?.click()
          const seen: string[] = []
          let frames = 0
          const sample = () => {
            frames++
            // a few frames into the first glide, the reader changes their mind
            if (frames === 3) link("faq")?.click()
            if (frames > 3)
              seen.push(
                document
                  .querySelector(
                    'nav[data-manual-rail] [aria-current="location"]',
                  )
                  ?.getAttribute("href") ?? "",
              )
            if (frames < 45) requestAnimationFrame(sample)
            else resolve(seen)
          }
          requestAnimationFrame(sample)
        }),
    )
    expect(new Set(marked), marked.join(", ")).toEqual(new Set(["#faq"]))
  })

  test("with reduced motion a rail click jumps and the bar does not slide", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await openApp(page, "/rules")
    const bar = rail(page).locator("[data-rail-bar]")
    expect(
      await bar.evaluate(
        (element) => getComputedStyle(element).transitionDuration,
      ),
    ).toBe("0s")

    const { frames } = await clickAndSample(page, "faq")
    const first = frames[0]?.offset ?? Number.NaN
    // there on the first frame after the click
    expect(
      first,
      `path ${frames.map((frame) => frame.offset).join(", ")}`,
    ).toBeLessThanOrEqual(48)
    expect(first).toBeGreaterThanOrEqual(0)
  })
})

/** Puts the scroller back at the top at once and waits for it to hold still. */
function scrollToTop(page: Page): Promise<void> {
  return page.evaluate(
    (scroller) =>
      new Promise<void>((resolve) => {
        const view = document.querySelector(scroller)
        if (!view) {
          resolve()
          return
        }
        view.scrollTo({ top: 0, behavior: "instant" })
        let still = 0
        let previous = view.scrollTop
        const check = () => {
          still = view.scrollTop === previous ? still + 1 : 0
          previous = view.scrollTop
          if (still < 5) requestAnimationFrame(check)
          else resolve()
        }
        requestAnimationFrame(check)
      }),
    SCROLLER,
  )
}

type Sampled = {
  /** The heading's offset just before the click. */
  start: number
  /** One entry per animation frame: offset, and ms since the click. */
  frames: { offset: number; at: number }[]
}

/**
 * Clicks the rail link to `id` and records the heading's offset from the top
 * of the scroller on every animation frame, until it has not moved for 10
 * frames or 4 s have passed. Sampling by settling rather than a fixed frame
 * count keeps the whole path when a loaded machine drops frames.
 */
function clickAndSample(page: Page, id: string): Promise<Sampled> {
  return page.evaluate(
    ({ id, scroller }) =>
      new Promise<Sampled>((resolve) => {
        const link = document.querySelector<HTMLAnchorElement>(
          `nav[data-manual-rail] a[href$="#${id}"]`,
        )
        const heading = document.getElementById(id)
        const view = document.querySelector(scroller)
        if (!link || !heading || !view) {
          resolve({ start: Number.NaN, frames: [] })
          return
        }
        const offset = () =>
          heading.getBoundingClientRect().top -
          view.getBoundingClientRect().top
        const start = offset()
        const frames: Sampled["frames"] = []
        let still = 0
        const clicked = performance.now()
        link.click()
        const sample = () => {
          const at = Math.round(performance.now() - clicked)
          const current = offset()
          const previous = frames.at(-1)?.offset
          still =
            previous !== undefined && Math.abs(current - previous) < 0.5
              ? still + 1
              : 0
          frames.push({ offset: current, at })
          if (still < 10 && at < 4000) requestAnimationFrame(sample)
          else resolve({ start, frames })
        }
        requestAnimationFrame(sample)
      }),
    { id, scroller: SCROLLER },
  )
}

/** Where each numbered title in a contents `nav` starts. */
function titleStarts(page: Page, nav: string): Promise<number[]> {
  return page
    .locator(`${nav} a:has(> span[aria-hidden]) > span:last-child`)
    .evaluateAll((titles) =>
      titles.map((title) => title.getBoundingClientRect().left),
    )
}

/** The smallest font size of any element in <main> that holds text. */
function smallestText(page: Page): Promise<number> {
  return page.evaluate(() => {
    let smallest = Number.POSITIVE_INFINITY
    for (const element of document.querySelectorAll<HTMLElement>(
      "main *",
    )) {
      const ownText = [...element.childNodes].some(
        (node) =>
          node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      )
      if (!ownText || element.getClientRects().length === 0) continue
      smallest = Math.min(
        smallest,
        Number.parseFloat(getComputedStyle(element).fontSize),
      )
    }
    return smallest
  })
}

/** The distinct font sizes of the chapters' paragraphs and list items. */
function bodySizes(page: Page): Promise<number[]> {
  return page.evaluate(() => [
    ...new Set(
      [
        ...document.querySelectorAll<HTMLElement>(
          "[data-chapter] p, [data-chapter] li",
        ),
      ].map((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      ),
    ),
  ])
}
