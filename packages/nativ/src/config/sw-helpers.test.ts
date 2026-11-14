import path from "node:path"
import { describe, expect, it } from "vitest"
import { resolveSwBuildConfig } from "#nativ/config/sw-helpers"

function isPrecached(file: string, patterns: string[]): boolean {
  return patterns.some((pattern) => path.matchesGlob(file, pattern))
}

describe("resolveSwBuildConfig default glob patterns", () => {
  const { globPatterns } = resolveSwBuildConfig({}, "/app")

  it.each([
    "assets/index-a1b2c3.js",
    "assets/main-a1b2c3.css",
    "index.html",
    "assets/nyx-a1b2c3.webp",
    "fonts/inter-a1b2c3.woff2",
  ])("precaches %s", (file) => {
    expect(isPrecached(file, globPatterns)).toBe(true)
  })

  it("leaves audio to the runtime cache", () => {
    expect(isPrecached("assets/move-a1b2c3.m4a", globPatterns)).toBe(false)
  })
})
