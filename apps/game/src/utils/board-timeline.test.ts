import { describe, expect, it } from "vitest"
import type { BoardTimelineInput, PlyMove } from "@/utils/board-timeline"
import {
  failedMoveVerdict,
  MAX_REPLAYED_PLIES,
  nextBoardStep,
} from "@/utils/board-timeline"

//the online board has one way to change what it shows, and these are its rules.
//every case below used to be its own path through the board hook (a played
//move, an arriving one, a resync), and the flicker lived in the gaps between
//them: whichever source won a render replaced the whole picture.

/** Black's opening push and white's answer, as the server stores them. */
const moves: Record<number, PlyMove> = {
  1: { marbles: ["-4,0"], destination: "-3,0" },
  2: { marbles: ["4,0"], destination: "3,0" },
  3: { marbles: ["-4,1"], destination: "-3,1" },
  4: { marbles: ["4,-1"], destination: "3,-1" },
}

function input(
  overrides: Partial<BoardTimelineInput>,
): BoardTimelineInput {
  return {
    shown: 0,
    serverLatest: 0,
    serverMove: (index) => moves[index],
    optimistic: null,
    canAnimate: true,
    ...overrides,
  }
}

describe("nextBoardStep", () => {
  it("does nothing while the board shows the server's last ply", () => {
    expect(nextBoardStep(input({ shown: 2, serverLatest: 2 }))).toEqual({
      kind: "idle",
    })
  })

  //THE REGRESSION CLASS. a log that is older than the board (a refetch that
  //started before the last one landed, a cached copy restored late) must never
  //take the board back: that is the move landing, vanishing and landing again.
  it("never takes the board back to a ply it has already left", () => {
    expect(nextBoardStep(input({ shown: 3, serverLatest: 2 }))).toEqual({
      kind: "idle",
    })
  })

  it("plays the opponent's move out from the ply on the board", () => {
    expect(nextBoardStep(input({ shown: 1, serverLatest: 2 }))).toEqual({
      kind: "play",
      index: 2,
      move: moves[2],
    })
  })

  //a resync is not a different path: it is the same step taken more than once
  it("catches up a short resync one ply at a time, oldest first", () => {
    expect(
      nextBoardStep(
        input({ shown: 1, serverLatest: 1 + MAX_REPLAYED_PLIES }),
      ),
    ).toEqual({ kind: "play", index: 2, move: moves[2] })
  })

  it("cuts to the last ply when the board is further behind than that", () => {
    expect(
      nextBoardStep(
        input({ shown: 0, serverLatest: MAX_REPLAYED_PLIES + 1 }),
      ),
    ).toEqual({ kind: "cut", index: MAX_REPLAYED_PLIES + 1 })
  })

  it("cuts instead of playing out when nobody can watch it", () => {
    expect(
      nextBoardStep(
        input({ shown: 1, serverLatest: 2, canAnimate: false }),
      ),
    ).toEqual({ kind: "cut", index: 2 })
  })

  it("cuts when the server's log has no move for the next ply", () => {
    expect(
      nextBoardStep(
        input({
          shown: 1,
          serverLatest: 2,
          serverMove: () => undefined,
        }),
      ),
    ).toEqual({ kind: "cut", index: 2 })
  })

  describe("with a move of our own the server has not confirmed", () => {
    const ours = { ...moves[3], index: 3 }

    //also after a failed request: its answer may have been lost after the
    //server played the move, so until the server says otherwise the move stays
    it("keeps showing it while the server's log has not reached it", () => {
      expect(
        nextBoardStep(
          input({ shown: 3, serverLatest: 2, optimistic: ours }),
        ),
      ).toEqual({ kind: "idle" })
    })

    //the reconciliation: the server's copy of our move changes nothing on screen
    it("confirms it when the server's ply is the same move", () => {
      expect(
        nextBoardStep(
          input({ shown: 3, serverLatest: 3, optimistic: ours }),
        ),
      ).toEqual({ kind: "confirm", index: 3 })
    })

    it("confirms it whatever order the marbles were listed in", () => {
      const twoMarbles = {
        marbles: ["-4,1", "-4,0"],
        destination: "-3,1",
        index: 3,
      }
      expect(
        nextBoardStep(
          input({
            shown: 3,
            serverLatest: 3,
            optimistic: twoMarbles,
            serverMove: () => ({
              marbles: ["-4,0", "-4,1"],
              destination: "-3,1",
            }),
          }),
        ),
      ).toEqual({ kind: "confirm", index: 3 })
    })

    //the opponent answered before our own confirmation came back: the answer
    //waits its turn, it does not replace the move it answers
    it("confirms it before playing a reply that came in the same log", () => {
      expect(
        nextBoardStep(
          input({ shown: 3, serverLatest: 4, optimistic: ours }),
        ),
      ).toEqual({ kind: "confirm", index: 3 })
    })

    it("goes back to the server's last ply once the server refused it", () => {
      expect(
        nextBoardStep(
          input({
            shown: 3,
            serverLatest: 2,
            optimistic: { ...ours, refused: true },
          }),
        ),
      ).toEqual({ kind: "cut", index: 2 })
    })

    it("lets the server win when its ply is a different move", () => {
      expect(
        nextBoardStep(
          input({
            shown: 3,
            serverLatest: 3,
            optimistic: { ...moves[1], index: 3 },
          }),
        ),
      ).toEqual({ kind: "cut", index: 3 })
    })
  })
})

//what a failed play request means for the move it carried. only the server can
//say a move did not happen: a refusal in so many words, or its log holding a
//different move at that index (which `nextBoardStep` already cuts on). anything
//else is an answer that may have been lost after the move was played.
describe("failedMoveVerdict", () => {
  it("refuses the move when the server answered with a domain error", () => {
    expect(
      failedMoveVerdict({
        failure: "refused",
        index: 3,
        serverLatest: 2,
        refetches: 0,
      }),
    ).toBe("refused")
  })

  it("asks the server again after a network error", () => {
    expect(
      failedMoveVerdict({
        failure: "unknown",
        index: 3,
        serverLatest: 2,
        refetches: 0,
      }),
    ).toBe("refetch")
  })

  //the lost answer: the server played the move and the reply never came back
  it("leaves it to the log once the log has reached the move", () => {
    expect(
      failedMoveVerdict({
        failure: "unknown",
        index: 3,
        serverLatest: 3,
        refetches: 1,
      }),
    ).toBe("settled")
  })

  it("asks once more when the first refetch has not reached the move", () => {
    expect(
      failedMoveVerdict({
        failure: "unknown",
        index: 3,
        serverLatest: 2,
        refetches: 1,
      }),
    ).toBe("refetch")
  })

  it("refuses the move when the log is still missing it after that", () => {
    expect(
      failedMoveVerdict({
        failure: "unknown",
        index: 3,
        serverLatest: 2,
        refetches: 2,
      }),
    ).toBe("refused")
  })
})
