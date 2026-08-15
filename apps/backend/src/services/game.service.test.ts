import { env } from "cloudflare:workers"
import { getPossibleMoves } from "@repo/abalone-engine/rules"
import type { CellName, Player } from "@repo/abalone-engine/types"
import { beforeAll, describe, expect, it } from "vitest"
import { user } from "@/database/auth.schema"
import { getDb } from "@/database/client"
import { envRegistry } from "@/env/registry"
import type { Game } from "@/services/game.service"
import { GameService } from "@/services/game.service"

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
})
