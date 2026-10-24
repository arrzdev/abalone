import { describe, expect, it } from "vitest"

//every locale's common.json, read the way vite bundles them
const LOCALES = import.meta.glob<{
  auth: { errors: Record<string, string> }
}>("./locales/*/common.json", {
  eager: true,
  import: "default",
})

//a locked sign-in says "try again later" and never how long the lock lasts
//(board, all products): no placeholder for the wait, no number, in any locale
describe.each(Object.keys(LOCALES))("%s locked sign-in", (path) => {
  const message = LOCALES[path].auth.errors.account_locked

  it("asks to try again later without the wait", () => {
    expect(message).toEqual(expect.any(String))
    expect(message).not.toMatch(/{{|\d/)
  })
})
