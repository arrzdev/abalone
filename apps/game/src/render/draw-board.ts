import { MAX_LINE } from "@/engine/config"
import type { GameState } from "@/engine/game-state"
import { isValidSelection } from "@/engine/game-state"
import type { MovingMarble } from "@/engine/rules"
import { directionBetween } from "@/engine/rules"
import { cellNamed, NOWHERE } from "@/engine/topology"
import type { AxialStep, CellName, Point } from "@/engine/types"
import { cellFromPoint, hexCenter, STEP } from "@/render/hex-grid"
import { renderMarble, renderMarbleShadow } from "@/render/marble-renderer"

/**
 * Painting the board.
 *
 * One pure function of (view geometry, game state, animation frame): give it
 * the same three and it paints the same pixels. That is what lets the React
 * component treat repainting as something it can do freely, whenever anything
 * it holds happens to change.
 */

/** The canvas the board is being painted onto, in CSS pixels. */
export type BoardView = {
  centerX: number
  centerY: number
  radius: number
  spacing: number
  baseLineWidth: number
  width: number
  height: number
}

/** One frame of a move playing out. */
export type BoardAnimation = {
  positions: Map<CellName, Point & { color: string }>
  movingMarbles: MovingMarble[]
  direction: AxialStep
}

/** The ground one group of marbles is crossing, ready to be painted. */
export type Furrow = {
  /** Names the move rather than the pixels, so it survives a repaint. */
  key: string
  centres: Point[]
  angle: number
  onDark: boolean
  pending: boolean
  /** How far the marbles have actually travelled; a whole square by default. */
  reach?: number
  /** A furrow on its way out is the same furrow, going quiet. */
  fade?: number
}

export type DrawBoardOptions = {
  view: BoardView
  state: GameState
  possibleMoves?: CellName[]
  marbleDesign?: string
  showCoordinates?: boolean
  /** Painting an earlier position, not the live game. */
  reviewing?: boolean
  animation?: BoardAnimation | null
  fading?: Furrow[]
}

const COLORS = {
  /** Keep in step with `--color-board`, which the rest of the UI draws from. */
  board: "#627384",
  /**
   * The board while you are looking at a position the game has already left
   * behind. Same lightness as the board's own colour, so the marbles read
   * exactly as well — only the hue moves, as far from it as it can get. The
   * canvas is desaturated and dimmed on top of this; the red is pitched to
   * survive that, not to be read at full strength.
   */
  reviewing: "#a14e45",
  white: "#fff",
  black: "#333",
}

const ROW_LABELS = ["a", "b", "c", "d", "e", "f", "g", "h", "i"]

/** A marble's radius, as a share of a cell's. */
const MARBLE = 0.8

/**
 * The rank and file labels are the notation a player reads a game back in, so
 * they are set in the interface's own face rather than the canvas default.
 * Keep in step with `--font-sans`.
 */
const LABEL_FACE = "'Segoe UI', Tahoma, Verdana, sans-serif"

/**
 * They want to be heavier than regular — they are small and sitting on a
 * mid-tone board — but bold is too much. The stack is system faces, and most
 * machines carry only those two weights, so the middle is not a weight that can
 * be asked for: it is reached by laying a hairline of the same ink around each
 * glyph, which thickens a stem by the width of the stroke.
 *
 * The figure is measured rather than judged. Painting `abe85` and totalling the
 * ink puts plain Arial at 1523 and the bold at 2931; this width lands on 2230,
 * within a couple of counts of halfway.
 */
const LABEL_WEIGHT = 0.035

/** Walks every square of the board, column by column. */
function forEachCell(callback: (r: number, q: number) => void): void {
  for (let q = -4; q <= 4; q++) {
    const r1 = Math.max(-4, -q - 4)
    const r2 = Math.min(4, -q + 4)
    for (let r = r1; r <= r2; r++) callback(r, q)
  }
}

function drawHexagon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fillStyle: string,
): void {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3
    const xPos = x + radius * Math.cos(angle)
    const yPos = y + radius * Math.sin(angle)
    if (i === 0) ctx.moveTo(xPos, yPos)
    else ctx.lineTo(xPos, yPos)
  }
  ctx.fillStyle = fillStyle
  ctx.fill()
  ctx.closePath()
}

