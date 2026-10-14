/**
 * What the online board did, step by step, for the e2e suite to print when a
 * frame-by-frame check fails: whether a move was played out or cut in, and how
 * long its animation ran. Only in the e2e build (`vite build --mode e2e`).
 */
export type BoardStepRecord = {
  /** `performance.now()` when it happened. */
  at: number
  kind: "play" | "confirm" | "cut" | "landed"
  index: number
  /** For `landed`: how long the move was in motion. */
  ms?: number
}

declare global {
  interface Window {
    __onlineBoardSteps?: BoardStepRecord[]
  }
}

export function recordBoardStep(step: Omit<BoardStepRecord, "at">) {
  if (import.meta.env.MODE !== "e2e") return
  window.__onlineBoardSteps ??= []
  window.__onlineBoardSteps.push({
    at: Math.round(performance.now()),
    ...step,
  })
}
