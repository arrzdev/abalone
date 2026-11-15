import type { GameState } from "@repo/abalone-engine/game-state"
import type { CellName } from "@repo/abalone-engine/types"
import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { BotChatterOptions } from "@/hooks/use-bot-chatter"
import { useBotChatter } from "@/hooks/use-bot-chatter"
import { renderHookWithProps } from "@/test-support/render-hook-with-props"
import { marblesAtRisk } from "@/utils/threats"

//the position is beside the point here: which marbles are in danger is the
//engine's answer (utils/threats has its own tests), so it is arranged per move
vi.mock("@/utils/threats", () => ({ marblesAtRisk: vi.fn() }))

//a line is a key, so a pick that names the event is all a test needs to read
vi.mock("@/i18n/bots", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/i18n/bots")>()
  return {
    ...original,
    pickLine: (_level: number, event: string) => `line:${event}`,
  }
})

type Move = { isCapture: boolean; color: "black" | "white" }

//a game as the chatter reads it: how many plies there are, which one is shown,
//and what each ply did. nothing else of a `GameState` is looked at.
function stateAfter(
  moves: Move[],
  options: { shown?: number; gameOver?: boolean } = {},
): GameState {
  return {
    currentMoveIndex: options.shown ?? moves.length - 1,
    gameOver: options.gameOver ?? false,
    moveHistory: moves.map((moveDetails) => ({ moveDetails })),
  } as unknown as GameState
}

const QUIET: Move = { isCapture: false, color: "black" }
const BASE: BotChatterOptions = {
  level: 3,
  enabled: true,
  phase: "ingame",
  winner: null,
  botColor: "white",
  state: stateAfter([]),
}

function mount(options: Partial<BotChatterOptions> = {}) {
  return renderHookWithProps(useBotChatter, { ...BASE, ...options })
}

//who is in danger after the next move to be played, as the engine would say
function arrange(atRisk: { black?: CellName[]; white?: CellName[] }) {
  vi.mocked(marblesAtRisk).mockImplementation(
    (_board, victim) => new Set(atRisk[victim] ?? []),
  )
}

