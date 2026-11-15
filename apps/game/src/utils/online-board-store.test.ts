import type { GameState } from "@repo/abalone-engine/game-state"
import { createGameState, makeMove } from "@repo/abalone-engine/game-state"
import { describe, expect, it, vi } from "vitest"
import { firstMoveOf } from "@/test-support/legal-move"
import type { PlyMove } from "@/utils/board-timeline"
import type {
  OnlineBoardEffects,
  OnlineBoardLog,
} from "@/utils/online-board-store"
import { OnlineBoardStore } from "@/utils/online-board-store"

//the one owner of what the online board shows. the rules for which step comes
//next are `nextBoardStep`'s (board-timeline.test.ts); what is held here is the
//loop around them: one step at a time, the snapshot it publishes, and what it
//asks of the screen. the engine is real, the screen is a set of fakes.

//---- a game to replay ----------------

type Game = { states: GameState[]; moves: PlyMove[] }

/** `plies` real moves from the opening; ply 0 is the opening, with no move. */
function play(plies: number): Game {
  const states = [createGameState("standard", "black", "online")]
  const moves: PlyMove[] = [{ marbles: [], destination: "0,0" }]
  for (let ply = 1; ply <= plies; ply++) {
    const before = states[ply - 1]
    const side = ply % 2 === 1 ? "black" : "white"
    const { selection, move } = firstMoveOf(before, side)
    states.push(makeMove(before, selection, move).state)
    moves.push({ marbles: selection, destination: move })
  }
  return { states, moves }
}

const game = play(5)

function logOf(latest: number): OnlineBoardLog {
  return {
    latest,
    moveAt: (index) => (index > 0 ? game.moves[index] : undefined),
    stateAt: (index) => game.states[index],
  }
}

//---- fake screen ----------------

type Screen = {
  effects: OnlineBoardEffects
  canAnimate: boolean
  /** Settles every animation that is waiting. */
  land: () => void
  animations: Array<{ movingMarbles: unknown; direction: unknown }>
  played: number
  stopped: number
}

function screen(canAnimate = true): Screen {
  const waiting: Array<() => void> = []
  const fake: Screen = {
    canAnimate,
    animations: [],
    played: 0,
    stopped: 0,
    land: () => {
      for (const settle of waiting.splice(0)) settle()
    },
    effects: {
      canAnimate: () => fake.canAnimate,
      animate: (move) => {
        fake.animations.push(move)
        return new Promise<void>((resolve) => waiting.push(resolve))
      },
      stopAnimation: () => {
        fake.stopped++
        for (const settle of waiting.splice(0)) settle()
      },
      onPlayed: () => {
        fake.played++
      },
    },
  }
  return fake
}

/** Lets the apply loop run until it waits on something outside itself. */
async function settle() {
  for (let turn = 0; turn < 20; turn++) await Promise.resolve()
}

function openedAt(latest: number, canAnimate = true) {
  const fake = screen(canAnimate)
  const store = new OnlineBoardStore(fake.effects)
  store.attach()
  store.setLog(logOf(latest))
  return { store, fake }
}

//---- tests ----------------

