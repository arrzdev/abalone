/**
 * The colours a board can be painted in.
 *
 * A theme is paint and nothing else: the board's own fill, the ink of the rank
 * and file down its edges, and the ring a picked-up marble wears. The marbles,
 * the holes and the red of a board being reviewed are the same in every theme,
 * because they are what the game is read by.
 *
 * Only boards this dark hold both marbles. A `#333` and a `#fff` marble each
 * reach 3:1 against the board only while its relative luminance sits between
 * about 0.2 and 0.3; Walnut and Felt are both near 0.22. A light board would
 * lose the white marbles, which is why there is none.
 *
 * Keep the `board` values in step with the `[data-board-theme]` rules in
 * `main.css`, which paint `--board` for the markup that draws a board.
 */

export type BoardPalette = {
  board: string
  /** The a–i and 1–9 down the edges: 4.5:1 against `board`, as text. */
  ink: string
  /** Around a selected or hovered marble: 3:1 against `board`, as a graphic. */
  ring: string
}

export const BOARD_THEMES = {
  /** The board the game has always had, ring and all. */
  slate: { board: "#627384", ink: "#fff", ring: "#7ec2e1" },
  walnut: { board: "#a07a52", ink: "#111", ring: "#e0f4ff" },
  felt: { board: "#5f8c6e", ink: "#111", ring: "#e0f4ff" },
} as const satisfies Record<string, BoardPalette>

export type BoardTheme = keyof typeof BOARD_THEMES

/** In the order the picker shows them. */
export const BOARD_THEME_NAMES: readonly BoardTheme[] = [
  "slate",
  "walnut",
  "felt",
]

export const DEFAULT_BOARD_THEME: BoardTheme = "slate"

export function hasBoardTheme(name: string): name is BoardTheme {
  return Object.hasOwn(BOARD_THEMES, name)
}

/** The palette for a theme by name; anything unknown is Slate. */
export function boardPalette(name: string | undefined): BoardPalette {
  return name !== undefined && hasBoardTheme(name)
    ? BOARD_THEMES[name]
    : BOARD_THEMES[DEFAULT_BOARD_THEME]
}
