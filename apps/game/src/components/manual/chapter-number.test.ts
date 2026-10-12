import { describe, expect, it } from "vitest"
import {
  formatChapterNumber,
  splitChapterNumber,
} from "@/components/manual/chapter-number"

//every locale's game.json, read the way vite bundles them
const LOCALES = import.meta.glob<{
  strategy: { tips: Record<string, { title: string }> }
}>("../../i18n/locales/*/game.json", { eager: true, import: "default" })

/** The strategy tips in reading order, as `strategy.page.tsx` lists them. */
const TIP_KEYS = [
  "center",
  "groups_of_three",
  "edge",
  "count",
  "opening",
  "attack_as_a_group",
  "tempo",
]

describe("splitChapterNumber", () => {
  it("takes the leading number off a tip title", () => {
    expect(splitChapterNumber("1. Control the center")).toEqual({
      number: 1,
      title: "Control the center",
    })
  })

  it("leaves a title with no number as it is", () => {
    expect(splitChapterNumber("Pushing: the sumito")).toEqual({
      number: null,
      title: "Pushing: the sumito",
    })
  })

  it("does not take a number that is part of the words", () => {
    expect(splitChapterNumber("3 marbles push 2")).toEqual({
      number: null,
      title: "3 marbles push 2",
    })
  })
})

describe("formatChapterNumber", () => {
  it.each([
    [1, "01"],
    [9, "09"],
    [12, "12"],
  ])("prints %i as %s", (number, printed) => {
    expect(formatChapterNumber(number)).toBe(printed)
  })
})

//the page prints the numeral itself (rules-redesign §10.1 on TUD-893). a locale
//whose tip titles lost or reordered their numbers would print the wrong one, or
//show it twice
describe.each(Object.keys(LOCALES))("%s strategy tips", (path) => {
  const tips = LOCALES[path].strategy.tips

  it.each(TIP_KEYS.map((key, index) => [key, index + 1] as const))(
    "%s starts with its number %i",
    (key, number) => {
      const split = splitChapterNumber(tips[key].title)
      expect(split.number).toBe(number)
      expect(split.title).not.toMatch(/^\d/)
      expect(split.title.length).toBeGreaterThan(0)
    },
  )
})