describe("OnlineBoardStore", () => {
  describe("before and after the first log", () => {
    it("shows nothing until a log has arrived", () => {
      const store = new OnlineBoardStore(screen().effects)
      store.attach()

      expect(store.getSnapshot()).toEqual({
        shown: null,
        optimistic: null,
        animating: false,
        refusal: null,
      })
    })

    it("cuts straight to the log's last ply, without playing anything out", async () => {
      const { store, fake } = openedAt(3)
      await settle()

      const { shown } = store.getSnapshot()
      expect(shown?.index).toBe(3)
      expect(shown?.state).toBe(game.states[3])
      expect(fake.animations).toEqual([])
    })

    it("holds a log until the board is on screen", async () => {
      const fake = screen()
      const store = new OnlineBoardStore(fake.effects)
      store.setLog(logOf(2))
      await settle()
      expect(store.getSnapshot().shown).toBeNull()

      store.attach()
      await settle()

      expect(store.getSnapshot().shown?.index).toBe(2)
    })

    it("does nothing for a log with no plies in it", async () => {
      const store = new OnlineBoardStore(screen().effects)
      store.attach()
      store.setLog({ ...logOf(0), latest: -1 })
      await settle()

      expect(store.getSnapshot().shown).toBeNull()
    })
  })

  describe("an opponent's move arriving", () => {
    it("plays it out, then shows the position it reached", async () => {
      const { store, fake } = openedAt(2)
      await settle()

      store.setLog(logOf(3))
      await settle()

      expect(fake.animations).toHaveLength(1)
      const mid = store.getSnapshot()
      expect(mid.animating).toBe(true)
      expect(mid.shown?.index).toBe(2)
      //the last move's arrows go before the marbles set off
      expect(mid.shown?.state.lastMove).toBeNull()

      fake.land()
      await settle()

      const done = store.getSnapshot()
      expect(done.animating).toBe(false)
      expect(done.shown?.index).toBe(3)
      expect(done.shown?.state.black).toEqual(game.states[3].black)
      expect(done.shown?.state.white).toEqual(game.states[3].white)
      expect(fake.played).toBe(1)
    })

    it("cuts instead of playing out when animations are off", async () => {
      const { store, fake } = openedAt(2, false)
      await settle()

      store.setLog(logOf(3))
      await settle()

      expect(store.getSnapshot().shown?.index).toBe(3)
      expect(fake.animations).toEqual([])
      expect(fake.played).toBe(0)
    })

    it("cuts when the log is too far ahead to play out", async () => {
      const { store, fake } = openedAt(1)
      await settle()

      store.setLog(logOf(5))
      await settle()

      expect(store.getSnapshot().shown?.index).toBe(5)
      expect(fake.animations).toEqual([])
    })

    it("catches up a short gap one ply at a time", async () => {
      const { store, fake } = openedAt(1)
      await settle()

      store.setLog(logOf(3))
      await settle()
      expect(fake.animations).toHaveLength(1)
      fake.land()
      await settle()
      expect(fake.animations).toHaveLength(2)
      fake.land()
      await settle()

      expect(store.getSnapshot().shown?.index).toBe(3)
      expect(fake.played).toBe(2)
    })

    it("never takes the board back for an older log", async () => {
      const { store } = openedAt(4)
      await settle()

      store.setLog(logOf(2))
      await settle()

      expect(store.getSnapshot().shown?.index).toBe(4)
    })

    //the log is the authority: a move that does not follow from the position
    //on the board is replaced by the position the log says is current
    it("cuts to the log when its move does not follow from the board", async () => {
      const { store, fake } = openedAt(2)
      await settle()
      const disagreeing: OnlineBoardLog = {
        ...logOf(3),
        moveAt: () => ({ marbles: ["-4,0"], destination: "4,4" }),
      }

      store.setLog(disagreeing)
      await settle()

      expect(store.getSnapshot().shown?.index).toBe(3)
      expect(store.getSnapshot().shown?.state).toBe(game.states[3])
      expect(fake.played).toBe(0)
    })
  })

  describe("our own move", () => {
    it("is refused while nothing is on the board", () => {
      const store = new OnlineBoardStore(screen().effects)
      store.attach()

      expect(store.play(game.moves[1])).toBe(false)
    })

    it("plays out at once as an optimistic ply, and keeps it until confirmed", async () => {
      const { store, fake } = openedAt(0)
      await settle()

      expect(store.play(game.moves[1])).toBe(true)
      await settle()

      expect(store.getSnapshot().optimistic).toMatchObject({
        ...game.moves[1],
        index: 1,
      })
      expect(fake.animations).toHaveLength(1)

      fake.land()
      await settle()
      expect(store.getSnapshot().shown?.index).toBe(1)
      expect(store.getSnapshot().optimistic).not.toBeNull()
    })

    it("is confirmed by the server logging the same move, changing nothing on screen", async () => {
      const { store, fake } = openedAt(0)
      await settle()
      store.play(game.moves[1])
      await settle()
      fake.land()
      await settle()
      const shownBefore = store.getSnapshot().shown

      store.setLog(logOf(1))
      await settle()

      const after = store.getSnapshot()
      expect(after.optimistic).toBeNull()
      expect(after.shown).toBe(shownBefore)
      expect(fake.animations).toHaveLength(1)
    })

    it("is replaced by the log when the server logged something else", async () => {
      const { store, fake } = openedAt(0)
      await settle()
      store.play(game.moves[1])
      await settle()
      fake.land()
      await settle()

      store.setLog({
        ...logOf(2),
        moveAt: (index) =>
          index === 1 ? game.moves[3] : game.moves[index],
      })
      await settle()

      const after = store.getSnapshot()
      expect(after.optimistic).toBeNull()
      expect(after.shown?.index).toBe(2)
    })

    it("is refused while a ply is still being played out", async () => {
      const { store, fake } = openedAt(2)
      await settle()
      store.setLog(logOf(3))
      await settle()
      expect(store.getSnapshot().animating).toBe(true)

      expect(store.play(game.moves[4])).toBe(false)
      fake.land()
    })

    it("is refused while another of ours waits on the server", async () => {
      const { store, fake } = openedAt(0, false)
      await settle()
      expect(store.play(game.moves[1])).toBe(true)
      await settle()
      expect(fake.animations).toEqual([])

      expect(store.play(game.moves[2])).toBe(false)
    })

    it("clicks into place when animations are off, once", async () => {
      const { store, fake } = openedAt(0, false)
      await settle()

      store.play(game.moves[1])
      await settle()

      expect(store.getSnapshot().shown?.index).toBe(1)
      expect(fake.animations).toEqual([])
      expect(fake.played).toBe(1)
    })
  })

  describe("a refused move", () => {
    async function withMoveWaiting() {
      const opened = openedAt(0, false)
      await settle()
      opened.store.play(game.moves[1])
      await settle()
      return opened
    }

    it("takes the board back to the server's last ply and says why", async () => {
      const { store } = await withMoveWaiting()
      const reason = new Error("illegal_move")

      store.refuse(1, reason)
      await settle()

      const after = store.getSnapshot()
      expect(after.shown?.index).toBe(0)
      expect(after.shown?.state).toBe(game.states[0])
      expect(after.optimistic).toBeNull()
      expect(after.refusal).toBe(reason)
    })

    it("is cleared by the next move played", async () => {
      const { store } = await withMoveWaiting()
      store.refuse(1, new Error("illegal_move"))
      await settle()

      store.play(game.moves[1])

      expect(store.getSnapshot().refusal).toBeNull()
    })

    it("is ignored for a move that is not the one waiting", async () => {
      const { store } = await withMoveWaiting()

      store.refuse(7, new Error("illegal_move"))
      await settle()

      expect(store.getSnapshot().refusal).toBeNull()
      expect(store.getSnapshot().optimistic?.refused).toBeUndefined()
    })

    it("is ignored when nothing is waiting", async () => {
      const { store } = openedAt(1)
      await settle()

      store.refuse(1, new Error("illegal_move"))

      expect(store.getSnapshot().refusal).toBeNull()
    })
  })

  describe("leaving the screen", () => {
    it("cuts the move in flight short, which settles it", async () => {
      const { store, fake } = openedAt(2)
      await settle()
      store.setLog(logOf(3))
      await settle()

      store.detach()
      await settle()

      expect(fake.stopped).toBe(1)
      const after = store.getSnapshot()
      expect(after.animating).toBe(false)
      //the ply that was sliding does not land on a board nobody is watching
      expect(after.shown?.index).toBe(2)
      expect(fake.played).toBe(0)
    })

    it("stops stepping until it is attached again", async () => {
      const { store, fake } = openedAt(2)
      await settle()
      store.detach()

      store.setLog(logOf(5))
      await settle()
      expect(store.getSnapshot().shown?.index).toBe(2)

      store.attach()
      await settle()
      expect(store.getSnapshot().shown?.index).toBe(5)
      expect(fake.animations).toEqual([])
    })
  })

  describe("subscribe", () => {
    it("tells listeners about every change until they unsubscribe", async () => {
      const fake = screen()
      const store = new OnlineBoardStore(fake.effects)
      const listener = vi.fn()
      const unsubscribe = store.subscribe(listener)
      store.attach()

      store.setLog(logOf(1))
      await settle()
      expect(listener).toHaveBeenCalled()

      listener.mockClear()
      unsubscribe()
      store.setLog(logOf(5))
      await settle()
      expect(listener).not.toHaveBeenCalled()
    })

    it("hands out a new snapshot object only when something changed", async () => {
      const { store } = openedAt(1)
      await settle()
      const before = store.getSnapshot()

      store.setLog(logOf(1))
      await settle()

      expect(store.getSnapshot()).toBe(before)
    })
  })
})
