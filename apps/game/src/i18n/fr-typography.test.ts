import { describe, expect, it } from "vitest"

//every french locale file, read the way vite bundles them
const FRENCH_FILES = import.meta.glob<Record<string, unknown>>(
  "./locales/fr/*.json",
  {
    eager: true,
    import: "default",
  },
)

//french sets ? ! : ; and the inside of « » apart with a space, and that space
//must not break: a plain one lets the mark wrap alone onto the next line
const PLAIN_SPACE_BEFORE_MARK = / [?!:;»]/
const PLAIN_SPACE_AFTER_OPENING_QUOTE = /« /

function collectStrings(
  value: unknown,
  path: string,
): Array<{ path: string; text: string }> {
  if (typeof value === "string") return [{ path, text: value }]
  if (typeof value !== "object" || value === null) return []
  return Object.entries(value).flatMap(([key, child]) =>
    collectStrings(child, `${path}.${key}`),
  )
}

describe.each(Object.entries(FRENCH_FILES))(
  "%s typography",
  (file, json) => {
    const strings = collectStrings(json, file)

    it("has strings to check", () => {
      expect(strings.length).toBeGreaterThan(0)
    })

    it("keeps a non-breaking space before ? ! : ; and inside « »", () => {
      const offenders = strings
        .filter(
          ({ text }) =>
            PLAIN_SPACE_BEFORE_MARK.test(text) ||
            PLAIN_SPACE_AFTER_OPENING_QUOTE.test(text),
        )
        .map(({ path }) => path)
      expect(offenders).toEqual([])
    })
  },
)
