import type { SetupKey } from "@repo/abalone-engine/board-setups"
import type { GameOverReason } from "@repo/abalone-engine/game-state"
import type {
  AxialStep,
  CellName,
  Player,
} from "@repo/abalone-engine/types"
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"
import { user } from "@/database/auth.schema"

//---- profiles ----------------
//our half of a player, mirrored from better-auth's `user` by a create hook
//(auth.service.ts). the split is the rule from `stack-auth`: better-auth owns
//its own tables and we never bolt app columns onto them, so anything the app
//itself lets a player change lives here.
//
//today that is exactly one field. the username is deliberately NOT here — it is
//permanent, and the username plugin owns its uniqueness, normalisation, and the
//sign-in path, so it stays on better-auth's `user` where the plugin can see it.

export const profiles = sqliteTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  //the R2 object key, null until they upload one. content-addressed, so it
  //doubles as the cache key — see profile.service.ts.
  avatarKey: text("avatar_key"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

//---- online play ----------------
//three tables and one rule: the server owns the position. a client sends which
//marbles are moving and where to, and nothing else — every cell, score, turn and
//ending below is worked out here by @repo/abalone-engine, which is why the
//engine is a package rather than something the game app keeps to itself.
//
//stored values are codes, never sentences: they are read back by a client that
//translates them into whatever language that player is reading in.

/** Which side the inviter wants. `random` is settled when the game opens. */
export type InviteSide = Player | "random"

export type InviteStatus = "pending" | "declined"

export type GameStatus = "active" | "finished"

//---- invites ----------------
//only ever a live invite or one that was turned down. accepting removes the row,
//because what it becomes is a game; the sender deletes their own row to take an
//invite back, or to clear a decline once they have read it.

export const invites = sqliteTable(
  "invites",
  {
    id: text("id").primaryKey(),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    setupType: text("setup_type").notNull().$type<SetupKey>(),
    side: text("side").notNull().$type<InviteSide>(),
    status: text("status").notNull().$type<InviteStatus>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    //one live invite per direction, so a sender cannot flood one inbox
    uniqueIndex("invites_pair_idx").on(table.fromUserId, table.toUserId),
    index("invites_to_idx").on(table.toUserId, table.status),
  ],
)

//---- games ----------------
//the live position, so playing a move is one read rather than a replay of the
//whole game. `game_moves` is the record; this row is where the game stands.

export const games = sqliteTable(
  "games",
  {
    id: text("id").primaryKey(),
    //the invite it came from, and the reason two taps on accept cannot open two
    //games: the second insert loses to this index instead of to a check that
    //read the invite a moment before the first one deleted it. no foreign key —
    //the invite is gone by the time this row exists.
    inviteId: text("invite_id").notNull().unique(),
    blackUserId: text("black_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    whiteUserId: text("white_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    setupType: text("setup_type").notNull().$type<SetupKey>(),
    status: text("status").notNull().$type<GameStatus>(),
    blackCells: text("black_cells", { mode: "json" })
      .notNull()
      .$type<CellName[]>(),
    whiteCells: text("white_cells", { mode: "json" })
      .notNull()
      .$type<CellName[]>(),
    //what each side has pushed off, which is that side's own score
    blackScore: integer("black_score").notNull(),
    whiteScore: integer("white_score").notNull(),
    currentTurn: text("current_turn").notNull().$type<Player>(),
    //plies played, and the version a move is checked against
    moveCount: integer("move_count").notNull(),
    //null on a finished game means a draw
    winner: text("winner").$type<Player>(),
    finishReason: text("finish_reason").$type<GameOverReason>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    //a player's own list, which is the only way games are ever read in bulk
    index("games_black_idx").on(table.blackUserId, table.status),
    index("games_white_idx").on(table.whiteUserId, table.status),
  ],
)

//---- game moves ----------------
//one row per ply, INCLUDING ply 0: the opening position is a position like any
//other, and giving it a row makes this table a 1:1 image of the engine's
//`HistoryEntry[]`. a client rebuilds a reviewable game straight from a select,
//and the repetition count below has the opening to count.

export const gameMoves = sqliteTable(
  "game_moves",
  {
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    //0 is the opening. the composite key is also what stops two requests that
    //both passed the move_count check from both landing.
    moveIndex: integer("move_index").notNull(),
    //the move that reached this position — all null at ply 0
    marbles: text("marbles", { mode: "json" }).$type<CellName[]>(),
    destination: text("destination"),
    isPush: integer("is_push", { mode: "boolean" }),
    isCapture: integer("is_capture", { mode: "boolean" }),
    shovedMarbles: text("shoved_marbles", {
      mode: "json",
    }).$type<CellName[]>(),
    direction: text("direction", { mode: "json" }).$type<AxialStep>(),
    //the position this ply reached, and who is to move in it. the mover is the
    //other side, derived rather than stored so the two can never disagree.
    blackCells: text("black_cells", { mode: "json" })
      .notNull()
      .$type<CellName[]>(),
    whiteCells: text("white_cells", { mode: "json" })
      .notNull()
      .$type<CellName[]>(),
    blackScore: integer("black_score").notNull(),
    whiteScore: integer("white_score").notNull(),
    currentTurn: text("current_turn").notNull().$type<Player>(),
    //`signatureOfNames` over the three above. threefold repetition is then a
    //count of matching rows rather than a read of the entire game.
    signature: text("signature").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.moveIndex] }),
    index("game_moves_signature_idx").on(table.gameId, table.signature),
  ],
)
