import type { Context, MiddlewareHandler, Next } from "hono"
import { getDb } from "@/database/client"
import type { Env } from "@/env/registry"
import { error } from "@/http/envelope"
import { CustomError } from "@/http/errors"
import { isAllowedFrontendOrigin } from "@/http/network-policy"
import type { SessionUser } from "@/services/auth.service"
import { AuthService } from "@/services/auth.service"

//variables added by requireAuth() — `user` is set only on routes that mount
//it; guest/public routes never read it.
export type AuthedVariables = {
  user: SessionUser
}

//---- requireAllowedOrigin -----------------------------------------
//csrf guard. in production the api shares the game's origin (wrangler.toml
//routes), so the browser holds better-auth's session cookie and requireAuth()
//accepts it next to the bearer token. a page on another site would get that
//cookie sent along with a POST it forges; such a request carries a foreign
//Origin: refuse it with 403 forbidden_origin. a request without a cookie
//cannot ride on anyone's session, and no Origin at all is not a browser.

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

function isForgeable(c: Context): boolean {
  if (SAFE_METHODS.has(c.req.method)) return false
  if (!c.req.header("cookie")) return false
  const origin = c.req.header("origin")
  //the same allowlist as cors and better-auth's trusted origins
  return origin !== undefined && !isAllowedFrontendOrigin(origin)
}

export function requireAllowedOrigin(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    if (isForgeable(c)) return error(c, "forbidden_origin")
    await next()
  }
}

//---- requireAuth --------------------------------------------------
//gate a route on a signed-in user. resolves the session from the request
//(bearer token / cookie) in D1 on every call, so a revoked session fails at
//once; sets `c.get("user")` for handlers, and throws `unauthorized` for
//guests — so guest clients simply never reach user-scoped data, and offline
//play stays fully local. every mutation behind it gets the origin check
//above. D1 failing is 503 (thrown by AuthService), never 401.

//workerd has Headers#getSetCookie(); the type lib in use does not declare it
function setCookiesOf(headers: Headers): string[] {
  return (
    headers as Headers & { getSetCookie: () => string[] }
  ).getSetCookie()
}

export function requireAuth(): MiddlewareHandler<{
  Bindings: Env
  Variables: AuthedVariables
}> {
  return async (
    c: Context<{ Bindings: Env; Variables: AuthedVariables }>,
    next: Next,
  ) => {
    if (isForgeable(c)) return error(c, "forbidden_origin")
    const { user, renewal } = await new AuthService(
      getDb(c.env.DB),
    ).getSession(c.req.raw.headers)
    //a renewed session rides on whatever this request answers: the cookie,
    //and the bearer plugin's copy of its token for the spa
    for (const cookie of setCookiesOf(renewal))
      c.header("Set-Cookie", cookie, { append: true })
    const renewedToken = renewal.get("set-auth-token")
    if (renewedToken) c.header("set-auth-token", renewedToken)
    if (!user) throw new CustomError("unauthorized")
    c.set("user", user)
    await next()
  }
}
