import type { GameMode } from "@repo/abalone-engine/game-state"
import type { Player } from "@repo/abalone-engine/types"
import { useCallback, useEffect, useRef, useState } from "react"
import type { GamePhase } from "@/hooks/use-bot-chatter"
import type {
  GuideEvent,
  GuideProgress,
  GuideStep,
} from "@/utils/first-game-guide"
import {
  advanceGuide,
  isGuideDone,
  markGuideDone,
  shouldGuide,
  subscribeGuide,
} from "@/utils/first-game-guide"

export type FirstGameGuideInput = {
  mode: GameMode
  phase: GamePhase
  /** Marbles the board shows selected right now. */
  selectedCount: number
  /** Positions in the game's history; one more each time a move lands. */
  moveCount: number
  currentTurn: Player
  /** The bot's colour, or null when both sides are people at this device. */
  botColor: Player | null
  gameOver: boolean
  /**
   * Whether the panel is beside the board. Under it, on a phone upright, there
   * is no guide: a step's whole title and text would take the board's room.
   */
  besideBoard: boolean
}

export type FirstGameGuide = {
  /** The step on screen, or null when there is no guide to show. */
  step: GuideStep | null
  next: () => void
  skip: () => void
}

/**
 * The first-game guide for the offline board: whether it shows, which step,
 * and what moves it on. The board and the game feed it; `advanceGuide` decides.
 */
export function useFirstGameGuide({
  mode,
  phase,
  selectedCount,
  moveCount,
  currentTurn,
  botColor,
  gameOver,
  besideBoard,
}: FirstGameGuideInput): FirstGameGuide {
  //done until the flag is read: the page is prerendered, and a flag read during
  //the first render would be a hydration mismatch (React #418)
  const [done, setDone] = useState(true)
  const [progress, setProgress] = useState<GuideProgress>("select")

  useEffect(() => {
    setDone(isGuideDone())
    return subscribeGuide(() => {
      const nowDone = isGuideDone()
      setDone(nowDone)
      //a reset ("How to move") starts over at the first step
      if (!nowDone) setProgress("select")
    })
  }, [])

  //a game on a phone upright is not one the guide saw, so it does not finish it
  const active =
    besideBoard && shouldGuide(mode, done) && progress !== "done"
  const visible = active && phase === "ingame"

  const dispatch = useCallback((event: GuideEvent) => {
    setProgress((current) => advanceGuide(current, event))
  }, [])

  useEffect(() => {
    if (progress === "done" && !done) markGuideDone()
  }, [progress, done])

  //a new game starts the guide from its first step
  const previousPhase = useRef(phase)
  useEffect(() => {
    const before = previousPhase.current
    previousPhase.current = phase
    if (!active || before === phase) return
    if (phase === "ingame") setProgress("select")
    if (before === "ingame" && phase === "postgame")
      dispatch({ type: "game_over" })
  }, [active, phase, dispatch])

  //only a person's selection teaches anything: the bot's move shows its own
  //marbles selected while it animates. a change, never what was already there:
  //"How to move" on a board with marbles picked still starts at step 1
  const playersTurn = !gameOver && currentTurn !== botColor
  const previousSelectedCount = useRef(selectedCount)
  useEffect(() => {
    const changed = selectedCount !== previousSelectedCount.current
    previousSelectedCount.current = selectedCount
    if (!changed || !visible || !playersTurn) return
    dispatch({ type: "selected", count: selectedCount })
  }, [visible, playersTurn, selectedCount, dispatch])

  //a move lands as one more position in the history, made by whoever had the
  //turn before it
  const previousMoveCount = useRef(moveCount)
  const turnBefore = useRef(currentTurn)
  useEffect(() => {
    const landed = moveCount > previousMoveCount.current
    const mover = turnBefore.current
    previousMoveCount.current = moveCount
    turnBefore.current = currentTurn
    if (visible && landed && mover !== botColor)
      dispatch({ type: "moved" })
  }, [visible, moveCount, currentTurn, botColor, dispatch])

  const next = useCallback(() => dispatch({ type: "next" }), [dispatch])
  const skip = useCallback(() => dispatch({ type: "skip" }), [dispatch])

  return {
    step: progress === "done" || !visible ? null : progress,
    next,
    skip,
  }
}
