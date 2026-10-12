import { describe, expect, it } from "vitest"

//every locale's common.json, read the way vite bundles them
const LOCALES = import.meta.glob<{ home: Record<string, unknown> }>(
  "./locales/*/common.json",
  {
    eager: true,
    import: "default",
  },
)

//one line under each home card, the same at every size (the `home-cards`
//document on TUD-819): a key missing from a locale falls back to english on a
//translated front door, and a leftover short/long pair means a size still
//picks its own line
describe.each(Object.keys(LOCALES))("%s home cards", (path) => {
  const home = LOCALES[path].home

  it.each(["bot_hint", "local_hint", "online_hint"])("has %s", (key) => {
    expect(home[key]).toEqual(expect.any(String))
    expect(home[key]).not.toBe("")
  })

  it("has no line kept for one size only", () => {
    expect(
      Object.keys(home).filter((key) => /_hint_(short|long)$/.test(key)),
    ).toEqual([])
  })
})

describe("english home cards", () => {
  const home = LOCALES["./locales/en/common.json"].home

  it("say what each mode needs", () => {
    expect(home.bot_hint).toBe("Eight bots, easy to hard.")
    expect(home.local_hint).toBe("Two of you, one device.")
    expect(home.online_hint).toBe("Free account. Invite anyone.")
  })
})
