import { MAX_LINE } from "@repo/abalone-engine/config"
import { newEndpoint } from "@repo/shared/http"
import { z } from "zod"
import { getDb } from "@/database/client"
import type { Env } from "@/env/registry"
import { InviteAcceptanceFacade } from "@/facades/invite-acceptance.facade"
import { ok } from "@/http/envelope"
import type { AuthedVariables } from "@/http/middlewares/auth"
import { requireAuth } from "@/http/middlewares/auth"
import { rateLimit } from "@/http/middlewares/rate-limit"
import { valid } from "@/http/middlewares/valid"
import { GameService } from "@/services/game.service"
import { InviteService } from "@/services/invite.service"

//---- schemas ----------------

/** A square's public name: its axial coordinates, as `"r,q"`. */
const cellNameSchema = z.string().regex(/^-?\d+,-?\d+$/)

const gameIdSchema = z.object({ id: z.uuid() })

const listGamesSchema = z.object({
  status: z.enum(["active", "finished"]).default("active"),
})

const openGameSchema = z.object({ inviteId: z.uuid() })

//which marbles move and where to, and nothing else. there is no field here for
//a board, a score or a turn, because the server works all three out itself.
const playMoveSchema = z.object({
  marbles: z.array(cellNameSchema).min(1).max(MAX_LINE),
  destination: cellNameSchema,
  //which position the client was looking at, so a move aimed at a board the
  //game has since moved past is rejected rather than replayed onto this one
  moveIndex: z.int().min(0),
})

//---- routes ----------------

export const gameRoutes = newEndpoint<Env, AuthedVariables>()
  //rate-limit BEFORE auth so a flood is shed before paying a session lookup
  .use("*", rateLimit("api"))
  .use("*", requireAuth())

  //---- list ----------------

  .get("/", valid("query", listGamesSchema), async (c) => {
    const gameService = new GameService(getDb(c.env.DB))
    const games = await gameService.listForUser(
      c.get("user").id,
      c.req.valid("query").status,
    )
    return ok(c, { games })
  })

  //---- open from an invite ----------------
  //a create against the resource being created. what accepting an invite
  //produces is a game; the invite going away is the facade's business, not
  //something the url should be describing.

  .post("/", valid("json", openGameSchema), async (c) => {
    const db = getDb(c.env.DB)
    const acceptance = new InviteAcceptanceFacade(
      new InviteService(db),
      new GameService(db),
    )
    const game = await acceptance.accept(
      c.req.valid("json").inviteId,
      c.get("user").id,
    )
    return ok(c, { game }, 201)
  })

  //---- read ----------------

  .get("/:id", valid("param", gameIdSchema), async (c) => {
    const gameService = new GameService(getDb(c.env.DB))
    const game = await gameService.get(
      c.req.valid("param").id,
      c.get("user").id,
    )
    return ok(c, { game })
  })

  //---- read the move history ----------------
  //its own request rather than part of the game above: polling only needs the
  //row, which carries `moveCount`, and refetching the whole history every few
  //seconds to learn a number is the traffic this split exists to avoid.

  .get("/:id/moves", valid("param", gameIdSchema), async (c) => {
    const gameService = new GameService(getDb(c.env.DB))
    const moves = await gameService.listMoves(
      c.req.valid("param").id,
      c.get("user").id,
    )
    return ok(c, { moves })
  })

  //---- play a move ----------------

  .post(
    "/:id/moves",
    valid("param", gameIdSchema),
    valid("json", playMoveSchema),
    async (c) => {
      const body = c.req.valid("json")
      const gameService = new GameService(getDb(c.env.DB))
      const game = await gameService.playMove(
        c.req.valid("param").id,
        c.get("user").id,
        body.marbles,
        body.destination,
        body.moveIndex,
      )
      return ok(c, { game }, 201)
    },
  )

  //---- resign ----------------

  .post("/:id/resignation", valid("param", gameIdSchema), async (c) => {
    const gameService = new GameService(getDb(c.env.DB))
    const game = await gameService.resign(
      c.req.valid("param").id,
      c.get("user").id,
    )
    return ok(c, { game })
  })
