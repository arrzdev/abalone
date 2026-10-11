import { describe, expect, it } from "vitest"

//every locale's game.json, read the way vite bundles them
const LOCALES = import.meta.glob<{ rules: unknown }>(
  "./locales/*/game.json",
  {
    eager: true,
    import: "default",
  },
)

/** Every leaf key under an object, as dotted paths. */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix]
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  )
}

const english = LOCALES["./locales/en/game.json"]

//the rules page is a page people find by searching in their own language. a key
//missing from a locale falls back to english in the middle of a translated page
describe("rules copy", () => {
  it.each(
    Object.keys(LOCALES).filter(
      (path) => path !== "./locales/en/game.json",
    ),
  )("%s has every rules key english has", (path) => {
    expect(keyPaths(LOCALES[path].rules).sort()).toEqual(
      keyPaths(english.rules).sort(),
    )
  })
})
