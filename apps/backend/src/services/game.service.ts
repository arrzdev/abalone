import type { SetupKey } from "@repo/abalone-engine/board-setups"
import { BOARD_SETUPS } from "@repo/abalone-engine/board-setups"
import { WINNING_SCORE } from "@repo/abalone-engine/config"
import type { GameOverReason } from "@repo/abalone-engine/game-state"
import { signatureOfNames } from "@repo/abalone-engine/position"
import { applyMove, getPossibleMoves } from "@repo/abalone-engine/rules"
import type {
  AxialStep,
  CellName,
  Player,
} from "@repo/abalone-engine/types"
import tryCatch from "@repo/shared/try-catch"
import { and, count, desc, eq, or } from "drizzle-orm"
import { alias } from "drizzle-orm/sqlite-core"
import { user } from "@/database/auth.schema"
import type { Db } from "@/database/client"
import type { GameStatus, InviteSide } from "@/database/schema"
import { gameMoves, games, profiles } from "@/database/schema"
import { CustomError } from "@/http/errors"
import type { PlayerSummary } from "@/utils/player-summary"
import { toPlayerSummary } from "@/utils/player-summary"

/** Where a game stands, and who is playing it. */
export type Game = {
  id: string
  status: GameStatus
  setupType: SetupKey
  black: PlayerSummary
  white: PlayerSummary
  blackCells: CellName[]
  whiteCells: CellName[]
  blackScore: number
  whiteScore: number
  currentTurn: Player
  /** Plies played. Also the version a move is checked against. */
  moveCount: number
  /** Null on a finished game means a draw. */
  winner: Player | null
  finishReason: GameOverReason | null
  createdAt: number
  updatedAt: number
}

/**
 * One ply, and the position it reached.
 *
 * Ply 0 is the opening: a position nobody moved into, so everything describing a
 * move is null there. The shape is the engine's `HistoryEntry` plus the details
 * its move list prints, which is what lets a client rebuild a reviewable game
 * from a plain select.
 */
export type GameMove = {
  moveIndex: number
  marbles: CellName[] | null
  destination: CellName | null
  isPush: boolean
  isCapture: boolean
  shovedMarbles: CellName[]
  direction: AxialStep | null
  blackCells: CellName[]
  whiteCells: CellName[]
  blackScore: number
  whiteScore: number
  currentTurn: Player
}

/** The terms of an accepted invite: everything opening a game needs. */
export type AgreedTerms = {
  inviteId: string
  fromUserId: string
  toUserId: string
  side: InviteSide
  setupType: SetupKey
}

const black = alias(user, "black_player")
const blackProfile = alias(profiles, "black_profile")
const white = alias(user, "white_player")
const whiteProfile = alias(profiles, "white_profile")

const GAME_COLUMNS = {
  id: games.id,
  status: games.status,
  setupType: games.setupType,
  blackCells: games.blackCells,
  whiteCells: games.whiteCells,
  blackScore: games.blackScore,
  whiteScore: games.whiteScore,
  currentTurn: games.currentTurn,
  moveCount: games.moveCount,
  winner: games.winner,
  finishReason: games.finishReason,
  createdAt: games.createdAt,
  updatedAt: games.updatedAt,
  blackUserId: black.id,
  blackUsername: black.username,
  blackDisplayUsername: black.displayUsername,
  blackAvatarKey: blackProfile.avatarKey,
  whiteUserId: white.id,
  whiteUsername: white.username,
  whiteDisplayUsername: white.displayUsername,
  whiteAvatarKey: whiteProfile.avatarKey,
}

type GameRow = {
  id: string
  status: GameStatus
  setupType: SetupKey
  blackCells: CellName[]
  whiteCells: CellName[]
  blackScore: number
  whiteScore: number
  currentTurn: Player
  moveCount: number
  winner: Player | null
  finishReason: GameOverReason | null
  createdAt: Date
  updatedAt: Date
  blackUserId: string
  blackUsername: string | null
  blackDisplayUsername: string | null
  blackAvatarKey: string | null
  whiteUserId: string
  whiteUsername: string | null
  whiteDisplayUsername: string | null
  whiteAvatarKey: string | null
}

