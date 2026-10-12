import { describe, expect, it } from "vitest"

//each offline mode has one name, `controls.mode_ai` and `controls.mode_local`,
//and the four places a player meets it read that key: the home card, the setup
//tab, the game header and the tab title (TUD-853). these are the keys that used
//to give the computer mode a second and third name, and the ones that replace
//them

type Locale = Record<string, Record<string, unknown>>

const GAME = import.meta.glob<Locale>("./locales/*/game.json", {
  eager: true,
  import: "default",
})
const COMMON = import.meta.glob<Locale>("./locales/*/common.json", {
  eager: true,
  import: "default",
})

const LOCALES = Object.keys(GAME).map(
  (path) => path.split("/")[2] as string,
)

function game(locale: string): Locale {
  return GAME[`./locales/${locale}/game.json`] as Locale
}

function common(locale: string): Locale {
  return COMMON[`./locales/${locale}/common.json`] as Locale
}

it("covers all thirteen languages", () => {
  expect(LOCALES).toHaveLength(13)
})

describe.each(LOCALES)("%s", (locale) => {
  it("has no second name for the computer mode in the game header", () => {
    expect(game(locale).controls).not.toHaveProperty("page_title")
  })

  it("has no second name for the offline modes on home", () => {
    expect(common(locale).home).not.toHaveProperty("play_offline")
  })

  it("names the mode in the setup screen's header", () => {
    expect(game(locale).controls.setup_title).toEqual(
      expect.stringContaining("{{mode}}"),
    )
  })

  //the nav item opens the setup screen, which has both modes on it, so it
  //names neither of them
  it("keeps the nav item to the setup screen free of a mode's name", () => {
    const label = common(locale).nav.offline as string
    const { mode_ai: computer, mode_local: local } = game(locale)
      .controls as Record<string, string>

    expect(label).not.toContain(computer)
    expect(label).not.toContain(local)
  })
})

describe("in english", () => {
  it("calls the computer mode vs Computer and the other Pass & Play", () => {
    expect(game("en").controls.mode_ai).toBe("vs Computer")
    expect(game("en").controls.mode_local).toBe("Pass & Play")
  })

  it("labels the nav item Play", () => {
    expect(common("en").nav.offline).toBe("Play")
  })
})
