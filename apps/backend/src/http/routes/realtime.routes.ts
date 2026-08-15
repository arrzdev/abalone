import { newEndpoint } from "@repo/shared/http"
import type { Env } from "@/env/registry"
import { ok } from "@/http/envelope"
import { CustomError } from "@/http/errors"
import type { AuthedVariables } from "@/http/middlewares/auth"
import { requireAuth } from "@/http/middlewares/auth"
import { rateLimit } from "@/http/middlewares/rate-limit"
import { isAllowedFrontendOrigin } from "@/http/network-policy"
import { userChannel } from "@/modules/realtime/channel"
import { mintTicket, verifyTicket } from "@/modules/realtime/ticket"

//---- routes ----------------
//two halves of one act. the ticket half is an ordinary authenticated json
//route, which is the point: a browser cannot put an Authorization header on a
//WebSocket, and cannot read the status or body of a handshake that fails. so
//everything that can go wrong goes wrong over http, where the client can read
//the answer, and the socket only ever redeems a decision already made.

export const realtimeRoutes = newEndpoint<Env, AuthedVariables>()
  //rate-limit BEFORE auth so a flood is shed before paying a session lookup
  .use("*", rateLimit("realtime"))
  //only the ticket half can be gated: the subscribe half arrives with no header
  //to gate on, which is the whole reason the ticket exists
  .use("/ticket", requireAuth())

  //---- mint a ticket ----------------

  .post("/ticket", async (c) => {
    const user = c.get("user")
    const ticket = await mintTicket(
      c.env.BETTER_AUTH_SECRET,
      user.id,
      //a player only ever subscribes to their own channel, so there is nothing
      //here for the request to ask for and nothing to get wrong
      userChannel(user.id),
    )
    return ok(c, ticket, 201)
  })

  //---- subscribe ----------------

  .get("/", async (c) => {
    if (c.req.header("upgrade")?.toLowerCase() !== "websocket")
      throw new CustomError("invalid_input")

    //CORS does not govern a websocket handshake, so the allowlist every other
    //route gets from the cors plugin has to be applied here by hand. a request
    //with no Origin is not a browser, and has no allowlist to be judged by.
    const origin = c.req.header("origin")
    if (origin && !isAllowedFrontendOrigin(origin))
      throw new CustomError("unauthorized")

    const ticket = c.req.query("ticket")
    if (!ticket) throw new CustomError("unauthorized")

    const claim = await verifyTicket(c.env.BETTER_AUTH_SECRET, ticket)
    if (!claim) throw new CustomError("unauthorized")

    //THE CHANNEL COMES FROM THE TICKET. it is one of the signed claims, so a
    //ticket is only ever redeemable against the channel it was minted for, and
    //there is no parameter here a client could point somewhere else. reading a
    //channel off the request instead would be a security regression, however
    //convenient it looks.
    const namespace = c.env.PUBSUB
    const stub = namespace.get(namespace.idFromName(claim.channel))

    //returned exactly as it comes back. copying it, wrapping it, or setting a
    //header on it drops the `webSocket` the 101 exists to carry.
    return stub.fetch(c.req.raw)
  })
