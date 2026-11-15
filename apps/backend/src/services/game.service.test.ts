import { env } from "cloudflare:workers"
import { getPossibleMoves } from "@repo/abalone-engine/rules"
import type { CellName, Player } from "@repo/abalone-engine/types"
import { eq } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { user } from "@/database/auth.schema"
import { getDb } from "@/database/client"
import { games as gameRows } from "@/database/schema"
import { envRegistry } from "@/env/registry"
import type { Game } from "@/services/game.service"
import { GameService } from "@/services/game.service"
import { failingD1 } from "@/test-support/failing-bindings"

/**
 * Threefold repetition, driven at the service.
 *
 * A draw needs the same position to stand three times with the same side to
 * move, which is eight plies of two marbles stepping out and back. Over http
 * that is eight round trips and two signed-in accounts to arrange; here it is a
 * loop, and what is under test — the signature count — is the same either way.
 */
describe("game service", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  const db = getDb(env.DB)
  const games = new GameService(db)

  let seats = 0
  async function seatedPlayer(): Promise<string> {
    seats += 1
    const id = crypto.randomUUID()
    const handle = `player${seats}`
    const now = new Date()
    await db.insert(user).values({
      id,
      name: handle,
      email: `${handle}@service.abalone.invalid`,
      username: handle,
      displayUsername: handle,
      createdAt: now,
      updatedAt: now,
    })
    return id
  }

  /** A marble with somewhere to step, and the square it steps onto. */
  function loneStep(
    game: Game,
    side: Player,
    avoid: CellName[] = [],
  ): [CellName, CellName] {
    const board = {
      black: new Set(game.blackCells),
      white: new Set(game.whiteCells),
    }
    const own = side === "black" ? game.blackCells : game.whiteCells

    for (const cell of own) {
      if (avoid.includes(cell)) continue
      const step = getPossibleMoves(board, [cell], side === "black").find(
        (name) => !avoid.includes(name),
      )
      if (step) return [cell, step]
    }
    throw new Error(`the position offers ${side} nowhere to step`)
  }

  it("draws a game whose position has stood three times", async () => {
    const blackId = await seatedPlayer()
    const whiteId = await seatedPlayer()

    const gameId = await games.open({
      inviteId: crypto.randomUUID(),
      fromUserId: blackId,
      toUserId: whiteId,
      side: "black",
      setupType: "standard",
    })

    const opening = await games.get(gameId, blackId)
    //one marble a side, stepping out and back. four plies return the board to
    //the opening with black to play again, so two laps stand it a third time.
    const [blackHome, blackOut] = loneStep(opening, "black")
    const [whiteHome, whiteOut] = loneStep(opening, "white", [
      blackHome,
      blackOut,
    ])

    const lap: [string, CellName, CellName][] = [
      [blackId, blackHome, blackOut],
      [whiteId, whiteHome, whiteOut],
      [blackId, blackOut, blackHome],
      [whiteId, whiteOut, whiteHome],
    ]

    let game = opening
    for (let ply = 0; ply < lap.length * 2; ply++) {
      const [userId, from, to] = lap[ply % lap.length]
      game = await games.playMove(
        gameId,
        userId,
        [from],
        to,
        game.moveCount,
      )
    }

    expect(game).toMatchObject({
      status: "finished",
      winner: null,
      finishReason: "threefold_repetition",
      moveCount: 8,
    })
    //the opening position, reached again — nobody captured anything
    expect(game.blackCells.slice().sort()).toEqual(
      opening.blackCells.slice().sort(),
    )
    expect(game.blackScore).toBe(0)
    expect(game.whiteScore).toBe(0)
  })

  it("hands back the game a fresh read finds after each move", async () => {
    const blackId = await seatedPlayer()
    const whiteId = await seatedPlayer()

    const gameId = await games.open({
      inviteId: crypto.randomUUID(),
      fromUserId: blackId,
      toUserId: whiteId,
      side: "black",
      setupType: "standard",
    })

    const opening = await games.get(gameId, blackId)
    const [blackHome, blackOut] = loneStep(opening, "black")
    const [whiteHome, whiteOut] = loneStep(opening, "white", [
      blackHome,
      blackOut,
    ])

    const lap: [string, CellName, CellName][] = [
      [blackId, blackHome, blackOut],
      [whiteId, whiteHome, whiteOut],
      [blackId, blackOut, blackHome],
      [whiteId, whiteOut, whiteHome],
    ]

    //two laps, so the last move is the one that ends the game: the active
    //plies and the finishing one are both checked against the stored row
    let game = opening
    for (let ply = 0; ply < lap.length * 2; ply++) {
      const [userId, from, to] = lap[ply % lap.length]
      game = await games.playMove(
        gameId,
        userId,
        [from],
        to,
        game.moveCount,
      )

      expect(game).toStrictEqual(await games.get(gameId, userId))
    }
    expect(game.status).toBe("finished")
  })

  it("keeps a game alive when the position has only stood twice", async () => {
    const blackId = await seatedPlayer()
    const whiteId = await seatedPlayer()

    const gameId = await games.open({
      inviteId: crypto.randomUUID(),
      fromUserId: blackId,
      toUserId: whiteId,
      side: "black",
      setupType: "standard",
    })

    const opening = await games.get(gameId, blackId)
    const [blackHome, blackOut] = loneStep(opening, "black")
    const [whiteHome, whiteOut] = loneStep(opening, "white", [
      blackHome,
      blackOut,
    ])

    const lap: [string, CellName, CellName][] = [
      [blackId, blackHome, blackOut],
      [whiteId, whiteHome, whiteOut],
      [blackId, blackOut, blackHome],
      [whiteId, whiteOut, whiteHome],
    ]

    let game = opening
    for (const [userId, from, to] of lap) {
      game = await games.playMove(
        gameId,
        userId,
        [from],
        to,
        game.moveCount,
      )
    }

    expect(game).toMatchObject({
      status: "active",
      winner: null,
      finishReason: null,
      moveCount: 4,
    })
  })

  /**
   * Counts the trips a piece of work makes to D1.
   *
   * A batch is one trip however many statements it carries, and every other
   * trip is a prepared statement being run, so those are the calls to watch.
   */
  async function roundTripsOf(
    work: () => Promise<unknown>,
  ): Promise<number> {
    const statement = Object.getPrototypeOf(env.DB.prepare("select 1"))
    const spies = [
      vi.spyOn(env.DB, "batch"),
      vi.spyOn(statement, "all"),
      vi.spyOn(statement, "raw"),
      vi.spyOn(statement, "run"),
      vi.spyOn(statement, "first"),
    ]
    try {
      await work()
      return spies.reduce((total, spy) => total + spy.mock.calls.length, 0)
    } finally {
      for (const spy of spies) spy.mockRestore()
    }
  }

  it("plays a move in three trips to the database", async () => {
    const blackId = await seatedPlayer()
    const whiteId = await seatedPlayer()

    const gameId = await games.open({
      inviteId: crypto.randomUUID(),
      fromUserId: blackId,
      toUserId: whiteId,
      side: "black",
      setupType: "standard",
    })

    const opening = await games.get(gameId, blackId)
    const [from, to] = loneStep(opening, "black")

    //read the game, count the position, write the ply. the game it hands back
    //is built from what was read and written, not read a second time.
    const trips = await roundTripsOf(() =>
      games.playMove(gameId, blackId, [from], to, opening.moveCount),
    )
    expect(trips).toBe(3)
  })

  it("keeps a resignation that lands while a move is in flight", async () => {
    const blackId = await seatedPlayer()
    const whiteId = await seatedPlayer()

    const gameId = await games.open({
      inviteId: crypto.randomUUID(),
      fromUserId: blackId,
      toUserId: whiteId,
      side: "black",
      setupType: "standard",
    })

    const opening = await games.get(gameId, blackId)
    const [from, to] = loneStep(opening, "black")

    //white resigns after black's move has read the game and before it writes,
    //which is the window two requests from two devices can always fall into
    const batch = db.batch.bind(db)
    const spy = vi
      .spyOn(db, "batch")
      .mockImplementationOnce(async (queries) => {
        await games.resign(gameId, whiteId)
        return batch(queries)
      })
    try {
      await expect(
        games.playMove(gameId, blackId, [from], to, opening.moveCount),
      ).rejects.toMatchObject({ errorCode: "move_conflict" })
    } finally {
      spy.mockRestore()
    }

    const after = await games.get(gameId, blackId)
    expect(after).toMatchObject({
      status: "finished",
      winner: "black",
      finishReason: "resignation",
      moveCount: 0,
      blackCells: opening.blackCells,
    })
    expect(await games.listMoves(gameId, blackId)).toHaveLength(1)
  })

  /** A game where `side` is one push away from its sixth marble. */
  async function oneMarbleFromWinning(side: Player) {
    const blackId = await seatedPlayer()
    const whiteId = await seatedPlayer()
    const gameId = await games.open({
      inviteId: crypto.randomUUID(),
      fromUserId: blackId,
      toUserId: whiteId,
      side: "black",
      setupType: "standard",
    })
    //two marbles in a line behind one rival marble on the rim: pushing the
    //line forward sends the rival marble off the board
    const pushers = ["-4,2", "-4,1"]
    const victim = ["-4,0"]
    await db
      .update(gameRows)
      .set({
        blackCells: side === "black" ? pushers : victim,
        whiteCells: side === "black" ? victim : pushers,
        blackScore: side === "black" ? 5 : 0,
        whiteScore: side === "black" ? 0 : 5,
        currentTurn: side,
      })
      .where(eq(gameRows.id, gameId))
    const userId = side === "black" ? blackId : whiteId
    return { gameId, userId }
  }

  it.each(["black", "white"] as const)(
    "gives %s the win when the move pushes off its sixth marble",
    async (side) => {
      const { gameId, userId } = await oneMarbleFromWinning(side)

      const game = await games.playMove(
        gameId,
        userId,
        ["-4,2", "-4,1"],
        "-4,0",
        0,
      )

      expect(game).toMatchObject({
        status: "finished",
        winner: side,
        finishReason: "score",
        [`${side}Score`]: 6,
      })
    },
  )

  it("seats the two players on opposite sides when the invite says random", async () => {
    const fromUserId = await seatedPlayer()
    const toUserId = await seatedPlayer()

    const gameId = await games.open({
      inviteId: crypto.randomUUID(),
      fromUserId,
      toUserId,
      side: "random",
      setupType: "standard",
    })

    const row = await db
      .select()
      .from(gameRows)
      .where(eq(gameRows.id, gameId))
      .get()
    expect([row?.blackUserId, row?.whiteUserId].sort()).toEqual(
      [fromUserId, toUserId].sort(),
    )
  })
})

