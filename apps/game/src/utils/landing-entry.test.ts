import { describe, expect, it } from "vitest"
import { entryOf, landingEntry } from "@/utils/landing-entry"

const ENTRY_KEY = "abalone.entry.v1"

//an invite link's token: 32 random bytes, base64url
const LINK_ID = "q0Zl3pHcXbE7cJ8n1M2o4r5s6t7u8v9wAaBbCcDdEeF"

/** sessionStorage, as far as the entry needs it. */
function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    values,
  }
}

//storage that refuses, as a locked down or private browser can
const refusingStorage = {
  getItem: (): string | null => {
    throw new Error("SecurityError")
  },
  setItem: (): void => {
    throw new Error("QuotaExceededError")
  },
}

describe("entryOf", () => {
  it.each([
    ["/", "home"],
    ["/rules", "rules"],
    ["/rules/", "rules"],
    ["/strategy", "strategy"],
    ["/strategy/", "strategy"],
    [`/invite/${LINK_ID}`, "invite"],
    ["/offline", "other"],
    ["/online", "other"],
    ["/online/history", "other"],
    ["/profile", "other"],
    //the map before this one still redirects
    ["/game/offline", "other"],
    ["/login", "other"],
    //a path the app does not know is a landing all the same
    ["/rulesx", "other"],
    ["/invite", "other"],
    ["", "home"],
  ] as const)("a tab that first opened %s landed on %s", (path, entry) => {
    expect(entryOf(path)).toBe(entry)
  })
})

describe("landingEntry", () => {
  it("keeps the page the tab first opened", () => {
    const storage = memoryStorage()

    expect(landingEntry("/rules", storage)).toBe("rules")

    expect(storage.values.get(ENTRY_KEY)).toBe("rules")
  })

  //the player reads the rules, then goes to play: the game still came from
  //the rules
  it("does not move when the tab goes to another page", () => {
    const storage = memoryStorage()

    landingEntry("/rules", storage)

    expect(landingEntry("/offline", storage)).toBe("rules")
    expect(landingEntry("/", storage)).toBe("rules")
  })

  it("reads a landing an earlier load of the same tab saved", () => {
    const storage = memoryStorage({ [ENTRY_KEY]: "invite" })

    expect(landingEntry("/offline", storage)).toBe("invite")
  })

  //never send a value the backend refuses: it would lose the whole start
  it("replaces a saved value that is not an entry", () => {
    const storage = memoryStorage({ [ENTRY_KEY]: "/rules?ref=x" })

    expect(landingEntry("/strategy", storage)).toBe("strategy")
    expect(storage.values.get(ENTRY_KEY)).toBe("strategy")
  })

  it("still answers when the browser refuses storage", () => {
    expect(landingEntry("/strategy", refusingStorage)).toBe("strategy")
  })
})
