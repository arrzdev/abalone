import { describe, expect, it } from "vitest"
import { isEasterEggHostname, renameBrand } from "@/utils/brand"

describe("isEasterEggHostname", () => {
  it("hatches on any host carrying the word", () => {
    expect(isEasterEggHostname("babaluje.tld")).toBe(true)
    expect(isEasterEggHostname("babaluje.domain.com")).toBe(true)
    expect(isEasterEggHostname("www.babaluje.dev")).toBe(true)
    expect(isEasterEggHostname("BABALUJE.LOCALHOST")).toBe(true)
  })

  it("stays shut everywhere else", () => {
    expect(isEasterEggHostname("abalone.tudu.dev")).toBe(false)
    expect(isEasterEggHostname("localhost")).toBe(false)
    expect(isEasterEggHostname("")).toBe(false)
  })
})

describe("renameBrand", () => {
  it("renames the game wherever the word appears", () => {
    expect(renameBrand("Play Abalone in your browser")).toBe(
      "Play Babaluje in your browser",
    )
    expect(renameBrand("Abalone, Abalone, Abalone")).toBe(
      "Babaluje, Babaluje, Babaluje",
    )
  })

  //a keyword line is lowercase and a heading is sometimes a shout, so the
  //replacement has to arrive dressed the same way the word it replaces was
  it("keeps the case of the word it replaces", () => {
    expect(renameBrand("abalone online")).toBe("babaluje online")
    expect(renameBrand("ABALONE")).toBe("BABALUJE")
    expect(renameBrand("Weteran Abalone")).toBe("Weteran Babaluje")
  })

  it("leaves text without the word alone", () => {
    expect(renameBrand("Play online, vs bots, or pass and play")).toBe(
      "Play online, vs bots, or pass and play",
    )
  })
})
