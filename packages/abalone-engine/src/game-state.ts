import type { SetupKey } from "#abalone-engine/board-setups"
import { BOARD_SETUPS, DEFAULT_SETUP } from "#abalone-engine/board-setups"
import { WINNING_SCORE } from "#abalone-engine/config"
import { signatureOfNames } from "#abalone-engine/position"
import type { MoveOutcome } from "#abalone-engine/rules"
import {
  applyMove,
  directionBetween,
  marbleAt,
  shiftNames,
} from "#abalone-engine/rules"
import type {
  AxialStep,
  CellName,
  Player,
  SearchBoard,
} from "#abalone-engine/types"

/**
 * The game as a value.
 *
 * Every function here takes a state and hands back a new one, so React can hold
 * a state in `useState` and get a re-render for free whenever the game moves.
 * Nothing is mutated, including the arrays and sets inside a state — a snapshot
 * pulled out of `moveHistory` stays true forever.
 *
 * Squares are named, not numbered, at this level: a state is what the renderer
 * reads and what the move list is built from. `rules.ts` translates.
 */

/** A bot on the other side, one device between two people, or the network. */
export type GameMode = "ai" | "local" | "online"

//codes, not sentences: an ending is written into a database column and read back
//by a client that maps it to whatever language that player is reading in.
export type GameOverReason =
  | "score"
  | "threefold_repetition"
  | "resignation"

/** How a position was reached, kept so the move list can describe it. */
export type MoveDetails = {
  marbles: CellName[]
  destination: CellName
  capturedMarble: null
  marbleCount: number
  isPush: boolean
  isCapture: boolean
  shovedMarbles: CellName[]
  direction: AxialStep
  color: Player
}

/** The board as it stood, plus how it got there. */
export type HistoryEntry = {
  black: CellName[]
  white: CellName[]
  blackScore: number
  whiteScore: number
  currentTurn: Player
  moveDetails: MoveDetails | undefined
}

/** What the board draws to show the move it is standing on. */
export type LastMove = {
  fromMarbles: CellName[]
  destination: CellName
  marbles: CellName[]
  direction: AxialStep
  shovedMarbles: CellName[]
  shovedTo: CellName[]
}

/** The game-over fields a state should be carrying. */
export type GameOutcome = {
  gameOver: boolean
  gameOverReason: GameOverReason | null
  winner: Player | null
}

export type GameState = {
  black: Set<CellName>
  white: Set<CellName>
  blackScore: number
  whiteScore: number
  selectedMarbles: CellName[]
  hoveredCell: CellName | null
  currentTurn: Player
  gameOver: boolean
  gameOverReason: GameOverReason | null
  winner: Player | null
  lastMove: LastMove | null
  moveHistory: HistoryEntry[]
  currentMoveIndex: number
  playerColor: Player
  setupType: SetupKey
  mode: GameMode
  shouldFlipBoard: boolean
}

const opponentOf = (side: Player): Player =>
  side === "black" ? "white" : "black"

/** A move-history entry: the board as it stood, plus how it got there. */
function snapshot(
  black: Iterable<CellName>,
  white: Iterable<CellName>,
  blackScore: number,
  whiteScore: number,
  currentTurn: Player,
  moveDetails: MoveDetails | undefined,
): HistoryEntry {
  return {
    black: [...black],
    white: [...white],
    blackScore,
    whiteScore,
    currentTurn,
    moveDetails,
  }
}

/**
 * @param setupType   key from BOARD_SETUPS
 * @param playerColor the human's colour in 'ai' mode; the side shown at the
 *        bottom to begin with in 'local' mode
 * @param mode        'local' is hot-seat play, both colours on one device
 */
