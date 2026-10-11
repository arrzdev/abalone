import { PLAYABLE_SETUPS } from "@repo/abalone-engine/board-setups"
import { newEndpoint } from "@repo/shared/http"
import type { Context } from "hono"
import { z } from "zod"
import { getDb } from "@/database/client"
import type { Env } from "@/env/registry"
import { InviteLinkAcceptanceFacade } from "@/facades/invite-link-acceptance.facade"
import { ok } from "@/http/envelope"
import type { AuthedVariables } from "@/http/middlewares/auth"
import { requireAuth } from "@/http/middlewares/auth"
import { rateLimit } from "@/http/middlewares/rate-limit"
import { valid } from "@/http/middlewares/valid"
import { frontendOrigins } from "@/http/network-policy"
import { publishToUsers } from "@/modules/realtime/channel"
import { GameService } from "@/services/game.service"
import { InviteLinkService } from "@/services/invite-link.service"

//---- schemas ----------------

//the shape of an id this api hands out, checked before any query: 32 bytes of
//base64url without padding
const linkIdSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
})

const createLinkSchema = z.object({
  setupType: z.enum(PLAYABLE_SETUPS),
  side: z.enum(["black", "white", "random"]),
})

//---- link urls ----------------

/**
 * The game origin a link should open on.
 *
 * The one that asked, when it is ours: the game answers on more than one
 * domain, and a link made on one should open on the same one. Anything else
 * gets the first configured origin, so a forged `Origin` cannot point a link
 * somewhere we do not serve.
 */
function linkOrigin(c: Context): string {
  const origins = frontendOrigins()
  const origin = c.req.header("origin")
  if (origin && origins.includes(origin)) return origin
  return origins[0]
}

//---- routes ----------------

export const inviteLinkRoutes = newEndpoint<Env, AuthedVariables>()
  //---- create ----------------
  //rate-limit BEFORE auth so a flood is shed before paying a session lookup

  .post(
    "/",
    rateLimit("invite-link"),
    requireAuth(),
    valid("json", createLinkSchema),
    async (c) => {
      const body = c.req.valid("json")
      const linkService = new InviteLinkService(getDb(c.env.DB))
      const link = await linkService.create(
        c.get("user").id,
        body.setupType,
        body.side,
      )

      return ok(
        c,
        {
          url: `${linkOrigin(c)}/invite/${link.id}`,
          expiresAt: link.expiresAt,
        },
        201,
      )
    },
  )

  //---- public read ----------------
  //no auth: whoever was sent the link sees who sent it before signing in

  .get(
    "/:id",
    rateLimit("api"),
    valid("param", linkIdSchema),
    async (c) => {
      const linkService = new InviteLinkService(getDb(c.env.DB))
      const link = await linkService.readPublic(c.req.valid("param").id)
      return ok(c, link)
    },
  )

  //---- accept ----------------

  .post(
    "/:id/accept",
    rateLimit("invite-link"),
    requireAuth(),
    valid("param", linkIdSchema),
    async (c) => {
      const db = getDb(c.env.DB)
      const acceptance = new InviteLinkAcceptanceFacade(
        new InviteLinkService(db),
        new GameService(db),
      )
      const result = await acceptance.accept(
        c.req.valid("param").id,
        c.get("user").id,
      )

      //a game now exists for both of them, so both lists moved. sent on a
      //retry too: a retry can be the request that finally opened the game.
      c.executionCtx.waitUntil(
        publishToUsers(c.env.PUBSUB, result.playerIds, {
          event: "games-changed",
        }),
      )

      return ok(c, { gameId: result.gameId }, result.opened ? 201 : 200)
    },
  )
