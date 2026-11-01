import {
  createGameState,
  toSearchState,
} from "@repo/abalone-engine/game-state"
import { destinationsFor } from "@repo/abalone-engine/moves"
import {
  BLACK,
  positionFromNames,
  WHITE,
} from "@repo/abalone-engine/position"
import { cellNamed } from "@repo/abalone-engine/topology"
import type { Player, SearchBoard } from "@repo/abalone-engine/types"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createBot } from "@/ai/search"

//a bot is handed the bare board and answers with the line it picks up and the
//square it moves onto. what these cases hold it to is what a player would:
//the move is legal, it takes a capture when one is on offer, and it does not
//play the same move for ever.

function board(
  black: string[],
  white: string[],
  turn: Player,
): SearchBoard {
  return { black, white, turn }
}

/** Whether the answer is a move the rules would let `turn` make. */
function isLegal(
  position: SearchBoard,
  answer: {
    selection: string[] | null
    move: string | null
  },
): boolean {
  if (!answer.selection || !answer.move) return false
  const side = position.turn === "black" ? BLACK : WHITE
  const names = positionFromNames(position.black, position.white)
  const line = answer.selection.map(cellNamed)
  return destinationsFor(names, line, side).includes(
    cellNamed(answer.move),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("createBot", () => {
  it("answers the opening with a legal move at every level", () => {
    const opening = toSearchState(createGameState("standard"))

    for (let level = 1; level <= 8; level++) {
      const answer = createBot(level).chooseMove(opening)
      expect(answer.type).toBe("move")
      expect(isLegal(opening, answer)).toBe(true)
    }
  })

  it("answers legally for white as well", () => {
    const state = {
      ...createGameState("standard"),
      currentTurn: "white" as const,
    }
    const opening = toSearchState(state)

    expect(isLegal(opening, createBot(6).chooseMove(opening))).toBe(true)
  })

  it("takes the capture on offer", () => {
    //two black marbles can shove the white one on the rim clean off
    const position = board(["0,2", "0,3"], ["0,4"], "black")
    const answer = createBot(6).chooseMove(position)

    expect(answer.selection).toHaveLength(2)
    expect(answer.selection).toEqual(
      expect.arrayContaining(["0,2", "0,3"]),
    )
    expect(answer.move).toBe("0,4")
    expect(answer.score).toBeGreaterThan(0.9)
  })

  it("takes the capture for white too, with the score read from black's side", () => {
    const position = board(["0,-4"], ["0,-2", "0,-3"], "white")
    const answer = createBot(6).chooseMove(position)

    expect(answer.selection).toEqual(
      expect.arrayContaining(["0,-2", "0,-3"]),
    )
    expect(answer.move).toBe("0,-4")
    expect(answer.score).toBeLessThan(-0.9)
  })

  it("scores a position the same size from either side's chair", () => {
    const asBlack = createBot(6).chooseMove(
      board(["0,2", "0,3"], ["0,4"], "black"),
    )
    const asWhite = createBot(6).chooseMove(
      board(["0,-4"], ["0,-2", "0,-3"], "white"),
    )

    expect(asWhite.score).toBeCloseTo(-asBlack.score, 10)
  })

  it("looks further ahead at higher levels without breaking the rules", () => {
    const position = board(
      ["0,0", "0,1", "1,0", "1,-1", "0,2"],
      ["-1,0", "-1,1", "-2,1", "0,4", "0,3"],
      "black",
    )

    for (const level of [5, 7, 8]) {
      expect(
        isLegal(position, createBot(level).chooseMove(position)),
      ).toBe(true)
    }
  })

  it("ignores squares that are not on the board", () => {
    const position = board(
      ["0,2", "0,3", "9,9"],
      ["0,4", "nowhere"],
      "black",
    )
    const answer = createBot(6).chooseMove(position)

    expect(answer.move).toBe("0,4")
  })

  it("gives a straight answer when there is nothing left to move", () => {
    const answer = createBot(6).chooseMove(board([], ["0,0"], "black"))

    expect(answer.type).toBe("move")
    expect(answer.selection).toBeNull()
    expect(answer.move).toBeNull()
    expect(Number.isFinite(answer.score)).toBe(true)
  })

  it("does not think about the same position twice the same way", () => {
    const bot = createBot(6)
    const opening = toSearchState(createGameState("standard"))
    const picked = new Set<string>()

    for (let turn = 0; turn < 4; turn++) {
      const answer = bot.chooseMove(opening)
      picked.add(`${answer.selection?.join("+")}>${answer.move}`)
    }

    //it keeps being offered a position it has already driven the game into,
    //and has to find something else rather than shuffle back and forth
    expect(picked.size).toBeGreaterThan(1)
  })

  it("counts the distinct positions the game has stood in", () => {
    const bot = createBot(6)
    const opening = toSearchState(createGameState("standard"))
    expect(bot.positionsSeen()).toBe(0)

    bot.chooseMove(opening)
    expect(bot.positionsSeen()).toBe(1)

    bot.chooseMove(opening)
    bot.chooseMove(opening)
    expect(bot.positionsSeen()).toBeGreaterThan(1)
  })

  it("keeps one game's memory away from another bot's", () => {
    const opening = toSearchState(createGameState("standard"))
    const first = createBot(6)
    first.chooseMove(opening)

    expect(createBot(6).positionsSeen()).toBe(0)
  })

  it("answers the same way twice from a fresh bot", () => {
    const opening = toSearchState(createGameState("standard"))

    expect(createBot(7).chooseMove(opening)).toEqual(
      createBot(7).chooseMove(opening),
    )
  })

  describe("caprice", () => {
    it("sometimes plays a legal move without searching, and says it has no opinion", () => {
      vi.spyOn(Math, "random").mockReturnValue(0)
      const opening = toSearchState(createGameState("standard"))
      const answer = createBot(1).chooseMove(opening)

      expect(isLegal(opening, answer)).toBe(true)
      expect(answer.score).toBe(0)
    })

    it("searches when the dice say so", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.99)
      const opening = toSearchState(createGameState("standard"))
      const answer = createBot(1).chooseMove(opening)

      expect(isLegal(opening, answer)).toBe(true)
      expect(answer.score).not.toBe(0)
    })

    it("never plays on a whim at the strongest levels", () => {
      vi.spyOn(Math, "random").mockReturnValue(0)
      const position = board(["0,2", "0,3"], ["0,4"], "black")

      expect(createBot(8).chooseMove(position).move).toBe("0,4")
    })
  })
})