/**
 * D1 failing part way through. The real binding answers the first `healthy`
 * statements and every one after that throws, so a read or write behind
 * another one can be failed on its own. A batch always fails.
 */
function d1FailingAfter(healthy: number): D1Database {
  let prepared = 0
  return {
    prepare(query: string) {
      prepared += 1
      if (prepared > healthy)
        throw new Error("D1_ERROR: network connection lost")
      return env.DB.prepare(query)
    },
    batch() {
      throw new Error("D1_ERROR: network connection lost")
    },
  } as unknown as D1Database
}

describe("game service when D1 fails", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  const db = getDb(env.DB)
  const games = new GameService(db)

  async function openGame() {
    const ids = [crypto.randomUUID(), crypto.randomUUID()]
    const now = new Date()
    for (const id of ids)
      await db.insert(user).values({
        id,
        name: id,
        email: `${id}@service.abalone.invalid`,
        createdAt: now,
        updatedAt: now,
      })
    const [blackId, whiteId] = ids
    const gameId = await games.open({
      inviteId: crypto.randomUUID(),
      fromUserId: blackId,
      toUserId: whiteId,
      side: "black",
      setupType: "standard",
    })
    return { gameId, blackId }
  }

  const internalError = { errorCode: "internal_server_error" }

  it("fails listing a player's games", async () => {
    const down = new GameService(getDb(failingD1()))

    await expect(
      down.listForUser(crypto.randomUUID(), "active"),
    ).rejects.toMatchObject(internalError)
  })

  it("fails reading a game", async () => {
    const { gameId, blackId } = await openGame()
    const down = new GameService(getDb(failingD1()))

    await expect(down.get(gameId, blackId)).rejects.toMatchObject(
      internalError,
    )
  })

  it("fails reading the plies after the game itself was read", async () => {
    const { gameId, blackId } = await openGame()
    const down = new GameService(getDb(d1FailingAfter(1)))

    await expect(down.listMoves(gameId, blackId)).rejects.toMatchObject(
      internalError,
    )
  })

  it("fails a resignation whose write does not land", async () => {
    const { gameId, blackId } = await openGame()
    const down = new GameService(getDb(d1FailingAfter(1)))

    await expect(down.resign(gameId, blackId)).rejects.toMatchObject(
      internalError,
    )
  })

  it("fails a move when the repetition count cannot be read", async () => {
    const { gameId, blackId } = await openGame()
    const opening = await games.get(gameId, blackId)
    const board = {
      black: new Set(opening.blackCells),
      white: new Set(opening.whiteCells),
    }
    const from = opening.blackCells.find(
      (cell) => getPossibleMoves(board, [cell], true).length > 0,
    ) as CellName
    const [to] = getPossibleMoves(board, [from], true)
    const down = new GameService(getDb(d1FailingAfter(1)))

    await expect(
      down.playMove(gameId, blackId, [from], to, 0),
    ).rejects.toMatchObject(internalError)
  })

  it("fails opening a game when the write fails and no game exists for the invite", async () => {
    const down = new GameService(
      getDb(d1FailingAfter(Number.POSITIVE_INFINITY)),
    )

    await expect(
      down.open({
        inviteId: crypto.randomUUID(),
        fromUserId: crypto.randomUUID(),
        toUserId: crypto.randomUUID(),
        side: "black",
        setupType: "standard",
      }),
    ).rejects.toMatchObject(internalError)
  })

  it("fails opening a game when neither the write nor the invite lookup works", async () => {
    const down = new GameService(getDb(failingD1()))

    await expect(
      down.open({
        inviteId: crypto.randomUUID(),
        fromUserId: crypto.randomUUID(),
        toUserId: crypto.randomUUID(),
        side: "black",
        setupType: "standard",
      }),
    ).rejects.toMatchObject(internalError)
  })
})