/**
 * The dimple marking a square nobody is standing on, as a share of a cell's
 * radius. It is only there to say "a marble could go here"; the marbles are
 * what the eye is meant to be counting, so it stays well inside them.
 */
const FIELD = 0.36

/**
 * Its outline is drawn at half the board's line width. Most of what made an
 * empty square shout was the dark ring around it rather than its size, so
 * thinning the ring settles the grid back without shrinking the target the
 * pointer is aiming at.
 */
const FIELD_STROKE_SCALE = 0.5

function drawFieldCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  baseLineWidth: number,
): void {
  ctx.beginPath()
  ctx.arc(x, y, radius * FIELD, 0, Math.PI * 2)
  ctx.fillStyle = "#444"
  ctx.fill()
  ctx.lineWidth = baseLineWidth * FIELD_STROKE_SCALE
  ctx.strokeStyle = "#333"
  ctx.stroke()
}

function drawMoveIndicator(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fillStyle = "#ccc",
): void {
  ctx.beginPath()
  ctx.arc(x, y, radius * 0.2, 0, Math.PI * 2)
  ctx.fillStyle = fillStyle
  ctx.fill()
}

function drawCoordinateLabels(
  ctx: CanvasRenderingContext2D,
  view: BoardView,
): void {
  const { centerX, centerY, radius, spacing } = view
  const size = radius * 0.44

  ctx.save()
  ctx.font = `${size}px ${LABEL_FACE}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillStyle = "#fff"
  ctx.strokeStyle = "#fff"
  ctx.lineWidth = size * LABEL_WEIGHT
  ctx.lineJoin = "round"
  const label = (text: string, x: number, y: number) => {
    ctx.fillText(text, x, y)
    ctx.strokeText(text, x, y)
  }
  const distance = radius * 1.2

  // Row letters a–i down the left edge. Labels intentionally do not flip.
  for (let r = 4; r >= -4; r--) {
    const q = Math.max(-4, -r - 4)
    const pos = hexCenter(r, q, centerX, centerY, spacing)
    label(ROW_LABELS[4 - r], pos.x - distance, pos.y)
  }

  // Column numbers 1–9 along the bottom.
  for (let q = -4; q <= 4; q++) {
    const r = Math.min(4, -q + 4)
    const pos = hexCenter(r, q, centerX, centerY, spacing)
    label(String(q + 5), pos.x + distance / 2, pos.y + distance)
  }
  ctx.restore()
}

/**
 * Whether stepping this group on once would put any of it past the rim — which
 * only ever happens to a marble being shoved off, since that is the one move
 * that ends with a marble nowhere.
 */
function leavesTheBoard(names: CellName[], direction: AxialStep): boolean {
  const [dr, dq] = direction
  return names.some((name) => {
    const [r, q] = name.split(",").map(Number)
    return cellNamed(`${r + dr},${q + dq}`) === NOWHERE
  })
}

function findAdjacentMarble(
  destination: CellName,
  marbles: CellName[],
): CellName | undefined {
  if (marbles.length === 1) return marbles[0]
  return marbles.find(
    (marble) => directionBetween(marble, destination) !== null,
  )
}

/** Where a named square sits on the canvas. */
function centreOf(name: CellName, view: BoardView, flip: boolean): Point {
  const [r, q] = name.split(",").map(Number)
  return hexCenter(r, q, view.centerX, view.centerY, view.spacing, flip)
}

/** The heading from one square to another, as a canvas angle. */
function angleBetween(
  fromName: CellName,
  toName: CellName,
  view: BoardView,
  flip: boolean,
): number {
  const from = centreOf(fromName, view, flip)
  const to = centreOf(toName, view, flip)
  return Math.atan2(to.y - from.y, to.x - from.x)
}

/**
 * One group of marbles travelling together, worked out into the terms a furrow
 * is drawn from: where they stand, which way they are going, whose they are.
 *
 * `marbles` are always the squares being *left*, never the ones being reached.
 * The furrow steps one square on for itself.
 *
 * @param marbles   squares the group is leaving
 * @param onDark    the group is the dark side, so the furrow is cut light
 * @param target    square the move is aimed at, when there is one
 * @param direction heading, for a group with no target of its own
 * @param pending   the move has not been made — the marbles are still at the near end
 */
function furrowFor(
  view: BoardView,
  state: GameState,
  marbles: CellName[],
  onDark: boolean,
  target: CellName | null,
  direction: AxialStep | null = null,
  pending = false,
): Furrow | null {
  if (!marbles?.length) return null
  const flip = state.shouldFlipBoard

  let angle: number
  if (direction) {
    const [dr, dq] = direction
    angle = angleBetween("0,0", `${dr},${dq}`, view, flip)
  } else {
    if (!target) return null
    const anchor = findAdjacentMarble(target, marbles)
    if (!anchor) return null
    angle = angleBetween(anchor, target, view, flip)
  }

  return {
    // What the furrow is *of*, rather than where it is on screen: two repaints
    // of the same move give the same key, and a resize does not invent a new
    // one. It is how the board tells a furrow that has gone from one that has
    // merely moved, which is what the fade needs to know.
    key: `${pending ? "hover" : "move"}:${marbles.join("|")}>${
      target ?? direction
    }`,
    centres: marbles.map((name) => centreOf(name, view, flip)),
    angle,
    onDark,
    pending,
  }
}

/**
 * The furrows while a move plays out.
 *
 * They are pinned to the squares the marbles set off from, not to the marbles,
 * so the ground stays put and the marbles travel along it — which is the way
 * round that reads as movement.
 *
 * A shove sets both sides going at once, and they are still one furrow: one
 * move was played, so one trough is cut, and it runs the whole length of what
 * was shifted. Whose ink it is cut in is the mover's — the side that did the
 * pushing, which is the side at the back of the column.
 *
 * A furrow only reaches as far as the marbles have got, because they are what
 * cuts it. Laying the whole trough down at the outset would put its closed end
 * out in the open with nothing standing in it to close it, which is the one edge
 * that is never meant to be seen.
 */
function animatedFurrows(
  view: BoardView,
  state: GameState,
  animation: BoardAnimation,
): Furrow[] {
  const flip = state.shouldFlipBoard
  const [dr, dq] = animation.direction
  const angle = angleBetween("0,0", `${dr},${dq}`, view, flip)

  const marbles = animation.movingMarbles
  if (!marbles.length) return []
  const centres = marbles.map((marble) =>
    centreOf(marble.from, view, flip),
  )

  // Everything in a move travels together, so one marble gives the distance.
  const leader = marbles[0]
  const setOff = centreOf(leader.from, view, flip)
  const now = animation.positions.get(leader.from)
  const reach = now ? Math.hypot(now.x - setOff.x, now.y - setOff.y) : 0

  // Whoever is hindmost along the way they are all going is the one doing the
  // pushing; on a move with no shove that is simply the only side there is.
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  let rear = 0
  centres.forEach((centre, i) => {
    if (
      centre.x * cos + centre.y * sin <
      centres[rear].x * cos + centres[rear].y * sin
    ) {
      rear = i
    }
  })

  // A marble on its way off the board is drawn going over the rim, but the
  // trough it would cut out there is not: the furrow holds at the last square
  // while the marble carries on past it. Same rule as a move already played —
  // see `furrowsToShow`.
  const overTheRim = marbles.some(
    (marble) => cellNamed(marble.to) === NOWHERE,
  )

  return [
    {
      key: `move:${marbles
        .map((marble) => marble.from)
        .join("|")}>${dr},${dq}`,
      centres,
      angle,
      onDark: marbles[rear].color === "#333",
      pending: false,
      reach: overTheRim ? 0 : reach,
    },
  ]
}

/**
 * Works out every group the board should be cutting a furrow for, if any.
 *
 * One move, one furrow. A shove moves two sides at once but it is still a
 * single move, so the squares the shoved marbles were standing on join the
 * ones the movers left and the whole column cuts one trough — in the mover's
 * ink, because the mover is what dragged through it. Cutting the far half in
 * the other colour, as this used to, put two trails on the board for one move
 * and read as though both players had just played.
 *
 * A move being weighed up and the move it is answering are both worth seeing at
 * once, so hovering adds a furrow rather than replacing the one already there.
 * They are laid down in the order they happen — what the opponent did, then what
 * you are thinking of doing — so where the two cross, yours is the one on top.
 */
export function furrowsToShow(
  view: BoardView,
  state: GameState,
  possibleMoves: CellName[] = [],
  animation: BoardAnimation | null = null,
  isAnimating = false,
): Furrow[] {
  if (isAnimating && animation) {
    return animatedFurrows(view, state, animation)
  }

  const furrows: (Furrow | null)[] = []

  if (state.lastMove) {
    const { fromMarbles, direction, marbles, shovedMarbles } =
      state.lastMove
    // The movers have already arrived, so their colour is read where they now
    // stand. The heading is taken from the move rather than worked back out of
    // a destination: with the shoved squares in the group, the square the
    // leading marble landed on is one of the group's own.
    const moverIsDark = state.black.has(marbles[0] ?? fromMarbles[0])
    const shifted = [...fromMarbles, ...shovedMarbles]
    const furrow = furrowFor(
      view,
      state,
      shifted,
      moverIsDark,
      null,
      direction,
    )
    // A marble shoved over the rim carries the front of the trough with it, out
    // past the board and onto the table. There is no ground out there to plough,
    // so the furrow stops where the board does: `reach` of zero leaves its closed
    // end on the last square, under the last marble still standing in it.
    if (furrow && leavesTheBoard(shifted, direction)) furrow.reach = 0
    furrows.push(furrow)
  }

  if (
    !state.gameOver &&
    state.hoveredCell &&
    possibleMoves.includes(state.hoveredCell)
  ) {
    const picked = state.selectedMarbles
    // Nothing has moved yet, so the marbles are still at the near end.
    furrows.push(
      furrowFor(
        view,
        state,
        picked,
        state.black.has(picked[0]),
        state.hoveredCell,
        null,
        true,
      ),
    )
  }

  return furrows.filter((furrow) => furrow !== null)
}

/**
 * Splits a group into the lines it travels in — marbles one directly behind
 * another share a line, marbles abreast do not.
 *
 * Three marbles pushed nose to tail cut one furrow between them, not one each;
 * three moving abreast cut three. Working that out here is also what keeps a
 * broadside move's furrows identical to one another: each is its own line, so
 * each gets the whole gradient, instead of one gradient being stretched across
 * the group and leaving the hindmost marble the faintest.
 */
function linesOfTravel(
  centres: Point[],
  cos: number,
  sin: number,
  step: number,
): { across: number; from: number; to: number }[] {
  const lines: { across: number; from: number; to: number }[] = []
  for (const centre of centres) {
    const along = centre.x * cos + centre.y * sin
    const across = centre.y * cos - centre.x * sin
    // The next line over is most of a square away, so this can be generous.
    const line = lines.find(
      (known) => Math.abs(known.across - across) < step * 0.3,
    )
    if (line) {
      line.from = Math.min(line.from, along)
      line.to = Math.max(line.to, along)
    } else {
      lines.push({ across, from: along, to: along })
    }
  }
  return lines
}

/**
 * The ground a move crosses, cut as a furrow.
 *
 * A ball dragged through sand closes off the end of the trough it is sitting in
 * and leaves the far end open and domed. So the two ends are never the same, and
 * which is which follows the ball: a move already made is domed at the square it
 * set off from and cut flat under the marble that arrived; a move only being
 * previewed is the other way round — cut flat under the marble still standing
 * there, domed on the ground it is about to plough into.
 *
 * The dome is a half circle of the ball's own radius, on the ball's own centre,
 * so it is that ball's silhouette exactly. The flat end stops at a centre too,
 * which puts its corners on the marble's widest points: they meet the silhouette
 * and nothing of them shows past it.
 *
 * `reach` is how far the marbles have actually travelled, for a move still in
 * flight; the flat end rides along with them and the furrow is cut behind. It
 * defaults to a whole square, which is where they end up.
 */
function paintFurrow(
  ctx: CanvasRenderingContext2D,
  { centres, angle, onDark, pending, reach, fade = 1 }: Furrow,
  radius: number,
  spacing: number,
): void {
  if (fade <= 0) return
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const step = spacing * STEP
  const travelled = reach ?? step
  const half = radius * MARBLE
  // Perpendicular to the direction of travel, for the corners of the flat end.
  const acrossX = -sin
  const acrossY = cos
  // Which end is domed and which is cut, as a direction to build the path in.
  const sweep = pending ? -1 : 1
  const ink = onDark ? "255, 255, 255" : "30, 34, 40"
  /**
   * The two sides are not the same strength at the same alpha. Against a board
   * this mid-toned, lightening carries about twice the perceived weight of
   * darkening, so they are pitched by the shift they land rather than by the
   * figure: measured at the deep end of the gradient, white at 0.14 moves the
   * board +6.8 L* and the dark furrow at 0.192 moves it -5.6. Anywhere near the
   * same number the white one shouts — at 0.28 it was +13.5.
   *
   * The two are deliberately not level any more. They were, at 0.24 for the
   * dark; it was asked to come down a fifth from there, which is what 0.192 is,
   * and that leaves the white about a fifth the heavier of the two.
   *
   * `fade` is the only thing allowed to scale them: a furrow on its way out is
   * the same furrow, going quiet.
   */
  const deepest = (onDark ? 0.14 : 0.192) * fade

  ctx.save()
  for (const { across, from, to } of linesOfTravel(
    centres,
    cos,
    sin,
    step,
  )) {
    // Back into canvas coordinates from (along the move, across it).
    const at = (along: number) => ({
      x: along * cos - across * sin,
      y: along * sin + across * cos,
    })
    const near = from // centre of the square the group set off from
    const far = to + step // centre of the square the leading marble comes to rest on
    const dome = at(pending ? far : near)
    // The closed end is wherever the leading marble is standing right now.
    const cut = at(pending ? near : to + travelled)

    ctx.beginPath()
    ctx.arc(
      dome.x,
      dome.y,
      half,
      angle + (sweep * Math.PI) / 2,
      angle - (sweep * Math.PI) / 2,
    )
    ctx.lineTo(
      cut.x - sweep * half * acrossX,
      cut.y - sweep * half * acrossY,
    )
    ctx.lineTo(
      cut.x + sweep * half * acrossX,
      cut.y + sweep * half * acrossY,
    )
    ctx.closePath()

    // The gradient covers exactly the stretch that shows — from where the furrow
    // clears one marble to where it goes under the other — so it arrives at full
    // strength precisely as the ball takes over.
    const tail = at(pending ? near + half : near - half)
    const head = at(pending ? far + half : far - half)
    const wash = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y)
    wash.addColorStop(0, `rgba(${ink}, 0)`)
    wash.addColorStop(1, `rgba(${ink}, ${deepest})`)
    ctx.fillStyle = wash
    ctx.fill()
  }
  ctx.restore()
}

/** Repaints the whole board. */
export function drawBoard(
  ctx: CanvasRenderingContext2D,
  {
    view,
    state,
    possibleMoves = [],
    marbleDesign = "default",
    showCoordinates = false,
    reviewing = false,
    animation = null,
    fading = [],
  }: DrawBoardOptions,
): void {
  const {
    centerX,
    centerY,
    radius,
    spacing,
    baseLineWidth,
    width,
    height,
  } = view
  const flip = state.shouldFlipBoard
  const isAnimating = Boolean(animation)

  ctx.clearRect(0, 0, width, height)

  // Board hexagon.
  //
  // Inset by two line widths. The hexagon's left and right vertices are its
  // widest points and `radius * 10` puts them exactly on the canvas edge, so
  // half the outline — which is stroked centred on the path — was falling off
  // it and the two points came out shaved flat. The top and bottom sit on the
  // flats rather than a vertex and had the clearance already.
  //
  // One line width would be enough on paper; two leaves the margin standing
  // after the canvas size is floored and the device pixel ratio rounds it,
  // which is where the last of it went.
  ctx.strokeStyle = "#333"
  ctx.lineWidth = baseLineWidth
  drawHexagon(
    ctx,
    centerX,
    centerY,
    radius * 10 - baseLineWidth * 2,
    reviewing ? COLORS.reviewing : COLORS.board,
  )
  ctx.stroke()

  drawCoordinateLabels(ctx, view)

  // Pass 1: the fixed grid of empty cells.
  forEachCell((r, q) => {
    const pos = hexCenter(r, q, centerX, centerY, spacing, flip)
    drawFieldCircle(ctx, pos.x, pos.y, radius, baseLineWidth)
  })

  // The furrows a move cuts, laid down before any marble is: it is ground being
  // crossed, so the marbles ride over it rather than wearing it.
  // Precedence: mid-animation, then hover preview, then the last completed move.
  // Furrows on their way out go down first, so a live one always crosses over
  // the ghost of the one it replaced rather than under it.
  for (const furrow of fading) {
    paintFurrow(ctx, furrow, radius, spacing)
  }
  for (const furrow of furrowsToShow(
    view,
    state,
    possibleMoves,
    animation,
    isAnimating,
  )) {
    paintFurrow(ctx, furrow, radius, spacing)
  }

  // A hovered marble is ringed in the same blue as a selected one, only
  // thinner — which reads as "this one is next" and is true right up until the
  // line is full. Three is the most that can ever move, so a fourth ring there
  // says a fourth marble is joining when nothing can. Past the limit the board
  // stops offering.
  //
  // And it is only ever offered on a marble a press would actually pick up,
  // which `isValidSelection` is the one answer to: your own colour in a game
  // against someone else, the colour to move in a game shared with them. The
  // ring is a promise, and the opponent's marbles are not yours to move.
  const selectionFull = state.selectedMarbles.length >= MAX_LINE
  const hoverable =
    !selectionFull &&
    state.hoveredCell &&
    isValidSelection(state, state.hoveredCell)
      ? state.hoveredCell
      : null

  // Pass 2: marbles (animated positions take priority) and move indicators.
  //
  // A lit design drops its shadow on the square immediately before it is drawn
  // there, rather than in a pass of its own. It reaches nowhere near the next
  // square along — see `renderMarbleShadow` — so nothing is ever laid over a
  // marble that has already gone down, and the order the squares are walked in
  // does not matter.
  forEachCell((r, q) => {
    const pos = hexCenter(r, q, centerX, centerY, spacing, flip)
    const coordKey = `${r},${q}`
    const isSelected = state.selectedMarbles.includes(coordKey)
    const isHovered = hoverable === coordKey

    const animated = animation ? animation.positions.get(coordKey) : null
    if (animated) {
      renderMarbleShadow(
        marbleDesign,
        ctx,
        animated.x,
        animated.y,
        radius * MARBLE,
      )
      renderMarble(
        marbleDesign,
        ctx,
        animated.x,
        animated.y,
        radius * MARBLE,
        animated.color,
        isSelected,
        isHovered,
        baseLineWidth,
      )
    } else if (state.black.has(coordKey)) {
      renderMarbleShadow(marbleDesign, ctx, pos.x, pos.y, radius * MARBLE)
      renderMarble(
        marbleDesign,
        ctx,
        pos.x,
        pos.y,
        radius * MARBLE,
        COLORS.black,
        isSelected,
        isHovered,
        baseLineWidth,
      )
    } else if (state.white.has(coordKey)) {
      renderMarbleShadow(marbleDesign, ctx, pos.x, pos.y, radius * MARBLE)
      renderMarble(
        marbleDesign,
        ctx,
        pos.x,
        pos.y,
        radius * MARBLE,
        COLORS.white,
        isSelected,
        isHovered,
        baseLineWidth,
      )
    }

    if (
      !state.gameOver &&
      !isAnimating &&
      possibleMoves.includes(coordKey)
    ) {
      drawMoveIndicator(ctx, pos.x, pos.y, radius)
    }
  })

  // Pass 3: coordinate overlay on top of the marbles.
  if (showCoordinates) {
    forEachCell((r, q) => {
      const pos = hexCenter(r, q, centerX, centerY, spacing, flip)
      const coordKey = `${r},${q}`
      const marbleColor = state.black.has(coordKey)
        ? COLORS.black
        : state.white.has(coordKey)
          ? COLORS.white
          : null

      const coords = cellFromPoint(pos.x, pos.y, centerX, centerY, spacing)
      if (!coords) return

      ctx.save()
      ctx.font = `${radius * 0.25}px Arial`
      ctx.fillStyle = marbleColor === COLORS.black ? "#fff" : "#000"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(`${coords[0]},${coords[1]}`, pos.x, pos.y)
      ctx.restore()
    })
  }
}
