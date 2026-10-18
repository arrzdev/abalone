import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  BOARD_THEME_NAMES,
  BOARD_THEMES,
  boardPalette,
} from "@/render/board-themes"

/** WCAG 2.x relative luminance of a `#rgb` or `#rrggbb` colour. */
function luminance(hex: string): number {
  const digits =
    hex.length === 4
      ? [...hex.slice(1)].map((digit) => digit + digit)
      : [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)]
  const [red, green, blue] = digits.map((pair) => {
    const channel = Number.parseInt(pair, 16) / 255
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

//the marbles are the same on every board; only what is under them changes
const WHITE_MARBLE = "#fff"
const MARBLE_OUTLINE = "#000"

describe("board themes", () => {
  it("offers Slate, Walnut and Felt, in that order", () => {
    expect(BOARD_THEME_NAMES).toEqual(["slate", "walnut", "felt"])
  })

  it("keeps Slate exactly the board the game has always had", () => {
    expect(BOARD_THEMES.slate).toEqual({
      board: "#627384",
      ink: "#fff",
      ring: "#7ec2e1",
    })
  })

  for (const name of BOARD_THEME_NAMES) {
    const { board, ink } = BOARD_THEMES[name]

    it(`${name}: the labels read as text and both marbles stand out`, () => {
      expect(contrast(ink, board)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(WHITE_MARBLE, board)).toBeGreaterThanOrEqual(3)
      expect(contrast(MARBLE_OUTLINE, board)).toBeGreaterThanOrEqual(3)
    })
  }

  //Slate's ring is today's, and stays below 3:1 on purpose until that is
  //decided; the two new boards have to clear it
  for (const name of ["walnut", "felt"] as const) {
    it(`${name}: the selection ring stands out from the board`, () => {
      const { board, ring } = BOARD_THEMES[name]
      expect(contrast(ring, board)).toBeGreaterThanOrEqual(3)
    })
  }

  it("paints anything it does not know as Slate", () => {
    expect(boardPalette(undefined)).toBe(BOARD_THEMES.slate)
    expect(boardPalette("sand")).toBe(BOARD_THEMES.slate)
    expect(boardPalette("toString")).toBe(BOARD_THEMES.slate)
    expect(boardPalette("felt")).toBe(BOARD_THEMES.felt)
  })

  it("keeps the stylesheet's --board in step with the canvas", () => {
    const css = readFileSync(
      `${process.cwd()}/src/styles/main.css`,
      "utf8",
    )
    expect(css).toMatch(
      new RegExp(`--board: ${BOARD_THEMES.slate.board};`),
    )
    for (const name of ["walnut", "felt"] as const) {
      expect(css).toMatch(
        new RegExp(
          `\\[data-board-theme="${name}"\\] \\{\\s*--board: ${BOARD_THEMES[name].board};`,
        ),
      )
    }
  })
})
