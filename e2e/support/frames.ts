import type { Page } from "@playwright/test"

// Reads what the board canvas actually painted, frame by frame, around one move.
// The probe (support/board.ts) answers from the state the board was handed,
// which cannot see a flicker: the wrong picture is on screen for a frame and
// the state is already right again. These read pixels instead.
//
// Three spots are watched: the square the marble leaves, the square it lands
// on, and the point halfway between them, which only a sliding marble crosses.
// Each frame is then compared with the first one (the old position) and the last
// one (the new position). A frame that matches neither is the board in motion.
// Matching whole frames, rather than asking "is there a marble here", is what
// keeps a marble's highlight passing over a spot from reading as a landing.

type Rgb = [number, number, number]

/** The colour of the three spots in one frame, and when it was painted. */
export type Frame = { at: number; from: Rgb; to: Rgb; between: Rgb }

type Point = { x: number; y: number }

type RecorderWindow = Window & {
  __abaloneBoard?: { point: (square: string) => Point | null }
  __boardFrames?: { frames: Frame[]; stop: boolean }
}

/**
 * Starts sampling the board on every animation frame. Call it while the board
 * holds still on the position before the move.
 */
export async function recordFrames(
  page: Page,
  from: string,
  to: string,
): Promise<void> {
  await page.evaluate(
    ([fromSquare, toSquare]) => {
      const board = (window as RecorderWindow).__abaloneBoard
      const canvas = document.querySelector("canvas")
      const context = canvas?.getContext("2d")
      if (!board || !canvas || !context)
        throw new Error("no board to watch")

      /** The canvas pixel under a viewport point, in the bitmap's own units. */
      const pixelOf = (point: Point): Point => {
        const rect = canvas.getBoundingClientRect()
        const scale = canvas.width / rect.width
        return {
          x: Math.round((point.x - rect.left) * scale),
          y: Math.round((point.y - rect.top) * scale),
        }
      }

      /** The average colour of a small patch, so one pixel does not decide it. */
      const colourAt = (point: Point): Rgb => {
        const pixel = pixelOf(point)
        const { data } = context.getImageData(
          pixel.x - 1,
          pixel.y - 1,
          3,
          3,
        )
        const sum: Rgb = [0, 0, 0]
        for (let index = 0; index < data.length; index += 4) {
          sum[0] += data[index]
          sum[1] += data[index + 1]
          sum[2] += data[index + 2]
        }
        const count = data.length / 4
        return [
          Math.round(sum[0] / count),
          Math.round(sum[1] / count),
          Math.round(sum[2] / count),
        ]
      }

      const state = { frames: [] as Frame[], stop: false }
      ;(window as RecorderWindow).__boardFrames = state

      const sample = (at: number) => {
        if (state.stop) return
        //read every frame: the board can be laid out again mid-move
        const start = board.point(fromSquare)
        const end = board.point(toSquare)
        if (start && end) {
          state.frames.push({
            at,
            from: colourAt(start),
            to: colourAt(end),
            between: colourAt({
              x: (start.x + end.x) / 2,
              y: (start.y + end.y) / 2,
            }),
          })
        }
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    },
    [from, to],
  )
}

/** Stops sampling and hands back every frame it saw. */
export function stopFrames(page: Page): Promise<Frame[]> {
  return page.evaluate(() => {
    const state = (window as RecorderWindow).__boardFrames
    if (!state) return []
    state.stop = true
    return state.frames
  })
}

/** Squared colour distance under which two samples are the same paint. */
const SAME_PAINT = 300

const samePaint = (a: Rgb, b: Rgb) =>
  (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2 < SAME_PAINT

const sameFrame = (a: Frame, b: Frame) =>
  samePaint(a.from, b.from) &&
  samePaint(a.to, b.to) &&
  samePaint(a.between, b.between)

/**
 * One letter per frame: b for the old position (the first frame), a for the new
 * one (the last frame), m for anything in between.
 */
export function describeFrames(frames: Frame[]): string {
  const first = frames[0]
  const last = frames[frames.length - 1]
  return frames
    .map((frame) => {
      if (sameFrame(frame, first)) return "b"
      if (sameFrame(frame, last)) return "a"
      return "m"
    })
    .join("")
}

/**
 * Whether the move went across the board the way a played move does: the old
 * position, then the marble sliding, then the new position held, and never a
 * step back. A flicker is a frame that goes back (the old position after the
 * board has left it, or anything else after it has landed); a snap is a move
 * that is not in motion for long enough to be seen sliding. That is measured in
 * time rather than frames, so a loaded machine painting few frames is not
 * mistaken for a board that jumped.
 *
 * `landingOnly` judges only the landing, for the board that played the move:
 * before the slide it shows the press (the marble picked up, the trail it would
 * cut) and lets go of it, which is that player's own doing and no flicker.
 *
 * @returns why it was not, or "" when it was.
 */
export function judgeMove(
  frames: Frame[],
  options: { minMotionMs: number; landingOnly?: boolean },
): string {
  const letters = describeFrames(frames)
  if (!letters.includes("a")) return "never landed"

  const left = letters.search(/[^b]/)
  const landed = letters.indexOf("a")
  if (/[^a]/.test(letters.slice(landed))) {
    return "did not hold the new position"
  }
  if (options.landingOnly) return ""
  if (letters.slice(left).includes("b")) {
    return "went back to the old position"
  }
  //from the last frame on the old position to the first on the new one
  const motionMs = frames[landed].at - frames[Math.max(0, left - 1)].at
  if (motionMs < options.minMotionMs) return "jumped without sliding"
  return ""
}
