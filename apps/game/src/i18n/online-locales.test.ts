import { describe, expect, it } from "vitest"

//every locale's online.json, read the way vite bundles them
const LOCALES = import.meta.glob<{ empty: Record<string, string> }>(
  "./locales/*/online.json",
  {
    eager: true,
    import: "default",
  },
)

const english = LOCALES["./locales/en/online.json"]

//the empty online page is the first thing a new account sees (TUD-850). the
//old body line asked for a username, which a new player's friends do not have,
//so it is a new key rather than a new value: a locale still carrying the old
//line fails here instead of shipping it
describe("the empty online page", () => {
  it("has the link-first keys in english and not the old body line", () => {
    expect(Object.keys(english.empty).sort()).toEqual([
      "invite_by_name",
      "link_body",
      "play_bot",
      "title",
    ])
  })

  it("does not ask for a username in english", () => {
    expect(english.empty.link_body).not.toMatch(/name/i)
  })

  it.each(
    Object.keys(LOCALES).filter(
      (path) => path !== "./locales/en/online.json",
    ),
  )("%s has every key english has, each one filled", (path) => {
    const empty = LOCALES[path].empty
    expect(Object.keys(empty).sort()).toEqual(
      Object.keys(english.empty).sort(),
    )
    for (const value of Object.values(empty))
      expect(value.trim()).not.toBe("")
  })
})
