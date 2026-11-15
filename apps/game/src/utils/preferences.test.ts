import { describe, expect, it } from "vitest"
import { PREF_PREFIX, parseStored, serialize } from "@/utils/preferences"

describe("parseStored", () => {
  it("reads back what serialize wrote, whatever the type", () => {
    for (const value of [
      true,
      false,
      0.4,
      "slate",
      null,
      ["a"],
      { a: 1 },
    ]) {
      expect(parseStored(serialize(value))).toEqual(value)
    }
  })

  //a hand-edited or half-written value is not worth crashing a screen over
  //nothing usable: the callers fall back on `??`, so null and undefined are one
  it("is nothing usable for a value that is not JSON any more", () => {
    expect(parseStored("{oops") ?? undefined).toBeUndefined()
    expect(parseStored("") ?? undefined).toBeUndefined()
    expect(parseStored("slate") ?? undefined).toBeUndefined()
  })
})

describe("serialize", () => {
  it("is plain JSON, which is what the game already stored", () => {
    expect(serialize(true)).toBe("true")
    expect(serialize("3d")).toBe(`"3d"`)
  })
})

describe("PREF_PREFIX", () => {
  //renaming it resets every player's settings
  it("is the prefix the game already wrote with", () => {
    expect(PREF_PREFIX).toBe("abalone_")
  })
})
