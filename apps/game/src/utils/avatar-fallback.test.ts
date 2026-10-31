import { describe, expect, it } from "vitest"
import {
  AVATAR_FALLBACK_COLORS,
  AVATAR_FALLBACK_TEXT_COLOR,
  getAvatarColor,
  getInitials,
} from "@/utils/avatar-fallback"

function luminance(hex: string): number {
  const [red, green, blue] = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [
    luminance(foreground),
    luminance(background),
  ].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

describe("getInitials", () => {
  it("takes the first and last word's first letters", () => {
    expect(getInitials("Ana Silva")).toBe("AS")
    expect(getInitials("Ana Maria da Silva")).toBe("AS")
  })

  it("gives one letter for one word", () => {
    expect(getInitials("rui")).toBe("R")
  })

  it("reads a username's separators as word breaks", () => {
    expect(getInitials("ana_silva")).toBe("AS")
    expect(getInitials("ana.silva-9")).toBe("A9")
  })

  it("ignores stray spaces and shows nothing for no name", () => {
    expect(getInitials("  ana   silva ")).toBe("AS")
    expect(getInitials("")).toBe("")
    expect(getInitials("   ")).toBe("")
    expect(getInitials(null)).toBe("")
    expect(getInitials(undefined)).toBe("")
  })

  it("keeps a whole character, not half of one", () => {
    expect(getInitials("😀 Zoë")).toBe("😀Z")
    expect(getInitials("山田 太郎")).toBe("山太")
  })
})

describe("getAvatarColor", () => {
  it("is the same colour every time for the same name", () => {
    expect(getAvatarColor("ana")).toBe(getAvatarColor("ana"))
    expect(getAvatarColor("Ana")).toBe(getAvatarColor(" ana "))
  })

  it("always comes from the palette", () => {
    for (const name of [
      "",
      "a",
      "ana",
      "rui",
      "山田 太郎",
      "x".repeat(200),
    ]) {
      expect(AVATAR_FALLBACK_COLORS).toContain(getAvatarColor(name))
    }
  })

  it("spreads a crowd across most of the palette", () => {
    const names = Array.from(
      { length: 200 },
      (_, index) => `player${index}`,
    )
    const used = new Set(names.map((name) => getAvatarColor(name)))
    expect(used.size).toBeGreaterThanOrEqual(
      AVATAR_FALLBACK_COLORS.length - 1,
    )
  })

  it("holds the initials at AA contrast on every colour", () => {
    for (const color of AVATAR_FALLBACK_COLORS) {
      expect(
        contrast(AVATAR_FALLBACK_TEXT_COLOR, color),
      ).toBeGreaterThanOrEqual(4.5)
    }
  })
})