function toGame(row: GameRow): Game {
  return {
    id: row.id,
    status: row.status,
    setupType: row.setupType,
    blackCells: row.blackCells,
    whiteCells: row.whiteCells,
    blackScore: row.blackScore,
    whiteScore: row.whiteScore,
    currentTurn: row.currentTurn,
    moveCount: row.moveCount,
    winner: row.winner,
    finishReason: row.finishReason,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    black: toPlayerSummary({
      userId: row.blackUserId,
      username: row.blackUsername,
      displayUsername: row.blackDisplayUsername,
      avatarKey: row.blackAvatarKey,
    }),
    white: toPlayerSummary({
      userId: row.whiteUserId,
      username: row.whiteUsername,
      displayUsername: row.whiteDisplayUsername,
      avatarKey: row.whiteAvatarKey,
    }),
  }
}

const opponentOf = (side: Player): Player =>
  side === "black" ? "white" : "black"

/** The opening position for a setup, as named squares. */
function openingCells(setupType: SetupKey) {
  const setup = BOARD_SETUPS[setupType]
  return {
    black: setup.black.map(([r, q]) => `${r},${q}`),
    white: setup.white.map(([r, q]) => `${r},${q}`),
  }
}

/** Which seat a player holds, or null when they hold neither. */
function seatOf(row: GameRow, userId: string): Player | null {
  if (row.blackUserId === userId) return "black"
  if (row.whiteUserId === userId) return "white"
  return null
}

//---- service ----------------

export class GameService {
  constructor(private db: Db) {}

  /** Every game a player is in, newest first. */
  async listForUser(userId: string, status: GameStatus): Promise<Game[]> {
    const [rows, readError] = await tryCatch(() =>
      this.selectGames()
        .where(and(this.played(userId), eq(games.status, status)))
        .orderBy(desc(games.updatedAt)),
    )
    if (readError)
      throw new CustomError("internal_server_error", readError)

    return rows.map(toGame)
  }

  /** Where one of a player's games stands. */
  async get(gameId: string, userId: string): Promise<Game> {
    return toGame(await this.findMine(gameId, userId))
  }

  /**
   * Every ply of one of a player's games, the opening included.
   *
   * The game is read first, and only by someone in it, so this never takes a
   * game id on its own — the plies are only reachable through a game the caller
   * is already allowed to see.
   */
  async listMoves(gameId: string, userId: string): Promise<GameMove[]> {
    const game = await this.findMine(gameId, userId)

    const [rows, readError] = await tryCatch(() =>
      this.db
        .select()
        .from(gameMoves)
        .where(eq(gameMoves.gameId, game.id))
        .orderBy(gameMoves.moveIndex),
    )
    if (readError)
      throw new CustomError("internal_server_error", readError)

    return rows.map((row) => ({
      moveIndex: row.moveIndex,
      marbles: row.marbles,
      destination: row.destination,
      isPush: row.isPush ?? false,
      isCapture: row.isCapture ?? false,
      shovedMarbles: row.shovedMarbles ?? [],
      direction: row.direction,
      blackCells: row.blackCells,
      whiteCells: row.whiteCells,
      blackScore: row.blackScore,
      whiteScore: row.whiteScore,
      currentTurn: row.currentTurn,
    }))
  }

  /**
   * Opens a game on the terms an accepted invite settled.
   *
   * The opening position is written as ply 0. It is a position like any other,
   * and giving it a row is what makes the move log a complete record: a review
   * can reach the start, and the repetition count has it to count.
   *
   * Opening the same invite twice hands back the game that already exists
   * rather than a second one. `invite_id` is unique, so the duplicate loses to
   * the index and lands in the fallback below — which is what lets accepting be
   * retried safely after a half-finished attempt.
   */
  async open(terms: AgreedTerms): Promise<string> {
    const gameId = crypto.randomUUID()
    const now = new Date()
    const cells = openingCells(terms.setupType)
    const seats = this.seatsFor(terms)

    const [, writeError] = await tryCatch(() =>
      this.db.batch([
        this.db.insert(games).values({
          id: gameId,
          inviteId: terms.inviteId,
          blackUserId: seats.blackUserId,
          whiteUserId: seats.whiteUserId,
          setupType: terms.setupType,
          status: "active",
          blackCells: cells.black,
          whiteCells: cells.white,
          blackScore: 0,
          whiteScore: 0,
          //black always opens
          currentTurn: "black",
          moveCount: 0,
          winner: null,
          finishReason: null,
          createdAt: now,
          updatedAt: now,
        }),
        this.db.insert(gameMoves).values({
          gameId,
          moveIndex: 0,
          marbles: null,
          destination: null,
          isPush: null,
          isCapture: null,
          shovedMarbles: null,
          direction: null,
          blackCells: cells.black,
          whiteCells: cells.white,
          blackScore: 0,
          whiteScore: 0,
          currentTurn: "black",
          signature: signatureOfNames(cells.black, cells.white, "black"),
          createdAt: now,
        }),
      ]),
    )
    if (!writeError) return gameId

    const existing = await this.findIdByInvite(terms.inviteId)
    if (!existing)
      throw new CustomError("internal_server_error", writeError)

    return existing
  }

