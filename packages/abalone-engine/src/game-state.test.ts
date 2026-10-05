import { describe, expect, it } from "vitest"
import type { SetupKey } from "#abalone-engine/board-setups"
import type { GameState } from "#abalone-engine/game-state"
import {
  canNextMove,
  canPrevMove,
  createGameState,
  evaluateGameOver,
  getMarbleAt,
  getOpponent,
  goToMove,
  isValidSelection,
  isViewingHistory,
  makeMove,
  nextMove,
  prevMove,
  resignGame,
  toSearchState,
  truncateToMove,
  undoTargetIndex,
} from "#abalone-engine/game-state"

//one black marble out and back, then one white marble out and back: four
//moves that leave the standard opening exactly where it started
const SHUFFLE: [string[], string][] = [
  [["2,0"], "1,0"],
  [["-2,0"], "-1,0"],
  [["1,0"], "2,0"],
  [["-1,0"], "-2,0"],
]

function play(state: GameState, moves: [string[], string][]): GameState {
  let current = state
  for (const [marbles, destination] of moves) {
    current = makeMove(current, marbles, destination).state
  }
  return current
}

//black two in a row on row 0 with a lone white marble on the rim ahead,
//one capture away from six
function onTheBrink(): GameState {
  return {
    ...createGameState("standard", "black", "local"),
    black: new Set(["0,2", "0,3"]),
    white: new Set(["0,4", "-4,0"]),
    blackScore: 5,
  }
}

describe("createGameState", () => {
  it("opens the standard game with black to move and one history entry", () => {
    const state = createGameState()
    expect(state.black.size).toBe(14)
    expect(state.white.size).toBe(14)
    expect(state.currentTurn).toBe("black")
    expect(state.mode).toBe("ai")
    expect(state.gameOver).toBe(false)
    expect(state.moveHistory).toHaveLength(1)
    expect(state.moveHistory[0].moveDetails).toBeUndefined()
    expect(state.currentMoveIndex).toBe(0)
  })

  it("flips the board for a player taking white", () => {
    expect(createGameState("standard", "white").shouldFlipBoard).toBe(true)
    expect(createGameState("standard", "black").shouldFlipBoard).toBe(
      false,
    )
  })

  it("falls back to the standard opening for an unknown setup", () => {
    const state = createGameState("nonsense" as SetupKey)
    expect(state.black).toEqual(createGameState().black)
  })
})

describe("reading a state", () => {
  it("knows whose marble is where and who the opponent is", () => {
    const state = createGameState()
    expect(getMarbleAt(state, "4,0")).toBe("black")
    expect(getMarbleAt(state, "-4,0")).toBe("white")
    expect(getMarbleAt(state, "0,0")).toBeNull()
    expect(getOpponent(state)).toBe("white")
  })

  it("strips a state to the bare board a search needs", () => {
    const search = toSearchState(createGameState())
    expect(search.turn).toBe("black")
    expect(search.black).toHaveLength(14)
    expect(Object.keys(search)).toEqual(["black", "white", "turn"])
  })
})

describe("isValidSelection", () => {
  it("allows only the side to move, and only the human's side against a bot", () => {
    const asWhite = createGameState("standard", "white", "ai")
    expect(isValidSelection(asWhite, "4,0")).toBe(false)
    expect(isValidSelection(asWhite, "-4,0")).toBe(false)

    const local = createGameState("standard", "white", "local")
    expect(isValidSelection(local, "4,0")).toBe(true)
    expect(isValidSelection(local, "-4,0")).toBe(false)
  })

  it("refuses empty squares and anything once the game is over", () => {
    const state = createGameState()
    expect(isValidSelection(state, "0,0")).toBe(false)
    expect(isValidSelection(resignGame(state), "4,0")).toBe(false)
  })
})

describe("makeMove", () => {
  it("plays the move, passes the turn and records it", () => {
    const before = createGameState()
    const { state, result } = makeMove(before, ["2,0"], "1,0")

    expect(result).not.toBeNull()
    expect(state.currentTurn).toBe("white")
    expect(state.black.has("1,0")).toBe(true)
    expect(state.black.has("2,0")).toBe(false)
    expect(state.moveHistory).toHaveLength(2)
    expect(state.currentMoveIndex).toBe(1)
    expect(state.moveHistory[1].moveDetails).toMatchObject({
      marbles: ["2,0"],
      destination: "1,0",
      color: "black",
      isPush: false,
    })
    expect(state.lastMove).toMatchObject({
      fromMarbles: ["2,0"],
      marbles: ["1,0"],
      direction: [-1, 0],
    })
  })

  it("leaves the state it was given untouched", () => {
    const before = createGameState()
    makeMove(before, ["2,0"], "1,0")
    expect(before.black.has("2,0")).toBe(true)
    expect(before.moveHistory).toHaveLength(1)
  })

  it("hands the same state back for a move it cannot play", () => {
    const before = createGameState()
    const { state, result } = makeMove(before, ["2,0"], "0,0")
    expect(result).toBeNull()
    expect(state).toBe(before)
  })

  it("wins the game on the sixth capture", () => {
    const { state, result } = makeMove(onTheBrink(), ["0,2", "0,3"], "0,4")
    expect(result?.isCapture).toBe(true)
    expect(state.blackScore).toBe(6)
    expect(state.gameOver).toBe(true)
    expect(state.gameOverReason).toBe("score")
    expect(state.winner).toBe("black")
    expect(state.lastMove?.shovedTo).toEqual(["0,5"])
  })

  it("discards the moves after a rewound position when play carries on", () => {
    const played = play(createGameState(), SHUFFLE.slice(0, 3))
    const rewound = goToMove(played, 1)
    const { state } = makeMove(rewound, ["-2,1"], "-1,1")
    expect(state.moveHistory).toHaveLength(3)
    expect(state.moveHistory[2].moveDetails?.destination).toBe("-1,1")
  })
})

