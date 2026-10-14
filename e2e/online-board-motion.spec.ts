import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { startOnlineGame } from "./support/app"
import { expectMarble, selectSquare, tapSquare } from "./support/board"
import type { Frame } from "./support/frames"
import {
  describeFrames,
  judgeMove,
  recordFrames,
  stopFrames,
} from "./support/frames"

// Every change to an online board goes the way a move played on it does, frame
// by frame: the old position, the marble sliding, the new position held. Never
// the new position, then the old one, then the slide again, and never a jump.
// That holds for a move arriving from the server, and for the board that played
// the move while the server confirms it, however the answer gets back.
// Design: docs/online-board.md.

/**
 * How long each board is watched after the move has landed: long enough for
 * the server's answer, the realtime beacon and the refetched plies to arrive,
 * which is when a board that takes whole states would swap one in.
 */
const SETTLE_MS = 2_000

/**
 * Shortest time in motion that still reads as a slide: half of the 350 ms a
 * move takes (`TIMING.MOVE`). A move pasted in is one frame, well under it.
 */
const MIN_MOTION_MS = 175

type Ply = { from: string; to: string; color: "black" | "white" }

type Verdict = { reason: string; frames: string }

/**
 * Plays one move and watches both boards do it. Both recordings start before the
 * press, so each one's first frame is the position with nothing selected.
 *
 * @returns what each board did, one letter per frame (b before, m moving,
 * a after), and why it was not smooth ("" when it was).
 */
async function playWatched(
  mover: Page,
  watcher: Page,
  ply: Ply,
): Promise<{ watcher: Verdict; mover: Verdict }> {
  await expectMarble(watcher, ply.from, ply.color)
  await expectMarble(mover, ply.from, ply.color)

  await recordFrames(watcher, ply.from, ply.to)
  await recordFrames(mover, ply.from, ply.to)
  await selectSquare(mover, ply.from)
  await tapSquare(mover, ply.to)

  await expectMarble(watcher, ply.to, ply.color)
  await expectMarble(mover, ply.to, ply.color)
  // a fixed window on purpose: this watches for something that must NOT happen,
  // so there is no state to wait on
  await watcher.waitForTimeout(SETTLE_MS)

  const watched = await stopFrames(watcher)
  const played = await stopFrames(mover)
  return {
    watcher: {
      reason: judgeMove(watched, { minMotionMs: MIN_MOTION_MS }),
      frames: await explain(watcher, watched),
    },
    mover: {
      reason: judgeMove(played, {
        minMotionMs: MIN_MOTION_MS,
        landingOnly: true,
      }),
      frames: await explain(mover, played),
    },
  }
}

/**
 * The frames as letters, then what a failure needs to say why: how long the
 * board was in motion, when each frame around the move was painted, and the
 * steps the board took (played out or cut in, and how long the slide ran).
 * Diagnostics only: the verdict is `judgeMove`'s.
 */
async function explain(page: Page, frames: Frame[]): Promise<string> {
  const letters = describeFrames(frames)
  const left = Math.max(0, letters.search(/[^b]/) - 1)
  const landed = letters.indexOf("a")
  const motion =
    landed >= 0
      ? `${Math.round(frames[landed].at - frames[left].at)} ms`
      : "?"
  const around = frames
    .slice(Math.max(0, left - 2), landed + 3)
    .map((frame) => Math.round(frame.at))
    .join(",")
  const steps = await page.evaluate(() => {
    const steps = window as Window & { __onlineBoardSteps?: unknown[] }
    const taken = steps.__onlineBoardSteps ?? []
    steps.__onlineBoardSteps = []
    return taken
  })
  return `${letters} | motion ${motion} | frames at ${around} | steps ${JSON.stringify(steps)}`
}

/** Fails softly with the frames in the message, so a failure shows the flicker. */
function expectSmooth(result: Verdict, what: string) {
  expect.soft(result.reason, `${what}: ${result.frames}`).toBe("")
}

test("a move from the server plays out as smoothly as one played on the board", async ({
  browser,
}) => {
  test.slow(
    browser.browserType().name() === "webkit",
    "two WebKit pages paint in software",
  )

  const { host, guest, hostPage, guestPage } =
    await startOnlineGame(browser)

  // black and white each move twice, one marble straight ahead each time
  const plies: Ply[] = [
    { from: "c5", to: "d5", color: "black" },
    { from: "g5", to: "f5", color: "white" },
    { from: "c4", to: "d4", color: "black" },
    { from: "g6", to: "f6", color: "white" },
  ]
  for (const ply of plies) {
    const [mover, watcher] =
      ply.color === "black" ? [hostPage, guestPage] : [guestPage, hostPage]
    const result = await playWatched(mover, watcher, ply)
    const name = `${ply.from}${ply.to}`
    expectSmooth(result.watcher, `${name} on the other board`)
    expectSmooth(result.mover, `${name} on the board that played it`)
  }

  await host.close()
  await guest.close()
})

// The server stores the move but its answer never reaches the board that played
// it, as on a phone that drops off the network for a moment. The server's log is
// what says whether the move happened, so the move stays where it landed while
// the board asks: it must not be taken back and played a second time.
test("a move whose answer is lost on the way back lands once", async ({
  browser,
}) => {
  test.slow(
    browser.browserType().name() === "webkit",
    "two WebKit pages paint in software",
  )

  const { host, guest, hostPage, guestPage } =
    await startOnlineGame(browser)

  await hostPage.route("**/api/v1/games/*/moves", async (route) => {
    if (route.request().method() !== "POST") return route.fallback()
    // the request reaches the server and is played there; only the answer is lost
    await route.fetch()
    await route.abort("connectionreset")
  })

  const result = await playWatched(hostPage, guestPage, {
    from: "c5",
    to: "d5",
    color: "black",
  })
  expectSmooth(result.mover, "c5d5 on the board that played it")
  expectSmooth(result.watcher, "c5d5 on the other board")

  await host.close()
  await guest.close()
})