export function createGameState(
  setupType: SetupKey = DEFAULT_SETUP,
  playerColor: Player = "black",
  mode: GameMode = "ai",
): GameState {
  const setup = BOARD_SETUPS[setupType] || BOARD_SETUPS[DEFAULT_SETUP]
  const black = new Set(setup.black.map(([r, q]) => `${r},${q}`))
  const white = new Set(setup.white.map(([r, q]) => `${r},${q}`))

  return {
    black,
    white,
    blackScore: 0,
    whiteScore: 0,
    selectedMarbles: [],
    hoveredCell: null,
    currentTurn: "black", // black always opens
    gameOver: false,
    gameOverReason: null,
    winner: null,
    lastMove: null,
    // The opening position is a position like any other: it gets an entry, so
    // the move list can point at it and stepping back can reach it.
    moveHistory: [snapshot(black, white, 0, 0, "black", undefined)],
    currentMoveIndex: 0,
    playerColor,
    setupType,
    mode,
    shouldFlipBoard: playerColor === "white",
  }
}

export const getMarbleAt = (state: GameState, pos: CellName) =>
  marbleAt(state, pos)
export const isBlackTurn = (state: GameState) =>
  state.currentTurn === "black"
export const getOpponent = (state: GameState) =>
  opponentOf(state.currentTurn)

/**
 * A player may only pick up marbles of the side to move. Against a bot that is
 * narrowed again to the human's own colour; in hot-seat play both colours are
 * pickable, each on its own turn.
 */
export function isValidSelection(
  state: GameState,
  pos: CellName,
): boolean {
  if (state.gameOver) return false

  const color = marbleAt(state, pos)
  if (color === null || color !== state.currentTurn) return false

  return state.mode === "local" || color === (state.playerColor || "black")
}

export const isViewingHistory = (state: GameState) =>
  state.currentMoveIndex < state.moveHistory.length - 1

//---- endings --------------------------------------------------------

/** A draw once the same position, with the same side to move, has stood three times. */
function repeatedThrice(moveHistory: HistoryEntry[]): boolean {
  const seen = new Map<string, number>()
  for (const entry of moveHistory) {
    const key = signatureOfNames(
      entry.black,
      entry.white,
      entry.currentTurn,
    )
    const count = (seen.get(key) || 0) + 1
    if (count >= 3) return true
    seen.set(key, count)
  }
  return false
}

/** The game-over fields a state should be carrying, given everything in it. */
export function evaluateGameOver(state: GameState): GameOutcome {
  if (
    state.blackScore >= WINNING_SCORE ||
    state.whiteScore >= WINNING_SCORE
  ) {
    return {
      gameOver: true,
      gameOverReason: "score",
      winner: state.blackScore >= WINNING_SCORE ? "black" : "white",
    }
  }
  if (repeatedThrice(state.moveHistory)) {
    return {
      gameOver: true,
      gameOverReason: "threefold_repetition",
      winner: null,
    }
  }
  return { gameOver: false, gameOverReason: null, winner: null }
}

/** @param resigningColor defaults to the human's colour */
export const resignGame = (
  state: GameState,
  resigningColor: Player = state.playerColor,
): GameState => ({
  ...state,
  gameOver: true,
  gameOverReason: "resignation",
  winner: opponentOf(resigningColor),
})

//---- playing a move -------------------------------------------------

/** What the board draws to show the move that has just been played. */
function describeLastMove(
  marbles: CellName[],
  destination: CellName,
  pushed: CellName[] = [],
): LastMove | null {
  if (!marbles.length || !destination) return null

  const anchor = marbles.find((pos) => directionBetween(pos, destination))
  if (!anchor) return null
  const direction = directionBetween(anchor, destination)
  if (!direction) return null

  return {
    fromMarbles: marbles,
    destination,
    marbles: shiftNames(marbles, direction),
    direction,
    shovedMarbles: pushed,
    shovedTo: shiftNames(pushed, direction),
  }
}

/**
 * Plays a move for the side to move.
 * Hands back the state untouched, and a null result, when the move is not legal.
 */
