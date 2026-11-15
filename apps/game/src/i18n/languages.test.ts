import { describe, expect, it } from "vitest"
import {
  isSupported,
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
} from "@/i18n/languages"

describe("isSupported", () => {
  it("accepts every language the game ships in", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      expect(isSupported(language), language).toBe(true)
    }
  })

  it("rejects what it does not ship, undefined included", () => {
    expect(isSupported(undefined)).toBe(false)
    expect(isSupported("")).toBe(false)
    expect(isSupported("sv")).toBe(false)
    //a region tag is not a language of its own
    expect(isSupported("pt-BR")).toBe(false)
  })

  it("is case sensitive: the URL prefix is lowercase", () => {
    expect(isSupported("EN")).toBe(false)
    expect(isSupported("Pt")).toBe(false)
  })

  //`includes` on an array, not a lookup in an object: a prototype property is
  //not a language
  it("does not mistake an object property name for a language", () => {
    expect(isSupported("constructor")).toBe(false)
    expect(isSupported("toString")).toBe(false)
  })
})

describe("LANGUAGE_NAMES", () => {
  it("names every supported language, and only those", () => {
    expect(Object.keys(LANGUAGE_NAMES).sort()).toEqual(
      [...SUPPORTED_LANGUAGES].sort(),
    )
    for (const language of SUPPORTED_LANGUAGES) {
      expect(LANGUAGE_NAMES[language], language).not.toBe("")
    }
  })
})
