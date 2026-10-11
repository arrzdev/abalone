import type { GameMode } from "@repo/abalone-engine/game-state"
import tryCatch from "@repo/shared/try-catch"

/**
 * Where a finished or skipped guide is remembered. Versioned, so a redesign of
 * the guide bumps it and every player sees the new one once.
 */
export const GUIDE_STORAGE_KEY = "abalone.guide.v1"

const DONE = "done"

/** The three steps, in the order they are shown. */
export type GuideStep = "select" | "direction" | "win"

/** Where a guide is: on one of its steps, or over. */
export type GuideProgress = GuideStep | "done"

/** What the page tells the guide happened. */
export type GuideEvent =
  | { type: "selected"; count: number }
  | { type: "moved" }
  | { type: "next" }
  | { type: "skip" }
  | { type: "game_over" }

const STEPS: readonly GuideStep[] = ["select", "direction", "win"]

/**
 * The guide's one rule for which step is showing.
 *
 * The first two steps move on when the player does what they teach; Next moves
 * any step on and Skip ends it. A move landing on step 1 jumps to the goal: a
 * move is a selection and a direction in one, however the player got there.
 */
export function advanceGuide(
  progress: GuideProgress,
  event: GuideEvent,
): GuideProgress {
  if (progress === "done") return "done"

  switch (event.type) {
    case "skip":
    case "game_over":
      return "done"
    case "next":
      return STEPS[STEPS.indexOf(progress) + 1] ?? "done"
    case "moved":
      return "win"
    case "selected":
      if (progress === "select" && event.count > 0) return "direction"
      if (progress === "direction" && event.count === 0) return "select"
      return progress
  }
}

/** The step's place in "Step N of 3". */
export function guideStepNumber(step: GuideStep): number {
  return STEPS.indexOf(step) + 1
}

export const GUIDE_STEP_COUNT = STEPS.length

/** Offline games only: an online game has someone waiting on the other side. */
export function shouldGuide(mode: GameMode, done: boolean): boolean {
  return mode !== "online" && !done
}

//the flag as this page load knows it. storage that refuses every call (private
//mode) still gets a guide that shows once per page load rather than every game
let rememberedDone = false

//every mounted guide hears a reset or a finish, so "How to move" in a sheet
//rendered by the header still reaches the board behind it
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

/** Calls `listener` on every change to the flag. Returns the unsubscribe. */
export function subscribeGuide(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Whether this player has finished or skipped the guide. */
export function isGuideDone(): boolean {
  const [raw] = tryCatch(() => localStorage.getItem(GUIDE_STORAGE_KEY))
  return raw === DONE || rememberedDone
}

/** Remembers that the guide is finished, skipped, or its game is over. */
export function markGuideDone(): void {
  rememberedDone = true
  tryCatch(() => localStorage.setItem(GUIDE_STORAGE_KEY, DONE))
  notify()
}

/** Forgets the flag, so the guide shows again ("How to move"). */
export function resetGuide(): void {
  rememberedDone = false
  tryCatch(() => localStorage.removeItem(GUIDE_STORAGE_KEY))
  notify()
}
