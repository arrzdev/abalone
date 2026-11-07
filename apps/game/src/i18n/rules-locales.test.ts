import { describe, expect, it } from "vitest"

//every locale's game.json, read the way vite bundles them
const LOCALES = import.meta.glob<Record<string, unknown>>(
  "./locales/*/game.json",
  {
    eager: true,
    import: "default",
  },
)

/** Every leaf key under an object, as dotted paths. */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix]
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  )
}

const english = LOCALES["./locales/en/game.json"]

//the rules and strategy pages are pages people find by searching in their own
//language. a key missing from a locale falls back to english in the middle of a
//translated page
describe.each(["rules", "strategy"])("%s copy", (section) => {
  it("exists in english", () => {
    expect(keyPaths(english[section]).length).toBeGreaterThan(1)
  })

  it.each(
    Object.keys(LOCALES).filter(
      (path) => path !== "./locales/en/game.json",
    ),
  )("%s has every key english has", (path) => {
    expect(keyPaths(LOCALES[path][section]).sort()).toEqual(
      keyPaths(english[section]).sort(),
    )
  })
})

//the opening moves page is translated into a few languages only (the
//`PAGE_LANGUAGES` entry in routing/seo-pages.ts). in each, every string is its
//own: an english one left in would show an english paragraph on the page
describe.each(["de", "fr", "nl", "es"])(
  "%s opening moves copy",
  (language) => {
    const path = `./locales/${language}/game.json`
    const openings = LOCALES[path].openings as Record<string, unknown>
    const englishOpenings = english.openings as Record<string, unknown>

    it("has every key english has", () => {
      expect(keyPaths(openings).sort()).toEqual(
        keyPaths(englishOpenings).sort(),
      )
    })

    it.each(keyPaths(englishOpenings))("translates %s", (key) => {
      const read = (root: unknown) =>
        key
          .split(".")
          .reduce<unknown>(
            (node, part) => (node as Record<string, unknown>)?.[part],
            root,
          )
      expect(read(openings)).toEqual(expect.any(String))
      expect(read(openings)).not.toBe(read(englishOpenings))
    })
  },
)

//the starting positions page is translated into the same few languages. the
//two daisy layouts keep their names (the opening moves copy does too), so those
//strings are the same as english on purpose
const KEPT_NAMES = [
  "belgian_daisy.title",
  "german_daisy.title",
  "glance.rows.belgian_daisy.layout",
  "glance.rows.german_daisy.layout",
]

describe.each(["de", "fr", "nl", "es"])(
  "%s starting positions copy",
  (language) => {
    const path = `./locales/${language}/game.json`
    const positions = LOCALES[path].positions as Record<string, unknown>
    const englishPositions = english.positions as Record<string, unknown>

    it("has every key english has", () => {
      expect(keyPaths(positions).sort()).toEqual(
        keyPaths(englishPositions).sort(),
      )
    })

    it.each(
      keyPaths(englishPositions).filter(
        (key) => !KEPT_NAMES.includes(key),
      ),
    )("translates %s", (key) => {
      const read = (root: unknown) =>
        key
          .split(".")
          .reduce<unknown>(
            (node, part) => (node as Record<string, unknown>)?.[part],
            root,
          )
      expect(read(positions)).toEqual(expect.any(String))
      expect(read(positions)).not.toBe(read(englishPositions))
    })
  },
)

//the play block under each page's intro, mid-page and at the end (the
//`content-play-block` document on TUD-820). its two labels replace the old end
//buttons, which no locale keeps
describe.each(Object.keys(LOCALES))("%s play block", (path) => {
  const keys = keyPaths(LOCALES[path])

  it.each([
    "rules.play.cta",
    "rules.play.more",
    "strategy.play.cta",
    "strategy.play.more",
  ])("has %s", (key) => {
    expect(keys).toContain(key)
  })

  it.each([
    "rules.cta",
    "rules.cta_computer",
    "strategy.practise.cta_computer",
    "strategy.practise.cta_friend",
  ])("no longer has %s", (key) => {
    expect(keys).not.toContain(key)
  })
})

describe("english play block copy", () => {
  it.each(["rules", "strategy"])(
    "%s says where each link goes",
    (section) => {
      const play = (
        english[section] as Record<string, Record<string, string>>
      ).play
      expect(play).toEqual({
        cta: "Play against the computer",
        more: "Other ways to play",
      })
    },
  )
})