describe("evaluateGameOver", () => {
  it("is not over at the start", () => {
    expect(evaluateGameOver(createGameState())).toEqual({
      gameOver: false,
      gameOverReason: null,
      winner: null,
    })
  })

  it("gives the game to white on six captures", () => {
    const state = { ...createGameState(), whiteScore: 6 }
    expect(evaluateGameOver(state)).toEqual({
      gameOver: true,
      gameOverReason: "score",
      winner: "white",
    })
  })

  it("draws once the same position stands a third time", () => {
    const twice = play(
      createGameState("standard", "black", "local"),
      SHUFFLE,
    )
    expect(twice.gameOver).toBe(false)

    const thrice = play(twice, SHUFFLE)
    expect(thrice.gameOver).toBe(true)
    expect(thrice.gameOverReason).toBe("threefold_repetition")
    expect(thrice.winner).toBeNull()
  })
})

describe("resignGame", () => {
  it("gives the game to the other side, the human by default", () => {
    const state = createGameState("standard", "white")
    const resigned = resignGame(state)
    expect(resigned.gameOver).toBe(true)
    expect(resigned.gameOverReason).toBe("resignation")
    expect(resigned.winner).toBe("black")
    expect(resignGame(state, "black").winner).toBe("white")
  })
})

describe("walking through history", () => {
  const played = play(createGameState(), SHUFFLE.slice(0, 2))

  it("steps back and forth between recorded positions", () => {
    expect(canPrevMove(played)).toBe(true)
    expect(canNextMove(played)).toBe(false)
    expect(isViewingHistory(played)).toBe(false)

    const back = prevMove(played)
    expect(back.currentMoveIndex).toBe(1)
    expect(back.currentTurn).toBe("white")
    expect(back.black.has("1,0")).toBe(true)
    expect(back.white.has("-1,0")).toBe(false)
    expect(back.lastMove?.marbles).toEqual(["1,0"])
    expect(isViewingHistory(back)).toBe(true)

    expect(nextMove(back).white.has("-1,0")).toBe(true)
  })

  it("stops at either end and ignores an index outside the history", () => {
    const start = goToMove(played, 0)
    expect(start.lastMove).toBeNull()
    expect(prevMove(start)).toBe(start)
    expect(nextMove(played)).toBe(played)
    expect(goToMove(played, -1)).toBe(played)
    expect(goToMove(played, 99)).toBe(played)
  })
})

describe("truncateToMove", () => {
  it("throws away everything after the index", () => {
    const played = play(createGameState(), SHUFFLE.slice(0, 3))
    const trimmed = truncateToMove(played, 1)
    expect(trimmed.moveHistory).toHaveLength(2)
    expect(trimmed.currentMoveIndex).toBe(1)
    expect(canNextMove(trimmed)).toBe(false)
  })

  it("lifts a repetition draw the take-back undoes", () => {
    const drawn = play(createGameState("standard", "black", "local"), [
      ...SHUFFLE,
      ...SHUFFLE,
    ])
    const undone = truncateToMove(drawn, drawn.moveHistory.length - 2)
    expect(undone.gameOver).toBe(false)
    expect(undone.gameOverReason).toBeNull()
  })

  it("ignores the last index and anything out of range", () => {
    const played = play(createGameState(), SHUFFLE.slice(0, 2))
    expect(truncateToMove(played, 2)).toBe(played)
    expect(truncateToMove(played, -1)).toBe(played)
  })
})

describe("undoTargetIndex", () => {
  it("takes back one move in hot-seat play", () => {
    const local = play(
      createGameState("standard", "black", "local"),
      SHUFFLE.slice(0, 2),
    )
    expect(undoTargetIndex(local)).toBe(1)
  })

  it("takes back the bot's reply with the player's move", () => {
    const ai = play(createGameState("standard", "black", "ai"), SHUFFLE)
    expect(undoTargetIndex(ai)).toBe(2)
  })

  it("has nothing to take back at the start or before the player has moved", () => {
    expect(undoTargetIndex(createGameState())).toBe(-1)
    const botOpened = play(
      createGameState("standard", "white", "ai"),
      SHUFFLE.slice(0, 1),
    )
    expect(undoTargetIndex(botOpened)).toBe(-1)
  })
})
