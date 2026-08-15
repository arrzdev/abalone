import { PLAYABLE_SETUPS } from "@repo/abalone-engine/board-setups"
import { newEndpoint } from "@repo/shared/http"
import type { Context } from "hono"
import { z } from "zod"
import { getDb } from "@/database/client"
import type { Env } from "@/env/registry"
import { ok } from "@/http/envelope"
import type { AuthedVariables } from "@/http/middlewares/auth"
import { requireAuth } from "@/http/middlewares/auth"
import { rateLimit } from "@/http/middlewares/rate-limit"
import { valid } from "@/http/middlewares/valid"
import { publishToUsers } from "@/modules/realtime/channel"
import { InviteService } from "@/services/invite.service"

//---- schemas ----------------

const inviteIdSchema = z.object({ id: z.uuid() })

const sendInviteSchema = z.object({
  //the handle as it was typed. the service lowercases it to match.
  username: z.string().trim().min(3).max(20),
  setupType: z.enum(PLAYABLE_SETUPS),
  side: z.enum(["black", "white", "random"]),
})

//the only change a recipient can make to an invite, spelled out rather than
//left open: a patch that could set any column would be a patch worth abusing
const declineInviteSchema = z.object({
  status: z.literal("declined"),
})

//---- beacons ----------------

/**
 * Tells both parties their invite list changed.
 *
 * Both, not just the other one: the player who acted already refreshed on their
 * own device, and telling them anyway is what keeps a second device honest.
 *
 * `waitUntil`, so the fan-out never delays the answer. The write already
 * happened, and a missed beacon costs a refetch on focus at worst.
 */
function announceInvites(
  c: Context<{ Bindings: Env; Variables: AuthedVariables }>,
  userIds: string[],
): void {
  c.executionCtx.waitUntil(
    publishToUsers(c.env.PUBSUB, userIds, { event: "invites-changed" }),
  )
}

//---- routes ----------------

export const inviteRoutes = newEndpoint<Env, AuthedVariables>()
  //rate-limit BEFORE auth so a flood is shed before paying a session lookup
  .use("*", rateLimit("api"))
  .use("*", requireAuth())

  //---- list ----------------

  .get("/", async (c) => {
    const inviteService = new InviteService(getDb(c.env.DB))
    const invites = await inviteService.listForUser(c.get("user").id)
    return ok(c, { invites })
  })

  //---- send ----------------

  .post("/", valid("json", sendInviteSchema), async (c) => {
    const body = c.req.valid("json")
    const inviteService = new InviteService(getDb(c.env.DB))
    const invite = await inviteService.create(
      c.get("user").id,
      body.username,
      body.setupType,
      body.side,
    )

    announceInvites(c, [invite.from.userId, invite.to.userId])
    return ok(c, { invite }, 201)
  })

  //---- decline ----------------

  .patch(
    "/:id",
    valid("param", inviteIdSchema),
    valid("json", declineInviteSchema),
    async (c) => {
      const inviteService = new InviteService(getDb(c.env.DB))
      const invite = await inviteService.decline(
        c.req.valid("param").id,
        c.get("user").id,
      )

      announceInvites(c, [invite.from.userId, invite.to.userId])
      return ok(c, { invite })
    },
  )

  //---- delete ----------------

  .delete("/:id", valid("param", inviteIdSchema), async (c) => {
    const sender = c.get("user").id
    const inviteService = new InviteService(getDb(c.env.DB))
    //the row is gone, so the recipient comes back from the delete itself
    const recipient = await inviteService.removeOwn(
      c.req.valid("param").id,
      sender,
    )

    announceInvites(c, [sender, recipient])
    return ok(c)
  })
