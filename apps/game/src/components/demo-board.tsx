import { useEffect, useRef, useState } from "react"
import type { GameCanvasHandle } from "@/components/game-canvas"
import { GameCanvas } from "@/components/game-canvas"
import { DEMO_GAME } from "@/engine/demo-game"
import type { GameState } from "@/engine/game-state"
import { createGameState, makeMove } from "@/engine/game-state"
import { useMarbleDesign } from "@/hooks/use-marble-design"

/** Between the marbles landing and the next line setting off. */
const MOVE_GAP_MS = 900

/** After the last move, before the board goes back to the opening position. */
const REPLAY_GAP_MS = 2600

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
  const [marbleDesign] = useMarbleDesign()
  const [state, setState] = useState<GameState>(newDemoState)
  const [isOnScreen, setIsOnScreen] = useState(false)

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
    <div ref={wrapperRef} className="flex min-h-0 flex-1 flex-col">
      <GameCanvas
        ref={boardRef}
        state={state}
        possibleMoves={[]}
        marbleDesign={marbleDesign}
        interactive={false}
      />
    </div>
  )
}
