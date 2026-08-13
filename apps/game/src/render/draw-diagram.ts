import type { AxialStep, CellName, Player } from "@/engine/types"
import { hexCenter } from "@/render/hex-grid"
import { renderMarble } from "@/render/marble-renderer"

/**
 * Small, standalone board diagrams for the rules page.
 *
 * Deliberately not the board renderer: that one paints all sixty-one cells of a
 * real position, and a rule is far easier to read on the four or five cells it
 * actually concerns. What the two share is `renderMarble`, so the marbles in an
 * illustration are the very ones the player is about to push around — including
 * whichever design they have chosen.
 *
 * A diagram is a plain object, so each rule reads as a little position:
 *
 *   { cells: ['0,-1', '0,0', '0,1'], marbles: { '0,-1': 'white' },
 *     arrows: [{ pos: '0,-1', dir: [0, 1] }], marks: [{ pos: '0,1', kind: 'target' }] }
 *
 * Marbles may sit on positions that are not in `cells`; with no tile under them
 * they read as off the board, which is exactly what a capture looks like.
 */

export type DiagramArrow = {
  pos: CellName
  dir: AxialStep
}

export type DiagramMark = {
  pos: CellName
  kind: "target" | "blocked"
}

export type Diagram = {
  cells: CellName[]
  marbles?: Record<CellName, Player>
  arrows?: DiagramArrow[]
  marks?: DiagramMark[]
}

export type DrawDiagramOptions = Diagram & {
  /** CSS pixels. */
  width: number
  height: number
  marbleDesign?: string
}

const BOARD_FILL = "#627384"
const FIELD_FILL = "#444"
const FIELD_STROKE = "#333"
/** Both kept in step with the board's own empty squares — see `draw-board.ts`. */
const FIELD_RATIO = 0.36
const FIELD_STROKE_SCALE = 0.5
const MARBLE_FILL: Record<Player, string> = {
  white: "#fff",
  black: "#333",
}

/** Proportions copied from the board so a diagram is recognisably the same game. */
const MARBLE_RATIO = 0.8 // of the cell radius
const SPACING_RATIO = 1.14 // cell radius → hex grid size

function hexPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    // Pointy-top, so neighbouring tiles meet edge to edge with no seam.
    const angle = (i * Math.PI) / 3 + Math.PI / 6
    const px = x + size * Math.cos(angle)
    const py = y + size * Math.sin(angle)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

/**
 * The board marks a move with a bare chevron on each marble, so that is what a
 * marble gets here too — the illustration and the game agree. An empty space has
 * nothing to sit on, and a chevron alone there reads as a bracket around the
 * hole, so it gets a shaft and becomes an arrow.
 */
function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  radius: number,
  lineWidth: number,
  color: string,
  onMarble: boolean,
): void {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const head = radius * (onMarble ? 0.5 : 0.34)
  const tipX = x + dx * (onMarble ? head : radius * 0.55)
  const tipY = y + dy * (onMarble ? head : radius * 0.55)
  const wing = onMarble ? Math.PI / 3 : Math.PI / 5

  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth * (onMarble ? 2 : 1.8)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"

  if (!onMarble) {
    ctx.beginPath()
    ctx.moveTo(x - dx * radius * 0.55, y - dy * radius * 0.55)
    ctx.lineTo(tipX, tipY)
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.moveTo(
    tipX - head * Math.cos(angle - wing),
    tipY - head * Math.sin(angle - wing),
  )
  ctx.lineTo(tipX, tipY)
  ctx.lineTo(
    tipX - head * Math.cos(angle + wing),
    tipY - head * Math.sin(angle + wing),
  )
  ctx.stroke()
}

/** The "not allowed" mark: a red disc with a bar across it. */
function drawBlocked(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  lineWidth: number,
): void {
  ctx.beginPath()
  ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2)
  ctx.strokeStyle = "#fa412d"
  ctx.lineWidth = lineWidth * 2
  ctx.stroke()

  const d = radius * 0.5 * Math.SQRT1_2
  ctx.beginPath()
  ctx.moveTo(x - d, y + d)
  ctx.lineTo(x + d, y - d)
  ctx.stroke()
}

const toCoords = (pos: CellName) => pos.split(",").map(Number)

/**
 * The bounding box of everything a diagram paints, in grid units — a tile of
 * grid size 1 reaches √3/2 sideways and 1 vertically from its centre.
 */