export function makeMove(
  state: GameState,
  selectedMarbles: CellName[],
  destination: CellName,
): { state: GameState; result: MoveOutcome | null } {
  const result = applyMove(
    state,
    selectedMarbles,
    destination,
    isBlackTurn(state),
  )
  if (!result) return { state, result: null }

  const blackScore = state.blackScore + result.blackScoreDelta
  const whiteScore = state.whiteScore + result.whiteScoreDelta
  const currentTurn = getOpponent(state)

  const entry = snapshot(
    result.board.black,
    result.board.white,
    blackScore,
    whiteScore,
    currentTurn,
    {
      marbles: [...selectedMarbles],
      destination,
      capturedMarble: null,
      marbleCount: result.marbleCount,
      isPush: result.isPush,
      isCapture: result.isCapture,
      shovedMarbles: result.shovedMarbles,
      direction: result.direction,
      color: state.currentTurn,
    },
  )

  // Playing on from a rewound position discards whatever came after it.
  const moveHistory = [
    ...state.moveHistory.slice(0, state.currentMoveIndex + 1),
    entry,
  ]

  const played: GameState = {
    ...state,
    black: result.board.black,
    white: result.board.white,
    blackScore,
    whiteScore,
    currentTurn,
    selectedMarbles: [],
    hoveredCell: null,
    lastMove: describeLastMove(
      [...selectedMarbles],
      destination,
      result.shovedMarbles,
    ),
    moveHistory,
    currentMoveIndex: moveHistory.length - 1,
  }

  return { state: { ...played, ...evaluateGameOver(played) }, result }
}

//---- walking back through the game ----------------------------------

export const canPrevMove = (state: GameState) => state.currentMoveIndex > 0
export const canNextMove = (state: GameState) =>
  state.currentMoveIndex < state.moveHistory.length - 1

/** Puts the board back to how it stood at `moveIndex`, and highlights that move. */
export function goToMove(state: GameState, moveIndex: number): GameState {
  if (moveIndex < 0 || moveIndex >= state.moveHistory.length) return state

  const entry = state.moveHistory[moveIndex]
  const played = entry.moveDetails
  let lastMove: LastMove | null = null

  if (played?.marbles && played.destination) {
    const { direction, shovedMarbles = [] } = played
    lastMove = {
      marbles: played.marbles,
      fromMarbles: played.marbles,
      destination: played.destination,
      direction,
      shovedMarbles,
      shovedTo:
        direction && shovedMarbles.length
          ? shiftNames(shovedMarbles, direction)
          : [],
    }
  }

  return {
    ...state,
    black: new Set(entry.black),
    white: new Set(entry.white),
    blackScore: entry.blackScore,
    whiteScore: entry.whiteScore,
    currentTurn: entry.currentTurn,
    selectedMarbles: [],
    hoveredCell: null,
    currentMoveIndex: moveIndex,
    lastMove,
  }
}

export const prevMove = (state: GameState) =>
  canPrevMove(state) ? goToMove(state, state.currentMoveIndex - 1) : state
export const nextMove = (state: GameState) =>
  canNextMove(state) ? goToMove(state, state.currentMoveIndex + 1) : state

/**
 * Rewinds to `moveIndex` and throws away everything after it — a move taken
 * back, as against `goToMove`, which only looks. Play carries on from there, so
 * the ending is worked out again: the repetition that finished the game may be
 * gone with the moves that caused it.
 */
export function truncateToMove(
  state: GameState,
  moveIndex: number,
): GameState {
  if (moveIndex < 0 || moveIndex >= state.moveHistory.length - 1) {
    return state
  }

  const rewound = goToMove(state, moveIndex)
  const trimmed: GameState = {
    ...rewound,
    moveHistory: rewound.moveHistory.slice(0, moveIndex + 1),
    currentMoveIndex: moveIndex,
  }

  return { ...trimmed, ...evaluateGameOver(trimmed) }
}

/**
 * Where a take-back lands: the position before, in hot-seat play, and the one
 * before the player's own last move against a bot, so the bot's reply is taken
 * back with it. -1 when there is nothing of the player's own to take back.
 */
export function undoTargetIndex(state: GameState): number {
  const last = state.moveHistory.length - 1
  if (last < 1) return -1
  if (state.mode === "local") return last - 1

  const playerColor = state.playerColor || "black"
  for (let i = last - 1; i >= 0; i--) {
    if (state.moveHistory[i].currentTurn === playerColor) return i
  }
  return -1
}

/** The bare board the search needs — no history, no selection, no view state. */
export const toSearchState = (state: GameState): SearchBoard => ({
  black: [...state.black],
  white: [...state.white],
  turn: state.currentTurn,
})
