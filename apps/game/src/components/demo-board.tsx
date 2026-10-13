import { DEMO_GAME } from "@repo/abalone-engine/demo-game"
import type { GameState } from "@repo/abalone-engine/game-state"
import { createGameState, makeMove } from "@repo/abalone-engine/game-state"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { GameCanvasHandle } from "@/components/game-canvas"
import { GameCanvas } from "@/components/game-canvas"
import { useIsDesktop } from "@/hooks/use-is-desktop"
import type { MarbleDesign } from "@/render/marble-renderer"

/** Between the marbles landing and the next line setting off. */
const MOVE_GAP_MS = 900

/** After the last move, before the board goes back to the opening position. */
const REPLAY_GAP_MS = 2600

/** The marbles this board is shown with, whatever the player has set. */
const SHOWCASE_DESIGN: MarbleDesign = "3d"

type BoardSize = { width: number; height: number }

const newDemoState = () => createGameState("standard", "black", "local")

/**
 * The board, playing itself.
 *
 * The real canvas and the real engine — this is the game running, with the moves
 * read off a list instead of out of a search. Nothing about it responds to a
 * press: it is the picture on the front of the box, and every way in is a
 * button somewhere else on the page.
 *
 * It runs only while it is on screen. An animation loop in a scrolled-past
 * element is a phone's battery spent on nothing, and `requestAnimationFrame`
 * stalls in a hidden pane anyway — which would leave a move frozen half-played
 * and the rest of the game queued behind it.
 */
export function DemoBoard() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<GameCanvasHandle>(null)
  const [state, setState] = useState<GameState>(newDemoState)
  const [isOnScreen, setIsOnScreen] = useState(false)
  const [boardSize, setBoardSize] = useState<BoardSize | null>(null)

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const observer = new IntersectionObserver(
      ([entry]) => setIsOnScreen(entry.isIntersecting),
      { threshold: 0.2 },
    )
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [])

  //the loop reads `state` once, to resume from where it stopped — listing it as
  //a dependency would tear the game down and rebuild it on every move
  // biome-ignore lint/correctness/useExhaustiveDependencies: explained above.
  useEffect(() => {
    if (!isOnScreen) return

    let cancelled = false
    const timers = new Set<ReturnType<typeof setTimeout>>()
    //cleared on teardown, so unmounting mid-pause doesn't leave a timer holding
    //the loop open for the rest of it
    const pause = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.add(setTimeout(resolve, ms))
      })

    async function play() {
      //picked up wherever the last teardown left off, so scrolling the board out
      //of view and back does not restart the game
      let current = state
      let index = current.moveHistory.length - 1

      while (!cancelled) {
        if (index >= DEMO_GAME.length) {
          await pause(REPLAY_GAP_MS)
          if (cancelled) return
          current = newDemoState()
          index = 0
          setState(current)
          continue
        }

        const { marbles, to } = DEMO_GAME[index]
        const { state: next, result } = makeMove(current, marbles, to)
        //a move the engine rejects can only mean the list and the rules have
        //drifted apart; start the game over rather than sit on a dead board
        if (!result) {
          current = newDemoState()
          index = 0
          setState(current)
          continue
        }

        setState({ ...current, selectedMarbles: marbles, lastMove: null })
        await boardRef.current?.animateMove({
          movingMarbles: result.movingMarbles,
          direction: result.direction,
        })
        if (cancelled) return

        current = next
        index += 1
        setState(current)
        await pause(MOVE_GAP_MS)
      }
    }

    void play()

    return () => {
      cancelled = true
      for (const timer of timers) clearTimeout(timer)
    }
  }, [isOnScreen])

  return (
    //a plain flex column, not a `game-canvas-wrapper`: the canvas renders one of
    //those itself and measures it, and a second one around it would be a box
    //sizing to the canvas that is sizing to the box
    <div
      ref={wrapperRef}
      className="relative isolate flex min-h-0 flex-1 flex-col"
    >
      <GameCanvas
        ref={boardRef}
        state={state}
        possibleMoves={[]}
        marbleDesign={SHOWCASE_DESIGN}
        showCoordinates={false}
        showLabels={false}
        interactive={false}
        onResize={(width, height) => setBoardSize({ width, height })}
      />
      {boardSize && <BoardShadow size={boardSize} />}
    </div>
  )
}

/** The board's shadow at each size: how far it falls, and how soft it is. */
const PHONE_SHADOW = { offsetY: 26, blur: 46 }
const DESKTOP_SHADOW = { offsetY: 34, blur: 60 }

/** The black the shadow is painted in. */
const SHADOW_COLOR = "rgba(0, 0, 0, 0.55)"

/**
 * The board's shadow, painted once on a canvas of its own under the board.
 *
 * A `drop-shadow` on a box around the board reads the same, but it is a filter
 * over a canvas that redraws every frame of a move, so WebKit blurs the whole
 * board again on each of them and a frame takes several times as long
 * (TUD-958). A `blur()` on a sibling under it is no better in Chromium, which
 * applies the filter again wherever the canvas above it changed. A shadow drawn
 * onto a canvas is pixels, and these never change while a move plays.
 *
 * The hexagon is the one `drawBoard` fills, and canvas `shadowBlur` is the same
 * blur radius `drop-shadow` takes. The canvas reaches past the board on every
 * side by the blur and the fall, so the soft edge is never cut off. It comes
 * after the board, so the board stays the first canvas on the page, and sits
 * under it by `z-index`.
 */
function BoardShadow({ size }: { size: BoardSize }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { offsetY, blur } = useIsDesktop() ? DESKTOP_SHADOW : PHONE_SHADOW
  const margin = blur + offsetY
  const width = size.width + margin * 2
  const height = size.height + margin * 2

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr

    //the hexagon is drawn a canvas-width off to the left and its shadow thrown
    //back by as much, so only the shadow lands on the canvas. Shadow offsets
    //are in device pixels and ignore the transform, hence the `dpr`.
    const throwBack = width
    ctx.scale(dpr, dpr)
    ctx.shadowColor = SHADOW_COLOR
    ctx.shadowBlur = blur * dpr
    ctx.shadowOffsetX = throwBack * dpr
    ctx.shadowOffsetY = offsetY * dpr
    const radius = size.width / 2
    const centerX = width / 2 - throwBack
    const centerY = height / 2
    ctx.beginPath()
    for (let corner = 0; corner < 6; corner++) {
      const angle = (corner * Math.PI) / 3
      ctx.lineTo(
        centerX + radius * Math.cos(angle),
        centerY + radius * Math.sin(angle),
      )
    }
    ctx.closePath()
    ctx.fill()
  }, [width, height, size.width, blur, offsetY])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute top-1/2 -z-10 left-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ width, height }}
    />
  )
}
