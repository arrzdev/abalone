import { newEndpoint } from "@repo/shared/http"
import { getDb } from "@/database/client"
import type { Env } from "@/env/registry"
import { rateLimit } from "@/http/middlewares/rate-limit"
import { AuthService } from "@/services/auth.service"

//better-auth owns every method under its basePath (/api/v1/auth/*): sign-up,
//sign-in with a username, sign-out, get-session. forward the raw request
//straight to its handler — its client SDK on the frontend drives them.
//
//one wildcard is the whole integration. there is no provider-discovery route
//because there are no providers: a username and a password is the only way in.
export const authHandlerRoutes = newEndpoint<Env>()
  .use("*", rateLimit("auth"))
  .on(["GET", "POST"], "/*", (c) =>
    new AuthService(getDb(c.env.DB)).handler(c.req.raw),
  )