  /**
   * Plays a move, if it is that player's to play and the rules allow it.
   *
   * The request carries which marbles are moving and where to, and nothing
   * else. Every cell, score, turn and ending below is worked out here from the
   * stored position, so there is no field a crafted request could use to assert
   * a board it likes better.
   */
  async playMove(
    gameId: string,
    userId: string,
    marbles: CellName[],
    destination: CellName,
    moveIndex: number,
  ): Promise<Game> {
    const row = await this.findMine(gameId, userId)
    if (row.status !== "active") throw new CustomError("game_not_active")

    const seat = seatOf(row, userId)
    if (seat !== row.currentTurn) throw new CustomError("not_your_turn")
    //the client says which position it was looking at. a mismatch means the
    //game moved on while they were deciding, and the move they aimed at that
    //board is not the move it would be on this one.
    if (moveIndex !== row.moveCount) throw new CustomError("move_conflict")

    const board = {
      black: new Set(row.blackCells),
      white: new Set(row.whiteCells),
    }
    const isBlackTurn = row.currentTurn === "black"

    //`applyMove` plays what it is handed. On a device that is enough, because
    //the only way to hand it anything is to pick marbles up off the board. Over
    //http it is not: a body naming an empty square would have it step a marble
    //out of nowhere, and one naming scattered squares would walk a marble
    //across the board to join them. So the move has to be one this position
    //actually offers, made with marbles that are actually theirs, before it is
    //played at all.
    const own = isBlackTurn ? board.black : board.white
    const legal =
      new Set(marbles).size === marbles.length &&
      marbles.every((cell) => own.has(cell)) &&
      getPossibleMoves(board, marbles, isBlackTurn).includes(destination)
    if (!legal) throw new CustomError("illegal_move")

    const outcome = applyMove(board, marbles, destination, isBlackTurn)
    if (!outcome) throw new CustomError("illegal_move")

    const blackCells = [...outcome.board.black]
    const whiteCells = [...outcome.board.white]
    const blackScore = row.blackScore + outcome.blackScoreDelta
    const whiteScore = row.whiteScore + outcome.whiteScoreDelta
    const currentTurn = opponentOf(row.currentTurn)
    const signature = signatureOfNames(blackCells, whiteCells, currentTurn)

    const ending = await this.endingFor(
      gameId,
      blackScore,
      whiteScore,
      signature,
    )

    const nextIndex = row.moveCount + 1
    const now = new Date()

    const [, writeError] = await tryCatch(() =>
      this.db.batch([
        this.db.insert(gameMoves).values({
          gameId,
          moveIndex: nextIndex,
          marbles,
          destination,
          isPush: outcome.isPush,
          isCapture: outcome.isCapture,
          shovedMarbles: outcome.shovedMarbles,
          direction: outcome.direction,
          blackCells,
          whiteCells,
          blackScore,
          whiteScore,
          currentTurn,
          signature,
          createdAt: now,
        }),
        this.db
          .update(games)
          .set({
            blackCells,
            whiteCells,
            blackScore,
            whiteScore,
            currentTurn,
            moveCount: nextIndex,
            status: ending.status,
            winner: ending.winner,
            finishReason: ending.finishReason,
            updatedAt: now,
          })
          .where(eq(games.id, gameId)),
      ]),
    )
    //the ply's composite key is the backstop: two requests that both passed the
    //move_count check above cannot both land, and the loser arrives here
    if (writeError) throw new CustomError("move_conflict", writeError)

    return this.get(gameId, userId)
  }

