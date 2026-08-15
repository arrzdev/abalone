import { MAX_LINE } from "@repo/abalone-engine/config"
import type { GameState } from "@repo/abalone-engine/game-state"
import type { MovingMarble } from "@repo/abalone-engine/rules"
import type {
  AxialStep,
  CellName,
  Point,
} from "@repo/abalone-engine/types"
import { cn } from "@repo/nativ/utils"
import type { MouseEvent, PointerEvent } from "react"
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react"
import { TapButton } from "@/components/ui/tap-button"
import { markTapHandled, TAP_SLOP } from "@/hooks/use-click-fix"
import type {
  BoardAnimation,
  BoardView,
  Furrow,
} from "@/render/draw-board"
import { drawBoard, furrowsToShow } from "@/render/draw-board"
import { cellFromPoint, hexCenter } from "@/render/hex-grid"
import {
  arrivedByPlaying,
  easeInOutCubic,
  interpolate,
  TIMING,
} from "@/render/motion"

const BASE_WIDTH = 800
const BASE_HEIGHT = 700
const BASE_RADIUS = 40

/** What a move hands the board to play out. */
export type MoveAnimation = {
  movingMarbles: MovingMarble[]
  direction: AxialStep
}

/** What the game above the board can ask of it. */
export type GameCanvasHandle = {
  animateMove: (moveData: MoveAnimation) => Promise<void>
  redraw: () => void
}

export type GameCanvasProps = {
  state: GameState
  possibleMoves: CellName[]
  marbleDesign?: string
  showCoordinates?: boolean
  /** The rank and file down the edges. Off for a board nobody plays on. */
  showLabels?: boolean
  notice?: string | null
  noticeAction?: string | null
  onReturnToLatest?: () => void
  interactive?: boolean
  onCellClick?: (pos: CellName) => void
  onDragSelect?: (anchor: CellName, pos: CellName) => number
  onHover?: (pos: CellName | null) => void
  onResize?: (width: number, height: number) => void
}

/** A furrow on its way out, with the moment it started going. */
type Ghost = Furrow & { since: number }

/**
 * The hex board.
 *
 * Owns everything about the board that is not the game: how big the canvas is,
 * how sharp it is on this display, and the requestAnimationFrame loop a move
 * runs on. The game above it hands down a state and gets back a painted board.
 *
 * Exposes `animateMove(moveData)` — which resolves once the marbles have
 * landed, so a caller can await it before committing the move — and `redraw()`.
 *
 * `notice` says the board is showing something other than the live game, and
 * what. It changes the board's own colour and floats its text above the top
 * row — both free, in layout terms, which is the point: this used to be a
 * banner in the side panel that appeared and vanished every time you stepped
 * through the history, resizing the move list under it each way.
 */
