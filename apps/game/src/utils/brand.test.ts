import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  applyBrandToDocument,
  brandName,
  brandText,
  isEasterEggHostname,
  renameBrand,
} from "@/utils/brand"

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

//the egg is read off the page's own hostname on every call, so a test moves
//the page to a host and back
function visit(hostname: string) {
  //why: happy-dom's window extras are not in the dom lib's `Window`
  const { happyDOM } = window as unknown as {
    happyDOM: { setURL: (url: string) => void }
  }
  happyDOM.setURL(`http://${hostname}/`)
}

describe("brandText and brandName", () => {
  afterEach(() => {
    visit("localhost")
  })

  it("leave the game's name alone off the egg host", () => {
    visit("abalone.tudu.dev")

    expect(brandText("Play Abalone")).toBe("Play Abalone")
    expect(brandName()).toBe("Abalone")
  })

  it("rename it on the egg host", () => {
    visit("babaluje.localhost")

    expect(brandText("Play Abalone")).toBe("Play Babaluje")
    expect(brandName()).toBe("Babaluje")
  })
})

describe("applyBrandToDocument", () => {
  beforeEach(() => {
    document.head.innerHTML = `<meta name="description" content="Play Abalone"><meta name="robots" content="index">`
    document.title = "Abalone online"
  })

  afterEach(() => {
    visit("localhost")
    document.head.innerHTML = ""
  })

  it("leaves the head alone off the egg host", () => {
    visit("abalone.tudu.dev")

    applyBrandToDocument()

    expect(document.title).toBe("Abalone online")
    expect(
      document.head
        .querySelector("meta[name=description]")
        ?.getAttribute("content"),
    ).toBe("Play Abalone")
  })

  it("renames the title and the meta content on the egg host", () => {
    visit("babaluje.localhost")

    applyBrandToDocument()

    expect(document.title).toBe("Babaluje online")
    expect(
      document.head
        .querySelector("meta[name=description]")
        ?.getAttribute("content"),
    ).toBe("Play Babaluje")
    //nothing to rename, nothing written
    expect(
      document.head
        .querySelector("meta[name=robots]")
        ?.getAttribute("content"),
    ).toBe("index")
  })

  //the router rewrites the head on every navigation, so one pass is not enough
  it("renames again when the router writes a new head", async () => {
    visit("babaluje.localhost")
    applyBrandToDocument()

    document.head
      .querySelector("meta[name=description]")
      ?.setAttribute("content", "Abalone rules")
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(
      document.head
        .querySelector("meta[name=description]")
        ?.getAttribute("content"),
    ).toBe("Babaluje rules")
  })
})

describe("renameBrand with a replacement", () => {
  it("dresses the replacement in the case of the word it replaces", () => {
    expect(renameBrand("Abalone ABALONE abalone", "Foo")).toBe(
      "Foo FOO foo",
    )
  })
})