  /** Gives the game up, handing the win to the other seat. */
  async resign(gameId: string, userId: string): Promise<Game> {
    const row = await this.findMine(gameId, userId)
    if (row.status !== "active") throw new CustomError("game_not_active")

    const seat = seatOf(row, userId)
    if (!seat) throw new CustomError("not_found")

    const [, writeError] = await tryCatch(() =>
      this.db
        .update(games)
        .set({
          status: "finished",
          winner: opponentOf(seat),
          finishReason: "resignation",
          updatedAt: new Date(),
        })
        .where(and(eq(games.id, gameId), eq(games.status, "active"))),
    )
    if (writeError)
      throw new CustomError("internal_server_error", writeError)

    return this.get(gameId, userId)
  }

  //---- endings ----------------

  /**
   * What the move just played does to the game.
   *
   * Six marbles pushed off wins it. A position that has now stood three times,
   * with the same side to move, draws it — counted from the stored signatures
   * rather than by reading the game back, which is what the column is for.
   */
  private async endingFor(
    gameId: string,
    blackScore: number,
    whiteScore: number,
    signature: string,
  ): Promise<{
    status: GameStatus
    winner: Player | null
    finishReason: GameOverReason | null
  }> {
    if (blackScore >= WINNING_SCORE || whiteScore >= WINNING_SCORE) {
      return {
        status: "finished",
        winner: blackScore >= WINNING_SCORE ? "black" : "white",
        finishReason: "score",
      }
    }

    const [seen, countError] = await tryCatch(() =>
      this.db
        .select({ total: count() })
        .from(gameMoves)
        .where(
          and(
            eq(gameMoves.gameId, gameId),
            eq(gameMoves.signature, signature),
          ),
        )
        .get(),
    )
    if (countError)
      throw new CustomError("internal_server_error", countError)

    //the two already stored plus the one about to be, which is three
    if ((seen?.total ?? 0) >= 2) {
      return {
        status: "finished",
        winner: null,
        finishReason: "threefold_repetition",
      }
    }

    return { status: "active", winner: null, finishReason: null }
  }

  //---- seats ----------------

  /**
   * Which end of the board each player takes.
   *
   * The invite names the side its sender wants, so the recipient gets the other
   * one. `random` is only spent here, at the moment a game actually opens: an
   * invite that was never accepted never flipped a coin.
   */
  private seatsFor(terms: AgreedTerms): {
    blackUserId: string
    whiteUserId: string
  } {
    const inviterIsBlack =
      terms.side === "random"
        ? Math.random() < 0.5
        : terms.side === "black"

    return inviterIsBlack
      ? { blackUserId: terms.fromUserId, whiteUserId: terms.toUserId }
      : { blackUserId: terms.toUserId, whiteUserId: terms.fromUserId }
  }

  //---- reads ----------------

  private async findIdByInvite(inviteId: string): Promise<string | null> {
    const [row, readError] = await tryCatch(() =>
      this.db
        .select({ id: games.id })
        .from(games)
        .where(eq(games.inviteId, inviteId))
        .get(),
    )
    if (readError)
      throw new CustomError("internal_server_error", readError)

    return row?.id ?? null
  }

  private async findMine(
    gameId: string,
    userId: string,
  ): Promise<GameRow> {
    const [row, readError] = await tryCatch(() =>
      this.selectGames()
        .where(and(eq(games.id, gameId), this.played(userId)))
        .get(),
    )
    if (readError)
      throw new CustomError("internal_server_error", readError)
    //a game somebody else is playing answers the same as one that never
    //existed. saying "forbidden" would confirm the id is real.
    if (!row) throw new CustomError("not_found")

    return row
  }

  //every read of a game carries this. scoping in the query rather than checking
  //the row afterwards is what makes it impossible to forget.
  private played(userId: string) {
    return or(eq(games.blackUserId, userId), eq(games.whiteUserId, userId))
  }

  private selectGames() {
    return this.db
      .select(GAME_COLUMNS)
      .from(games)
      .innerJoin(black, eq(black.id, games.blackUserId))
      .leftJoin(blackProfile, eq(blackProfile.userId, black.id))
      .innerJoin(white, eq(white.id, games.whiteUserId))
      .leftJoin(whiteProfile, eq(whiteProfile.userId, white.id))
  }
}
