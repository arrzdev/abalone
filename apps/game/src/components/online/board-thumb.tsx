import {
  ALL_CELLS,
  cellCol,
  cellNamed,
  cellRow,
  NOWHERE,
} from "@repo/abalone-engine/topology"
import type { CellName } from "@repo/abalone-engine/types"
import { cn } from "@repo/nativ/utils"
import { hexCenter } from "@/render/hex-grid"

//---- geometry ----------------

const CENTER_X = 400
const CENTER_Y = 350
const SPACING = 45.6
const CELL_RADIUS = 14.4
const MARBLE_RADIUS = 32

/** The felt, as the six corners of the board rather than a rounded box. */
const FELT = "796,350 598,692.95 202,692.95 4,350 202,7.05 598,7.05"

/** All sixty-one centres, worked out once. A row never recomputes them. */
const CENTRES = ALL_CELLS.map((cell) =>
  hexCenter(cellRow[cell], cellCol[cell], CENTER_X, CENTER_Y, SPACING),
)

/**
 * The cells a list of names actually points at.
 *
 * Anything naming no square is dropped rather than drawn, which is what the
 * engine does with the same input. A position is stored as names and read back
 * by a client that may be older than the board it is reading, and one bad name
 * should cost a marble rather than the whole screen.
 */
function cellsOf(names: CellName[]) {
  return names.map(cellNamed).filter((cell) => cell !== NOWHERE)
}

export type BoardThumbProps = {
  blackCells: CellName[]
  whiteCells: CellName[]
  className?: string
}

/**
 * A game's position at the size of a list row.
 *
 * It is what makes a row read as *this* game rather than as another line with a
 * name on it. Two of your games against the same opponent are one glance apart
 * here and identical without it.
 *
 * Not the board renderer, and not the rules diagrams: both of those are canvases
 * that measure their box and repaint, and a list of eight of them is eight
 * resize observers and eight contexts for a picture that never animates. This is
 * markup, so it costs a paint.
 *
 * The palette is the board's, with two deliberate exceptions. At this size a
 * `#333` marble on a `#444` hole is the same grey, and every position reads
 * alike — so the empty cells come up to a light slate and the black marbles go
 * almost to black. It is a thumbnail's contrast, not the board's.
 */
export function BoardThumb({
  blackCells,
  whiteCells,
  className,
}: BoardThumbProps) {
  return (
    <svg
      viewBox="0 0 800 700"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      className={cn("h-full w-full", className)}
    >
      <polygon
        points={FELT}
        fill="var(--board)"
        stroke="var(--marble-black)"
        strokeWidth={2}
      />

      {CENTRES.map((centre) => (
        <circle
          key={`${centre.x},${centre.y}`}
          cx={centre.x}
          cy={centre.y}
          r={CELL_RADIUS}
          fill="#8496a6"
          stroke="#63737f"
        />
      ))}

      {cellsOf(whiteCells).map((cell) => (
        <circle
          key={cell}
          cx={CENTRES[cell].x}
          cy={CENTRES[cell].y}
          r={MARBLE_RADIUS}
          fill="var(--marble-white)"
          stroke="rgb(0 0 0 / 0.45)"
          strokeWidth={3}
        />
      ))}

      {cellsOf(blackCells).map((cell) => (
        <circle
          key={cell}
          cx={CENTRES[cell].x}
          cy={CENTRES[cell].y}
          r={MARBLE_RADIUS}
          fill="#0d0d0d"
          stroke="#000000"
          strokeWidth={3}
        />
      ))}
    </svg>
  )
}
