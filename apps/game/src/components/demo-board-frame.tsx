import type { GameState } from "@repo/abalone-engine/game-state"
import { cellNames } from "@repo/abalone-engine/topology"
import { boardPalette } from "@/render/board-themes"
import { hexCenter } from "@/render/hex-grid"

//---- geometry ----------------
//
// The canvas's own numbers at a scale of one (`BASE_*` in `game-canvas.tsx`,
// and `drawBoard`), so the frame is laid out in the units the canvas is
// before it is scaled to its box.

const WIDTH = 800
const HEIGHT = 700
const CENTER_X = WIDTH / 2
const CENTER_Y = HEIGHT / 2
const CELL_RADIUS = 40
const SPACING = CELL_RADIUS * 1.14
const LINE_WIDTH = 2
const MARBLE_RADIUS = CELL_RADIUS * 0.8
const DIMPLE_RADIUS = CELL_RADIUS * 0.36

/** `drawBoard` insets the hexagon by two line widths so its points are not shaved. */
const HEXAGON_RADIUS = CELL_RADIUS * 10 - LINE_WIDTH * 2

const HEXAGON = Array.from({ length: 6 }, (_, corner) => {
  const angle = (corner * Math.PI) / 3
  const x = CENTER_X + HEXAGON_RADIUS * Math.cos(angle)
  const y = CENTER_Y + HEXAGON_RADIUS * Math.sin(angle)
  return `${x.toFixed(2)},${y.toFixed(2)}`
}).join(" ")

/** The lit marble's shadow slides out from under it, away from the key light. */
const SHADOW_RADIUS = MARBLE_RADIUS * 1.18
const SHADOW_DRIFT = MARBLE_RADIUS * 0.18
const SHADOW_OFFSET_X = SHADOW_DRIFT * 0.573
const SHADOW_OFFSET_Y = SHADOW_DRIFT * 0.819

/** The board the home page shows, whatever theme is set: `SHOWCASE_THEME`. */
const BOARD_COLOR = boardPalette("slate").board

const round = (value: number) => Math.round(value * 100) / 100

const CENTRES = cellNames.map((name) => {
  const [r, q] = name.split(",").map(Number)
  const { x, y } = hexCenter(r, q, CENTER_X, CENTER_Y, SPACING)
  return { name, x: round(x), y: round(y) }
})

/**
 * The board as it is drawn before any script has run: the opening position, as
 * markup.
 *
 * The demo board is a canvas, and a canvas has nothing in it until the page's
 * JavaScript has run and drawn the first frame. On a phone that is seconds of an
 * empty slot in the middle of the poster. This stands in for it: the same
 * hexagon, the same cells and the same marbles, in the canvas's own geometry,
 * with the lit marbles approximated by gradients.
 *
 * It fills the box the canvas measures and centres the board in it the way the
 * canvas letterboxes, so it is the same size as the board it hands over to and
 * nothing moves when it is taken away. The caller removes it in the commit that
 * draws the canvas, so the two are never on screen together or both missing.
 *
 * The board's shadow is a CSS filter at the two sizes `BoardShadow` paints.
 * Filtering is fine here: this picture never changes, which is the thing
 * `BoardShadow` is avoiding for the canvas.
 */
export function DemoBoardFrame({ state }: { state: GameState }) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      data-demo-board-frame=""
      className="pointer-events-none absolute inset-0 size-full max-lg:[filter:drop-shadow(0_26px_46px_rgb(0_0_0/0.55))] lg:[filter:drop-shadow(0_34px_60px_rgb(0_0_0/0.55))]"
    >
      <defs>
        <radialGradient id="demo-ivory" cx="0.36" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.45" stopColor="#f3f2ee" />
          <stop offset="1" stopColor="#a4a8b4" />
        </radialGradient>
        <radialGradient id="demo-onyx" cx="0.36" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#d4dae6" />
          <stop offset="0.07" stopColor="#8a93a4" />
          <stop offset="0.3" stopColor="#3a3f4a" />
          <stop offset="0.8" stopColor="#14171c" />
          <stop offset="1" stopColor="#3e4a5c" />
        </radialGradient>
        <radialGradient id="demo-shadow">
          <stop offset="0.4" stopColor="#0a0e14" stopOpacity="0.4" />
          <stop offset="0.55" stopColor="#0a0e14" stopOpacity="0.3" />
          <stop offset="1" stopColor="#0a0e14" stopOpacity="0" />
        </radialGradient>
      </defs>
      <polygon
        points={HEXAGON}
        fill={BOARD_COLOR}
        stroke="#333"
        strokeWidth={LINE_WIDTH}
      />
      {CENTRES.map(({ name, x, y }) => (
        <circle
          key={name}
          cx={x}
          cy={y}
          r={DIMPLE_RADIUS}
          fill="#444"
          stroke="#333"
          strokeWidth={LINE_WIDTH / 2}
        />
      ))}
      {CENTRES.map(({ name, x, y }) => {
        const isBlack = state.black.has(name)
        if (!isBlack && !state.white.has(name)) return null
        return (
          <g key={name}>
            <circle
              cx={round(x + SHADOW_OFFSET_X)}
              cy={round(y + SHADOW_OFFSET_Y)}
              r={round(SHADOW_RADIUS)}
              fill="url(#demo-shadow)"
            />
            <circle
              cx={x}
              cy={y}
              r={MARBLE_RADIUS}
              fill={isBlack ? "url(#demo-onyx)" : "url(#demo-ivory)"}
              stroke={isBlack ? "#050608" : "#6d7382"}
              strokeWidth={LINE_WIDTH * 0.9}
            />
          </g>
        )
      })}
    </svg>
  )
}
