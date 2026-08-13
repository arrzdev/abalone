import { WINNING_SCORE } from './config.js';
import { BOARD_SETUPS, DEFAULT_SETUP } from './boardSetups.js';
import { signatureOfNames } from './position.js';
import { applyMove, directionBetween, marbleAt, shiftNames } from './rules.js';

/**
 * The game as a value.
 *
 * Every function here takes a state and hands back a new one, so React can hold
 * a state in `useState` and get a re-render for free whenever the game moves.
 * Nothing is mutated, including the arrays and sets inside a state — a snapshot
 * pulled out of `moveHistory` stays true forever.
 *
 * Squares are named, not numbered, at this level: a state is what the renderer
 * reads and what the move list is built from. `rules.js` translates.
 */

const opponentOf = (side) => (side === 'black' ? 'white' : 'black');

/** A move-history entry: the board as it stood, plus how it got there. */
function snapshot(black, white, blackScore, whiteScore, currentTurn, moveDetails) {
  return { black: [...black], white: [...white], blackScore, whiteScore, currentTurn, moveDetails };
}

/**
 * @param {string} setupType   key from BOARD_SETUPS
 * @param {'black'|'white'} playerColor  the human's colour in 'ai' mode; the
 *        side shown at the bottom to begin with in 'local' mode
 * @param {'ai'|'local'} mode  'local' is hot-seat play, both colours on one device
 */
export function createGameState(setupType = DEFAULT_SETUP, playerColor = 'black', mode = 'ai') {
  const setup = BOARD_SETUPS[setupType] || BOARD_SETUPS[DEFAULT_SETUP];
  const black = new Set(setup.black.map(([r, q]) => `${r},${q}`));
  const white = new Set(setup.white.map(([r, q]) => `${r},${q}`));

  return {
    black,
    white,
    blackScore: 0,
    whiteScore: 0,
    selectedMarbles: [],
    hoveredCell: null,
    currentTurn: 'black', // black always opens
    gameOver: false,
    gameOverReason: null,
    winner: null,
    lastMove: null,
    // The opening position is a position like any other: it gets an entry, so
    // the move list can point at it and stepping back can reach it.
    moveHistory: [snapshot(black, white, 0, 0, 'black', undefined)],
    currentMoveIndex: 0,
    playerColor,
    setupType,
    mode,
    shouldFlipBoard: playerColor === 'white',
  };
}

export const getMarbleAt = (state, pos) => marbleAt(state, pos);
export const isBlackTurn = (state) => state.currentTurn === 'black';
export const getOpponent = (state) => opponentOf(state.currentTurn);

/**
 * A player may only pick up marbles of the side to move. Against a bot that is
 * narrowed again to the human's own colour; in hot-seat play both colours are
 * pickable, each on its own turn.
 */
export function isValidSelection(state, pos) {
  if (state.gameOver) return false;

  const color = marbleAt(state, pos);
  if (color === null || color !== state.currentTurn) return false;

  return state.mode === 'local' || color === (state.playerColor || 'black');
}

export const isViewingHistory = (state) => state.currentMoveIndex < state.moveHistory.length - 1;

/* ------------------------------------------------------------------ *
 * Endings
 * ------------------------------------------------------------------ */

/** A draw once the same position, with the same side to move, has stood three times. */
function repeatedThrice(moveHistory) {
  const seen = new Map();
  for (const entry of moveHistory) {
    const key = signatureOfNames(entry.black, entry.white, entry.currentTurn);
    const count = (seen.get(key) || 0) + 1;
    if (count >= 3) return true;
    seen.set(key, count);
  }
  return false;
}

/** The game-over fields a state should be carrying, given everything in it. */
export function evaluateGameOver(state) {
  if (state.blackScore >= WINNING_SCORE || state.whiteScore >= WINNING_SCORE) {
    return {
      gameOver: true,
      gameOverReason: 'score',
      winner: state.blackScore >= WINNING_SCORE ? 'black' : 'white',
    };
  }
  if (repeatedThrice(state.moveHistory)) {
    return { gameOver: true, gameOverReason: 'threefold repetition', winner: null };
  }
  return { gameOver: false, gameOverReason: null, winner: null };
}

/** @param {'black'|'white'} [resigningColor] defaults to the human's colour */
export const resignGame = (state, resigningColor = state.playerColor) => ({
  ...state,
  gameOver: true,
  gameOverReason: 'resignation',
  winner: opponentOf(resigningColor),
});