describe("useBotChatter", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    arrange({})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe("the ends of a game", () => {
    it("opens when play begins, once per game", () => {
      const hook = mount({ phase: "pregame" })
      expect(hook.current.line).toBeNull()

      hook.rerender({ ...BASE, phase: "ingame" })
      expect(hook.current.line).toBe("line:opening")

      //a re-render that keeps it in play is not a new game
      act(() => hook.current.say("ambient"))
      hook.rerender({ ...BASE, phase: "ingame", level: 3 })
      expect(hook.current.line).toBe("line:ambient")
      hook.unmount()
    })

    it("says nothing when there is no bot", () => {
      const hook = mount({ enabled: false })
      expect(hook.current.line).toBeNull()
      hook.unmount()
    })

    it("falls silent when the bot is switched off mid-game", () => {
      const hook = mount()
      expect(hook.current.line).toBe("line:opening")
      hook.rerender({ ...BASE, enabled: false })
      expect(hook.current.line).toBeNull()
      hook.unmount()
    })

    it.each([
      ["white", "line:win"],
      ["black", "line:loss"],
    ] as const)("says its result when %s wins", (winner, expected) => {
      const hook = mount()
      hook.rerender({ ...BASE, phase: "postgame", winner })
      expect(hook.current.line).toBe(expected)
      hook.unmount()
    })

    //the roster has a line for winning and one for losing, neither true of a draw
    it("leaves a draw alone", () => {
      const hook = mount()
      hook.rerender({ ...BASE, phase: "postgame", winner: null })
      expect(hook.current.line).toBe("line:opening")
      hook.unmount()
    })

    it("speaks the result only once", () => {
      const hook = mount()
      hook.rerender({ ...BASE, phase: "postgame", winner: "white" })
      act(() => hook.current.say("ambient"))
      hook.rerender({
        ...BASE,
        phase: "postgame",
        winner: "white",
        level: 3,
      })
      expect(hook.current.line).toBe("line:ambient")
      hook.unmount()
    })
  })

  describe("reacting to a move", () => {
    //let the opener's hold lapse so the move's own reaction is what is tested
    function playedOn(moves: Move[], options?: { shown?: number }) {
      const hook = mount()
      act(() => vi.advanceTimersByTime(5000))
      hook.rerender({ ...BASE, state: stateAfter(moves, options) })
      return hook
    }

    it("celebrates pushing a marble off", () => {
      const hook = playedOn([{ isCapture: true, color: "white" }])
      expect(hook.current.line).toBe("line:push_off")
      hook.unmount()
    })

    it("laments having one pushed off", () => {
      const hook = playedOn([{ isCapture: true, color: "black" }])
      expect(hook.current.line).toBe("line:pushed_off")
      hook.unmount()
    })

    it("remarks on a marble of the player's that walked into danger", () => {
      arrange({ black: ["E5"] })
      const hook = playedOn([QUIET])
      expect(hook.current.line).toBe("line:opponent_at_risk")
      hook.unmount()
    })

    it("remarks on its own marble in danger", () => {
      arrange({ white: ["E5"] })
      const hook = playedOn([QUIET])
      expect(hook.current.line).toBe("line:self_at_risk")
      hook.unmount()
    })

    //one move, one line: a capture outranks a marble that merely might go
    it("picks the highest-ranked event when a move sets off several", () => {
      arrange({ black: ["E5"], white: ["F5"] })
      const hook = playedOn([{ isCapture: true, color: "black" }])
      expect(hook.current.line).toBe("line:pushed_off")
      hook.unmount()
    })

    //a marble left on the rim for several moves is not news a second time
    it("does not repeat itself about a danger that is still there", () => {
      arrange({ black: ["E5"] })
      const hook = playedOn([QUIET])
      act(() => hook.current.say("opening"))
      act(() => vi.advanceTimersByTime(5000))

      hook.rerender({ ...BASE, state: stateAfter([QUIET, QUIET]) })

      expect(hook.current.line).toBe("line:opening")
      hook.unmount()
    })

    it("fills a quiet stretch with small talk after a few moves", () => {
      const hook = playedOn([QUIET])
      expect(hook.current.line).toBe("line:opening")

      const moves = [QUIET]
      for (let i = 0; i < 3; i++) {
        moves.push(QUIET)
        act(() => vi.advanceTimersByTime(5000))
        hook.rerender({ ...BASE, state: stateAfter([...moves]) })
      }

      expect(hook.current.line).toBe("line:ambient")
      hook.unmount()
    })

    it("does not react to a game that is already over", () => {
      const hook = mount()
      act(() => vi.advanceTimersByTime(5000))
      hook.rerender({
        ...BASE,
        state: stateAfter([{ isCapture: true, color: "white" }], {
          gameOver: true,
        }),
      })
      expect(hook.current.line).toBe("line:opening")
      hook.unmount()
    })

    //re-reading the history is not the game being played
    it("does not re-react to a move the player stepped back to", () => {
      const hook = playedOn([{ isCapture: true, color: "white" }, QUIET], {
        shown: 0,
      })
      expect(hook.current.line).toBe("line:opening")
      hook.unmount()
    })

    it("reacts to a ply once, not on every render", () => {
      const state = stateAfter([{ isCapture: true, color: "white" }])
      const hook = mount()
      act(() => vi.advanceTimersByTime(5000))
      hook.rerender({ ...BASE, state })
      expect(hook.current.line).toBe("line:push_off")

      act(() => hook.current.say("ambient"))
      hook.rerender({ ...BASE, state: { ...state } })

      expect(hook.current.line).toBe("line:ambient")
      hook.unmount()
    })
  })

  describe("holding a line", () => {
    it("keeps a fresh line against a lesser event", () => {
      arrange({ white: ["E5"] })
      const hook = mount()
      //the opener went up a moment ago, and an opener is not in the ranking: a
      //reaction has to outrank it, and none does
      hook.rerender({ ...BASE, state: stateAfter([QUIET]) })
      expect(hook.current.line).toBe("line:opening")
      hook.unmount()
    })

    it("lets a fresh line be replaced by something that outranks it", () => {
      arrange({ white: ["E5"] })
      const hook = mount()
      act(() => vi.advanceTimersByTime(5000))
      hook.rerender({ ...BASE, state: stateAfter([QUIET]) })
      expect(hook.current.line).toBe("line:self_at_risk")

      //within the hold, a capture outranks a marble that merely might go
      act(() => vi.advanceTimersByTime(500))
      hook.rerender({
        ...BASE,
        state: stateAfter([QUIET, { isCapture: true, color: "white" }]),
      })

      expect(hook.current.line).toBe("line:push_off")
      hook.unmount()
    })
  })
})
