import { afterEach, describe, expect, it, vi } from "vitest"
import {
  BOT_LEVELS,
  BOTS,
  blurbKey,
  EVENT_RANK,
  getBot,
  pickLine,
  SAY,
  titleKey,
} from "@/i18n/bots"
import enBots from "@/i18n/locales/en/bots.json"

const LOCALES = import.meta.glob<Record<string, unknown>>(
  "./locales/*/bots.json",
  { eager: true, import: "default" },
)

describe("the roster", () => {
  it("has eight bots, levelled 1 to 8, each with its own id and name", () => {
    expect(BOT_LEVELS).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(new Set(Object.values(BOTS).map((bot) => bot.id)).size).toBe(8)
    expect(new Set(Object.values(BOTS).map((bot) => bot.name)).size).toBe(
      8,
    )
  })

  it("has a pool of lines for every bot and every moment", () => {
    for (const { id } of Object.values(BOTS)) {
      const bot = (
        enBots as unknown as Record<string, Record<string, unknown>>
      )[id]
      expect(bot, id).toBeDefined()
      for (const event of Object.values(SAY)) {
        expect(bot[event], `${id}.${event}`).toEqual(expect.any(Array))
        expect(
          (bot[event] as string[]).length,
          `${id}.${event}`,
        ).toBeGreaterThan(0)
      }
    }
  })

  //a translator adds or drops a line in one file, and `pickLine` counts off the
  //english pools: a shorter pool elsewhere means a key that resolves to nothing
  it("has at least as many lines in every language as the english pools", () => {
    for (const [path, locale] of Object.entries(LOCALES)) {
      for (const { id } of Object.values(BOTS)) {
        const english = (
          enBots as unknown as Record<string, Record<string, string[]>>
        )[id]
        const translated = locale[id] as Record<string, string[]>
        for (const event of Object.values(SAY)) {
          expect(
            translated[event].length,
            `${path} ${id}.${event}`,
          ).toBeGreaterThanOrEqual(english[event].length)
        }
      }
    }
  })
})

describe("getBot", () => {
  it("is the character at the level", () => {
    expect(getBot(3)).toEqual({ id: "nora", name: "Nora" })
  })

  it("falls back to the first bot for a level that does not exist", () => {
    expect(getBot(0)).toEqual(BOTS[1])
    expect(getBot(99)).toEqual(BOTS[1])
    expect(getBot(Number.NaN)).toEqual(BOTS[1])
  })
})

describe("blurbKey and titleKey", () => {
  it("name the bot's own entry in the bots namespace", () => {
    expect(blurbKey(2)).toBe("bots:milo.blurb")
    expect(titleKey(2)).toBe("bots:milo.title")
  })

  it("follow the fallback for an unknown level", () => {
    expect(blurbKey(42)).toBe("bots:gus.blurb")
  })
})

describe("EVENT_RANK", () => {
  it("puts a marble leaving the board first and small talk last", () => {
    expect(EVENT_RANK[0]).toBe(SAY.BOT_PUSHES_OPPONENT_OFF)
    expect(EVENT_RANK.at(-1)).toBe(SAY.AMBIENT)
  })

  it("leaves out the moments that compete with nothing", () => {
    expect(EVENT_RANK).not.toContain(SAY.OPENING)
    expect(EVENT_RANK).not.toContain(SAY.GAME_END_WIN)
    expect(EVENT_RANK).not.toContain(SAY.GAME_END_LOSS)
  })
})

describe("pickLine", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("is a key into the bot's pool for the moment", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    expect(pickLine(1, SAY.OPENING)).toBe("bots:gus.opening.0")
  })

  it("can reach the last line of the pool", () => {
    const size = enBots.gus.opening.length
    vi.spyOn(Math, "random").mockReturnValue(0.999)
    expect(pickLine(1, SAY.OPENING)).toBe(`bots:gus.opening.${size - 1}`)
  })

  it("never repeats the line it is asked to avoid", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    expect(pickLine(1, SAY.OPENING, "bots:gus.opening.0")).toBe(
      "bots:gus.opening.1",
    )

    //whatever the roll, the avoided key is out of the draw
    const size = enBots.gus.opening.length
    for (let step = 0; step < size; step++) {
      vi.spyOn(Math, "random").mockReturnValue(step / size)
      expect(pickLine(1, SAY.OPENING, "bots:gus.opening.3")).not.toBe(
        "bots:gus.opening.3",
      )
    }
  })

  it("ignores an avoid key from another pool", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    expect(pickLine(1, SAY.OPENING, "bots:milo.opening.0")).toBe(
      "bots:gus.opening.0",
    )
  })

  it("speaks as the fallback bot for an unknown level", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    expect(pickLine(99, SAY.AMBIENT)).toBe("bots:gus.ambient.0")
  })
})
