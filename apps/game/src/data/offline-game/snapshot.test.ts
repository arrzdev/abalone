import type { GameState } from "@repo/abalone-engine/game-state"
import {
  createGameState,
  goToMove,
  makeMove,
  resignGame,
} from "@repo/abalone-engine/game-state"
import { afterEach, describe, expect, it } from "vitest"
import {
  clearOfflineGame,
  OFFLINE_GAME_KEY,
  readOfflineGame,
  writeOfflineGame,
} from "@/data/offline-game/snapshot"

//two moves into a vs-computer game on the standard start: one black marble
//out, one white marble out
function gameTwoMovesIn(): GameState {
  let state = createGameState("standard", "black", "ai")
  state = makeMove(state, ["2,0"], "1,0").state
  state = makeMove(state, ["-2,0"], "-1,0").state
  //an illegal move hands the state back unchanged, which would leave every
  //test below checking an empty game
  if (state.moveHistory.length !== 3)
    throw new Error("setup moves refused")
  return state
}

afterEach(() => localStorage.clear())

describe("offline game snapshot", () => {
  it("reads back the game it wrote: position, history, turn, side, setup and scores", () => {
    const state = gameTwoMovesIn()
    writeOfflineGame({ state, difficulty: 3, colorChoice: "random" })

    const saved = readOfflineGame()

    expect(saved).not.toBeNull()
    expect(saved?.difficulty).toBe(3)
    expect(saved?.colorChoice).toBe("random")
    expect(saved?.state).toEqual(state)
    //the board reads its marbles as sets, so they must come back as sets
    expect(saved?.state.black).toBeInstanceOf(Set)
    expect(saved?.state.white).toBeInstanceOf(Set)
  })

  it("keeps a Pass and Play game and a rewound position", () => {
    let state = createGameState("standard", "white", "local")
    state = makeMove(state, ["2,0"], "1,0").state
    state = goToMove(state, 0)
    writeOfflineGame({ state, difficulty: 1, colorChoice: "black" })

    expect(readOfflineGame()?.state).toEqual(state)
  })

  it("does not bring back a half-made selection or a hover", () => {
    const state: GameState = {
      ...gameTwoMovesIn(),
      selectedMarbles: ["2,1"],
      hoveredCell: "1,1",
    }
    writeOfflineGame({ state, difficulty: 1, colorChoice: "black" })

    const restored = readOfflineGame()?.state
    expect(restored?.selectedMarbles).toEqual([])
    expect(restored?.hoveredCell).toBeNull()
  })

  it("never keeps a finished game", () => {
    writeOfflineGame({
      state: gameTwoMovesIn(),
      difficulty: 1,
      colorChoice: "black",
    })
    writeOfflineGame({
      state: resignGame(gameTwoMovesIn(), "black"),
      difficulty: 1,
      colorChoice: "black",
    })

    expect(readOfflineGame()).toBeNull()
    expect(localStorage.getItem(OFFLINE_GAME_KEY)).toBeNull()
  })

  it("holds one game: a new one replaces the last", () => {
    writeOfflineGame({
      state: gameTwoMovesIn(),
      difficulty: 5,
      colorChoice: "white",
    })
    const fresh = createGameState("german_daisy", "black", "local")
    writeOfflineGame({ state: fresh, difficulty: 1, colorChoice: "black" })

    expect(readOfflineGame()?.state).toEqual(fresh)
    expect(localStorage.length).toBe(1)
  })

  it("forgets the game when cleared", () => {
    writeOfflineGame({
      state: gameTwoMovesIn(),
      difficulty: 1,
      colorChoice: "black",
    })
    clearOfflineGame()

    expect(readOfflineGame()).toBeNull()
    expect(localStorage.getItem(OFFLINE_GAME_KEY)).toBeNull()
  })

  it.each([
    ["half-written JSON", '{"state":{"black":['],
    ["a different shape", JSON.stringify({ board: [1, 2, 3] })],
    [
      "a state with no marbles",
      JSON.stringify({ state: {}, difficulty: 1 }),
    ],
    ["a bare number", "42"],
  ])("treats %s as no game", (_label, raw) => {
    localStorage.setItem(OFFLINE_GAME_KEY, raw)

    expect(readOfflineGame()).toBeNull()
  })

  it("ignores a save under any other key", () => {
    localStorage.setItem(
      "abalone.offlineGame",
      JSON.stringify({ state: gameTwoMovesIn(), difficulty: 1 }),
    )

    expect(readOfflineGame()).toBeNull()
  })
})