export const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(
  function GameCanvas(
    {
      state,
      possibleMoves,
      marbleDesign,
      showCoordinates,
      showLabels,
      notice = null,
      noticeAction = null,
      onReturnToLatest,
      interactive = true,
      onCellClick,
      onDragSelect,
      onHover,
      onResize,
    },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const rafRef = useRef<number | null>(null)
    const animationRef = useRef<BoardAnimation | null>(null)

    // Held in a ref so that `resize` keeps its identity: it is the ResizeObserver
    // callback, and re-creating it would tear the observer down on every render.
    const onResizeRef = useRef(onResize)
    onResizeRef.current = onResize

    const viewRef = useRef<BoardView>({
      width: BASE_WIDTH,
      height: BASE_HEIGHT,
      centerX: BASE_WIDTH / 2,
      centerY: BASE_HEIGHT / 2,
      radius: BASE_RADIUS,
      spacing: BASE_RADIUS * 1.14,
      baseLineWidth: 2,
    })

    // Latest props for the rAF loop, which runs outside React's render cycle.
    const latest = {
      state,
      possibleMoves,
      marbleDesign,
      showCoordinates,
      showLabels,
      reviewing: Boolean(notice),
    }
    const propsRef = useRef(latest)
    propsRef.current = latest

    /* ---------------------------------------------------------------- *
     * Furrows on their way out
     *
     * The trail of the move just played used to be there in one frame and gone in
     * the next, which reads as a light being switched off rather than as ground
     * settling. So the board keeps it and paints it a little fainter each frame
     * until it is gone, while the trail of the move replacing it is cut over the
     * top.
     *
     * One transition only: a move being played in a live game, where the trail it
     * cuts replaces the opponent's. Everything else cuts.
     *
     * A preview follows the pointer and is answering "where would this go?" — it
     * has to be gone the instant the answer changes, and sweeping across the
     * board would otherwise leave a fading copy on every square passed over.
     * Stepping through the history is the same demand made of the past: you are
     * looking for the position as it stood, and it should be on the board the
     * moment you ask, with the trail that belongs to it and no remains of the one
     * that does not. Undo, a rewind, a new game — all of them cut.
     *
     * What tells them apart is the move list. Playing appends to it; walking
     * through it does not. So the fade is allowed only where the history has just
     * grown a move and the board has stepped onto it.
     *
     * Held out here rather than inside `drawBoard`, which is a pure function of
     * what it is given and has no business remembering the frame before. The key
     * on each furrow names the move rather than the pixels, so a repaint or a
     * resize is not mistaken for a departure.
     * ---------------------------------------------------------------- */
    const shownRef = useRef<Furrow[]>([])
    const fadingRef = useRef<Ghost[]>([])
    const fadeRafRef = useRef<number | null>(null)
    const wasAtRef = useRef<{ index: number | null; moves: number }>({
      index: null,
      moves: 0,
    })
    const mayFadeRef = useRef(false)

    /**
     * Whether the board arrived at this position by a move being played, rather
     * than by being sent there. Latched, because it is decided on the frame the
     * position changes and has to hold for the frames the fade takes to run.
     */
    const noteArrival = useCallback((state: GameState) => {
      const at = {
        index: state.currentMoveIndex,
        moves: state.moveHistory.length,
      }
      const was = wasAtRef.current
      if (at.index === was.index && at.moves === was.moves) return

      mayFadeRef.current = arrivedByPlaying(was, at)
      // A rewind mid-fade should land on a clean board, not catch the tail of it.
      if (!mayFadeRef.current) fadingRef.current = []
      wasAtRef.current = at
    }, [])

    /** Ghosts to paint this frame, after retiring the ones that have finished. */
    const collectFading = useCallback(
      (live: Furrow[], now: number): Furrow[] => {
        const alive = new Set(live.map((furrow) => furrow.key))

        // Anything that was on the board last frame and is not on it now starts to
        // go — except a preview, which simply goes.
        for (const gone of shownRef.current) {
          if (alive.has(gone.key) || gone.pending) continue
          if (!mayFadeRef.current) continue
          if (fadingRef.current.some((ghost) => ghost.key === gone.key)) {
            continue
          }
          // There is only ever one played move on the board, so an older ghost is
          // one the board has already moved past.
          fadingRef.current = []
          fadingRef.current.push({ ...gone, since: now })
        }
        // A furrow that came back is the live one again; it must not double up.
        fadingRef.current = fadingRef.current.filter(
          (ghost) => !alive.has(ghost.key),
        )
        shownRef.current = live

        const ghosts: Furrow[] = []
        for (const ghost of fadingRef.current) {
          const fade = 1 - (now - ghost.since) / TIMING.FURROW_FADE
          if (fade > 0) ghosts.push({ ...ghost, fade })
        }
        fadingRef.current = fadingRef.current.filter(
          (ghost) => now - ghost.since < TIMING.FURROW_FADE,
        )
        return ghosts
      },
      [],
    )

    const draw = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const {
        state: s,
        possibleMoves: moves,
        marbleDesign: design,
        showCoordinates: coords,
        showLabels: labels,
        reviewing,
      } = propsRef.current
      const view = viewRef.current
      const animation = animationRef.current
      const now = performance.now()
      noteArrival(s)
      const fading = collectFading(
        furrowsToShow(view, s, moves, animation, Boolean(animation)),
        now,
      )

      drawBoard(ctx, {
        view,
        state: s,
        possibleMoves: moves,
        marbleDesign: design,
        showCoordinates: coords,
        showLabels: labels,
        reviewing,
        animation,
        fading,
      })

      // Nothing else is repainting on its own account, so a fade has to drive its
      // own frames. A move already runs a loop of its own and paints every frame,
      // so it carries the fade along with it and a second loop would only double
      // the work.
      if (
        fadingRef.current.length &&
        rafRef.current === null &&
        fadeRafRef.current === null
      ) {
        fadeRafRef.current = requestAnimationFrame(() => {
          fadeRafRef.current = null
          draw()
        })
      }
    }, [collectFading, noteArrival])

    /** Recomputes canvas size, DPI scaling and hex geometry from the wrapper box. */
    const resize = useCallback(() => {
      const canvas = canvasRef.current
      const wrapper = wrapperRef.current
      if (!canvas || !wrapper) return

      const availableWidth = wrapper.clientWidth
      const availableHeight = wrapper.clientHeight
      if (availableWidth <= 0 || availableHeight <= 0) return

      const scaleFactor = Math.min(
        availableWidth / BASE_WIDTH,
        availableHeight / BASE_HEIGHT,
      )
      const cssWidth = Math.max(1, Math.floor(BASE_WIDTH * scaleFactor))
      const cssHeight = Math.max(1, Math.floor(BASE_HEIGHT * scaleFactor))
      const dpr = window.devicePixelRatio || 1

      canvas.width = cssWidth * dpr
      canvas.height = cssHeight * dpr
      canvas.style.width = `${cssWidth}px`
      canvas.style.height = `${cssHeight}px`

      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      // Setting width/height resets the transform, so re-apply the DPI scale.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const radius = BASE_RADIUS * scaleFactor
      viewRef.current = {
        width: cssWidth,
        height: cssHeight,
        centerX: cssWidth / 2,
        centerY: cssHeight / 2,
        radius,
        spacing: radius * 1.14,
        baseLineWidth: Math.max(1, scaleFactor * 2),
      }

      // The board is letterboxed into the box it was given, so its own size is
      // not something the layout around it can work out — anything that has to
      // line up with the board hears it from here.
      onResizeRef.current?.(cssWidth, cssHeight)

      draw()
    }, [draw])

    useLayoutEffect(() => {
      resize()
      const wrapper = wrapperRef.current
      if (!wrapper || typeof ResizeObserver === "undefined") {
        window.addEventListener("resize", resize)
        return () => window.removeEventListener("resize", resize)
      }
      const observer = new ResizeObserver(resize)
      observer.observe(wrapper)
      return () => observer.disconnect()
    }, [resize])

    // Repaint whenever anything visible changes. A finished animation is holding
    // its last frame; this is the render that replaces it, so let it go. One that
    // is still running keeps its frame — a hover during a move must not knock the
    // marbles back to where they started.
    // biome-ignore lint/correctness/useExhaustiveDependencies: the props are triggers; `draw` reads them off `propsRef` rather than closing over them.
    useEffect(() => {
      if (rafRef.current === null) animationRef.current = null
      draw()
    }, [draw, state, possibleMoves, marbleDesign, showCoordinates, notice])

    useEffect(
      () => () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        if (fadeRafRef.current) cancelAnimationFrame(fadeRafRef.current)
      },
      [],
    )

    const animateMove = useCallback(
      (moveData: MoveAnimation) =>
        new Promise<void>((resolve) => {
          const view = viewRef.current
          const flip = propsRef.current.state.shouldFlipBoard

          const entries = moveData.movingMarbles.map((marble) => {
            const [fromR, fromQ] = marble.from.split(",").map(Number)
            const [toR, toQ] = marble.to.split(",").map(Number)
            return {
              key: marble.from,
              color: marble.color,
              from: hexCenter(
                fromR,
                fromQ,
                view.centerX,
                view.centerY,
                view.spacing,
                flip,
              ),
              to: hexCenter(
                toR,
                toQ,
                view.centerX,
                view.centerY,
                view.spacing,
                flip,
              ),
            }
          })

          const start = performance.now()

          const step = (now: number) => {
            const rawProgress = Math.min((now - start) / TIMING.MOVE, 1)
            const eased = easeInOutCubic(rawProgress)

            const positions = new Map<
              CellName,
              Point & { color: string }
            >()
            for (const entry of entries) {
              const point = interpolate(entry.from, entry.to, eased)
              positions.set(entry.key, {
                x: point.x,
                y: point.y,
                color: entry.color,
              })
            }
            animationRef.current = {
              positions,
              movingMarbles: moveData.movingMarbles,
              direction: moveData.direction,
            }
            draw()

            if (rawProgress < 1) {
              rafRef.current = requestAnimationFrame(step)
            } else {
              rafRef.current = null
              // Hold the final frame rather than clearing and repainting here:
              // React has not committed the post-move state yet, so that repaint
              // would put the marbles back where they started for the frames in
              // between — the flicker you see at the end of every move.
              resolve()
            }
          }

          rafRef.current = requestAnimationFrame(step)
        }),
      [draw],
    )

    useImperativeHandle(ref, () => ({ animateMove, redraw: draw }), [
      animateMove,
      draw,
    ])

    const cellFromEvent = useCallback(
      (event: { clientX: number; clientY: number }) => {
        const canvas = canvasRef.current
        if (!canvas) return null
        const rect = canvas.getBoundingClientRect()
        const view = viewRef.current
        return cellFromPoint(
          event.clientX - rect.left,
          event.clientY - rect.top,
          view.centerX,
          view.centerY,
          view.spacing,
          propsRef.current.state.shouldFlipBoard,
        )
      },
      [],
    )

    const handleMouseMove = useCallback(
      (event: MouseEvent<HTMLCanvasElement>) => {
        if (!interactive) return
        const coords = cellFromEvent(event)
        onHover?.(coords ? coords.join(",") : null)
      },
      [cellFromEvent, interactive, onHover],
    )

    /* ---------------------------------------------------------------- *
     * Picking marbles up
     *
     * Two gestures on one set of pointer handlers. Tap a marble to take it, or
     * press one and drag along its line to pick the whole run up in a single
     * gesture — a drag only starts counting once the pointer reaches a second
     * cell, so a tap is still a tap and the run is an addition rather than a
     * replacement.
     *
     * The drag was mouse-only to begin with, on the grounds that a finger has no
     * hover state to show it what it is about to pick up. It is the phone that
     * wants it most, though: tapping marble by marble is three taps where the
     * gesture is one, and the board is the one surface on the screen that cannot
     * be scrolled, so there is no other reading of a drag across it.
     *
     * Nothing here uses `click`. On iOS a click can arrive against whichever
     * element was tapped *before* this one (see `useClickFix`), which on a board
     * being tapped three times in a row means marbles lighting up and going out
     * on their own. `pointerup` is not retargeted like that, so the tap is taken
     * from the release, and the release is checked against where the press landed
     * so that a drag across the board never doubles as a tap on the cell it
     * finished over.
     * ---------------------------------------------------------------- */
    const dragRef = useRef<{
      anchor: CellName
      x: number
      y: number
      applied: boolean
      full: boolean
    } | null>(null)

    const handlePointerDown = useCallback(
      (event: PointerEvent<HTMLCanvasElement>) => {
        if (!interactive || event.button !== 0 || !event.isPrimary) return

        const coords = cellFromEvent(event)
        if (!coords) return
        dragRef.current = {
          anchor: coords.join(","),
          x: event.clientX,
          y: event.clientY,
          applied: false,
          full: false,
        }
        // Captured so the run keeps following a cursor that has left the canvas,
        // and so the release always arrives here to be paired with the press —
        // without it, letting go somewhere else leaves the drag armed and the next
        // pass over the board rewrites the selection with no button held.
        //
        // An enhancement, though, not the mechanism: capture throws if the pointer
        // is already gone by the time this runs, and that must not be what stops
        // the gesture from working.
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          /* no capture — the drag still works while the cursor is over the board */
        }
      },
      [cellFromEvent, interactive],
    )

    const handlePointerMove = useCallback(
      (event: PointerEvent<HTMLCanvasElement>) => {
        const drag = dragRef.current
        if (!drag) return
        // Three is the most that can ever move as one line, so once the run is
        // that long the drag stops responding entirely — carrying on over the
        // board changes nothing, which is the board saying there is nothing left
        // to pick up and you can let go.
        if (drag.full) return

        const coords = cellFromEvent(event)
        if (!coords) return

        const pos = coords.join(",")
        if (pos === drag.anchor) return

        const picked = onDragSelect?.(drag.anchor, pos) ?? 0
        if (picked > 0) drag.applied = true
        if (picked >= MAX_LINE) drag.full = true
      },
      [cellFromEvent, onDragSelect],
    )

    const handlePointerUp = useCallback(
      (event: PointerEvent<HTMLCanvasElement>) => {
        const drag = dragRef.current
        if (!drag) return
        dragRef.current = null
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }

        // The run is already in hand. Reading the release as a tap as well would
        // put the marble it finished over straight back down.
        if (drag.applied) {
          markTapHandled()
          return
        }
        // Moved too far to have been a tap, but picked nothing up on the way —
        // dragged out from an empty cell, or off the board. That is a gesture that
        // did nothing, not a tap on wherever the finger happened to stop.
        if (Math.abs(event.clientX - drag.x) > TAP_SLOP) return
        if (Math.abs(event.clientY - drag.y) > TAP_SLOP) return

        const coords = cellFromEvent(event)
        if (!coords) return
        markTapHandled()
        onCellClick?.(coords.join(","))
      },
      [cellFromEvent, onCellClick],
    )

    /** The browser has taken the gesture over, so there is no tap to read out of it. */
    const handlePointerCancel = useCallback(() => {
      dragRef.current = null
    }, [])

    const hoveredPos = state.hoveredCell
    const cursor =
      interactive &&
      hoveredPos &&
      (state.black.has(hoveredPos) ||
        state.white.has(hoveredPos) ||
        possibleMoves.includes(hoveredPos))
        ? "pointer"
        : "default"

    return (
      <div className="game-canvas-wrapper" ref={wrapperRef}>
        {/* This box hugs the canvas, so the notice is placed against the board
            rather than against the letterboxed space the board is centred in. */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            // Greyed and dimmed while reviewing, on top of the board's own change
            // of colour. The board is not accepting moves in this state, and a
            // washed-out board is what every other control on the screen does to
            // say so.
            //
            // Deliberately not transitioned. The repaint underneath it is a
            // single canvas frame, so easing the filter in over it shows the red
            // at full strength first and greys it a moment later — two changes
            // where there is only one.
            className={cn(notice && "brightness-[0.88] grayscale-[0.3]")}
            style={{
              cursor,
              pointerEvents: interactive ? "auto" : "none",
              // A drag across the board is a selection, so the browser must not be
              // able to claim it as a pan or a zoom halfway through — that arrives
              // as a pointercancel, and the run being picked up is dropped with
              // it. Nothing is lost by saying so: the shell is exactly one screen
              // tall and the board sits in the one column of it that never
              // scrolls. Left alone when the board is only being looked at, where
              // it would be the pregame preview swallowing the panel's scroll.
              touchAction: interactive ? "none" : undefined,
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => interactive && onHover?.(null)}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          />

          {/* The strip between the board's top edge and the first row of marbles
              is the one part of it with nothing drawn on, and this sits centred in
              that strip rather than against the rim above it.

              Both figures are the geometry in `drawBoard`, as fractions of the
              canvas — which is 8:7 at every size, so they hold at every size. The
              rim is the hexagon's top flat, at `centreY − 0.866 · (10r − 2w)`; the
              floor is the top of the marbles on row −4, at `centreY − 6s − 0.8r`.
              With r = h/17.5, s = 1.14r and w = 2r/40 those come out at 1.01% and
              6.34% of the height, and the strip between them is 5.33% tall. */}
          {notice && (
            <div className="absolute inset-x-0 top-[1.01%] flex h-[5.33%] items-center justify-center">
              {/* Bare text, because the board has already said the loud part: it
                  has gone grey and dim to tell you this is not the present. All
                  this has to add is which position you are on, and that one press
                  brings you back — quiet enough to read past, not over.

                  A button over a board that takes no input while reviewing, so
                  there is nothing underneath for it to steal. */}
              <TapButton
                onClick={onReturnToLatest}
                title={noticeAction ?? undefined}
                aria-label={`${notice} — ${noticeAction}`}
                // Set from the board rather than from the viewport, because the
                // space it is centred in is a share of the board: a size that
                // suits a phone is lost on a desktop board twice the height, which
                // is exactly what a fixed size looked like. The floor is also what
                // makes this safe before the board has been measured, when
                // `--board-h` is still a percentage.
                style={{
                  fontSize:
                    "clamp(0.625rem, calc(var(--board-h) * 0.028), 1.125rem)",
                }}
                className={cn(
                  "pointer-events-auto px-2 text-xs leading-tight font-medium tracking-wide",
                  "text-muted transition-colors hover:text-foreground hover:underline",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm",
                )}
              >
                {notice}
              </TapButton>
            </div>
          )}
        </div>
      </div>
    )
  },
)
