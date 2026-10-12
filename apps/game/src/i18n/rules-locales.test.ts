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