/* ------------------------------------------------------------------ *
 * Playing a move
 * ------------------------------------------------------------------ */

/** What the board draws to show the move that has just been played. */
function describeLastMove(marbles, destination, pushed = []) {
  if (!marbles?.length || !destination) return null;

  const anchor = marbles.find((pos) => directionBetween(pos, destination));
  if (!anchor) return null;
  const direction = directionBetween(anchor, destination);

  return {
    fromMarbles: marbles,
    destination,
    marbles: shiftNames(marbles, direction),
    direction,
    shovedMarbles: pushed,
    shovedTo: shiftNames(pushed, direction),
  };
}

/**
 * Plays a move for the side to move.
 * Hands back the state untouched, and a null result, when the move is not legal.
 */
export function makeMove(state, selectedMarbles, destination) {
  const result = applyMove(state, selectedMarbles, destination, isBlackTurn(state));
  if (!result) return { state, result: null };

  const blackScore = state.blackScore + result.blackScoreDelta;
  const whiteScore = state.whiteScore + result.whiteScoreDelta;
  const currentTurn = getOpponent(state);

  const entry = snapshot(result.board.black, result.board.white, blackScore, whiteScore, currentTurn, {
    marbles: [...selectedMarbles],
    destination,
    capturedMarble: null,
    marbleCount: result.marbleCount,
    isPush: result.isPush,
    isCapture: result.isCapture,
    shovedMarbles: result.shovedMarbles,
    direction: result.direction,
    color: state.currentTurn,
  });

  // Playing on from a rewound position discards whatever came after it.
  const moveHistory = [...state.moveHistory.slice(0, state.currentMoveIndex + 1), entry];

  const played = {
    ...state,
    black: result.board.black,
    white: result.board.white,
    blackScore,
    whiteScore,
    currentTurn,
    selectedMarbles: [],
    hoveredCell: null,
    lastMove: describeLastMove([...selectedMarbles], destination, result.shovedMarbles),
    moveHistory,
    currentMoveIndex: moveHistory.length - 1,
  };

  return { state: { ...played, ...evaluateGameOver(played) }, result };
}

/* ------------------------------------------------------------------ *
 * Walking back through the game
 * ------------------------------------------------------------------ */

export const canPrevMove = (state) => state.currentMoveIndex > 0;
export const canNextMove = (state) => state.currentMoveIndex < state.moveHistory.length - 1;

/** Puts the board back to how it stood at `moveIndex`, and highlights that move. */
export function goToMove(state, moveIndex) {
  if (moveIndex < 0 || moveIndex >= state.moveHistory.length) return state;

  const entry = state.moveHistory[moveIndex];
  const played = entry.moveDetails;
  let lastMove = null;

  if (played?.marbles && played.destination) {
    const { direction, shovedMarbles = [] } = played;
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
    };
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
  };
}

export const prevMove = (state) => (canPrevMove(state) ? goToMove(state, state.currentMoveIndex - 1) : state);
export const nextMove = (state) => (canNextMove(state) ? goToMove(state, state.currentMoveIndex + 1) : state);

/**
 * Rewinds to `moveIndex` and throws away everything after it — a move taken
 * back, as against `goToMove`, which only looks. Play carries on from there, so
 * the ending is worked out again: the repetition that finished the game may be
 * gone with the moves that caused it.
 */
export function truncateToMove(state, moveIndex) {
  if (moveIndex < 0 || moveIndex >= state.moveHistory.length - 1) return state;

  const rewound = goToMove(state, moveIndex);
  const trimmed = {
    ...rewound,
    moveHistory: rewound.moveHistory.slice(0, moveIndex + 1),
    currentMoveIndex: moveIndex,
  };

  return { ...trimmed, ...evaluateGameOver(trimmed) };
}

/**
 * Where a take-back lands: the position before, in hot-seat play, and the one
 * before the player's own last move against a bot, so the bot's reply is taken
 * back with it. -1 when there is nothing of the player's own to take back.
 */
export function undoTargetIndex(state) {
  const last = state.moveHistory.length - 1;
  if (last < 1) return -1;
  if (state.mode === 'local') return last - 1;

  const playerColor = state.playerColor || 'black';
  for (let i = last - 1; i >= 0; i--) {
    if (state.moveHistory[i].currentTurn === playerColor) return i;
  }
  return -1;
}

/** The bare board the search needs — no history, no selection, no view state. */
export const toSearchState = (state) => ({
  black: [...state.black],
  white: [...state.white],
  turn: state.currentTurn,
});