function bounds({ cells, marbles = {}, marks = [] }: Diagram) {
  const positions = [
    ...new Set([
      ...cells,
      ...Object.keys(marbles),
      ...marks.map((mark) => mark.pos),
    ]),
  ]
  const unit = positions.map((pos) => {
    const [r, q] = toCoords(pos)
    return hexCenter(r, q, 0, 0, 1)
  })

  return {
    minX: Math.min(...unit.map((p) => p.x)) - Math.sqrt(3) / 2,
    maxX: Math.max(...unit.map((p) => p.x)) + Math.sqrt(3) / 2,
    minY: Math.min(...unit.map((p) => p.y)) - 1,
    maxY: Math.max(...unit.map((p) => p.y)) + 1,
  }
}

/**
 * How wide a diagram is for its height. The caller shapes the canvas from this
 * rather than guessing a ratio per illustration: get it wrong and the diagram
 * simply shrinks to fit, leaving a band of dead space beside it.
 */
export function diagramAspect(diagram: Diagram): number {
  const { minX, maxX, minY, maxY } = bounds(diagram)
  return (maxX - minX) / (maxY - minY)
}

/** Paints one diagram, scaled to fill the canvas. */
export function drawDiagram(
  ctx: CanvasRenderingContext2D,
  {
    width,
    height,
    cells,
    marbles = {},
    arrows = [],
    marks = [],
    marbleDesign = "default",
  }: DrawDiagramOptions,
): void {
  ctx.clearRect(0, 0, width, height)

  if (cells.length === 0) return

  // Everything that gets painted has to fit, off-board marbles included.
  const { minX, maxX, minY, maxY } = bounds({ cells, marbles, marks })
  const spacing = Math.min(width / (maxX - minX), height / (maxY - minY))
  const centerX = width / 2 - ((minX + maxX) / 2) * spacing
  const centerY = height / 2 - ((minY + maxY) / 2) * spacing

  const radius = spacing / SPACING_RATIO
  const lineWidth = Math.max(1, radius / 14)
  const at = (pos: CellName) => {
    const [r, q] = toCoords(pos)
    return hexCenter(r, q, centerX, centerY, spacing)
  }

  // The tiles tile exactly, so the patch comes out as one solid shape.
  cells.forEach((pos) => {
    const { x, y } = at(pos)
    hexPath(ctx, x, y, spacing)
    ctx.fillStyle = BOARD_FILL
    ctx.fill()
  })

  cells.forEach((pos) => {
    const { x, y } = at(pos)
    ctx.beginPath()
    ctx.arc(x, y, radius * FIELD_RATIO, 0, Math.PI * 2)
    ctx.fillStyle = FIELD_FILL
    ctx.fill()
    ctx.lineWidth = lineWidth * FIELD_STROKE_SCALE
    ctx.strokeStyle = FIELD_STROKE
    ctx.stroke()
  })

  marks
    .filter((mark) => mark.kind === "target")
    .forEach((mark) => {
      const { x, y } = at(mark.pos)
      ctx.beginPath()
      ctx.arc(x, y, radius * 0.2, 0, Math.PI * 2)
      ctx.fillStyle = "#ccc"
      ctx.fill()
    })

  Object.entries(marbles).forEach(([pos, color]) => {
    const { x, y } = at(pos)
    // Off the board is drawn, not implied: a captured marble is half faded and
    // has no tile beneath it.
    const isOnBoard = cells.includes(pos)
    ctx.save()
    if (!isOnBoard) ctx.globalAlpha = 0.45
    renderMarble(
      marbleDesign,
      ctx,
      x,
      y,
      radius * MARBLE_RATIO,
      MARBLE_FILL[color],
      false,
      false,
      lineWidth,
    )
    ctx.restore()
  })

  arrows.forEach(({ pos, dir }) => {
    const { x, y } = at(pos)
    const step = hexCenter(dir[0], dir[1], 0, 0, spacing)
    const angle = Math.atan2(step.y, step.x)
    // Same contrast rule as the board: dark on a light marble, light otherwise.
    const color = marbles[pos] === "white" ? "#333" : "#fff"
    drawArrow(ctx, x, y, angle, radius, lineWidth, color, pos in marbles)
  })

  marks
    .filter((mark) => mark.kind === "blocked")
    .forEach((mark) => {
      const { x, y } = at(mark.pos)
      drawBlocked(ctx, x, y, radius, lineWidth)
    })
}
