import type { GameState } from "@repo/abalone-engine/game-state"
import type { CellName } from "@repo/abalone-engine/types"
import { cn } from "@repo/nativ/utils"
import { useState } from "react"
import { DemoBoardFrame } from "@/components/demo-board-frame"
import { GameCanvas } from "@/components/game-canvas"

/** Nothing is playable here, and one array keeps the canvas from redrawing for a new one. */
const NO_MOVES: CellName[] = []

type SetupPreviewBoardProps = {
  state: GameState
  marbleDesign?: string
}

/**
 * The board the setup screen previews the starting position on, filling the box
 * it is given.
 *
 * The canvas has nothing in it until the page's script has run, and a canvas
 * that has not drawn is a 300x150 box that takes its real size at the first
 * draw, which is a layout shift. So until then it is out of flow, and the
 * opening position stands in for it as markup, the same picture the home page's
 * demo board uses. The first draw reports the board's size from a layout
 * effect, and the picture goes in that commit: the board is never missing and
 * never doubled.
 */
export function SetupPreviewBoard({
  state,
  marbleDesign,
}: SetupPreviewBoardProps) {
  const [isDrawn, setIsDrawn] = useState(false)

  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-1 self-stretch",
        !isDrawn && "[&_canvas]:absolute",
      )}
    >
      <GameCanvas
        state={state}
        possibleMoves={NO_MOVES}
        marbleDesign={marbleDesign}
        showLabels={false}
        interactive={false}
        onResize={() => setIsDrawn(true)}
      />
      {!isDrawn && <DemoBoardFrame state={state} hasShadow={false} />}
    </div>
  )
}
