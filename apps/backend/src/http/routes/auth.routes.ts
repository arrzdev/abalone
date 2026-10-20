import { newEndpoint } from "@repo/shared/http"
import tryCatch from "@repo/shared/try-catch"
import type { Context } from "hono"
import { getDb } from "@/database/client"
import type { Env } from "@/env/registry"
import { RetryLaterError } from "@/http/errors"
import { requireAllowedOrigin } from "@/http/middlewares/auth"
import {
  assertAuthFailureNotCapped,
  rateLimit,
  recordAuthFailure,
} from "@/http/middlewares/rate-limit"
import { AuthService, derivedEmailFor } from "@/services/auth.service"
import {
  AuthLockoutService,
  lockoutIdentifier,
} from "@/services/auth-lockout.service"

type SignInField = "email" | "username"

//the sign-in body with its email or username trimmed, so " Kasparov " is the
//account kasparov (better-auth lower-cases it, but answers the spaces with a
//400, which would never count against the lockout). null value: no body or no
//such field, which better-auth answers itself
async function trimmedSignIn(
  request: Request,
  field: SignInField,
): Promise<{ value: string | null; request: Request }> {
  const [body] = await tryCatch(
    () => request.clone().json() as Promise<Record<string, unknown>>,
  )
  if (!body || typeof body !== "object" || typeof body[field] !== "string")
    return { value: null, request }
  const value = (body[field] as string).trim()
  const headers = new Headers(request.headers)
  headers.delete("content-length")
  return {
    value,
    request: new Request(request, {
      headers,
      body: JSON.stringify({ ...body, [field]: value }),
    }),
  }
}

//the account a sign-in is counted under: its email as better-auth stores it.
//a username is counted under the email derived from it, so both paths below
//share one count per player.
function identifierOf(field: SignInField, value: string): string {
  return lockoutIdentifier(
    field === "username" ? derivedEmailFor(value) : value,
  )
}

//one password sign-in, in this order: the ip's failed sign-in cap → the
//account's lockout, both before any hashing → better-auth → a 401 counts
//against the account and the ip, a success clears the account.
function signIn(field: SignInField) {
  return async (c: Context<{ Bindings: Env }>) => {
    await assertAuthFailureNotCapped(c)

    const { value, request } = await trimmedSignIn(c.req.raw, field)
    const identifier = value === null ? null : identifierOf(field, value)
    const db = getDb(c.env.DB)
    const lockout = new AuthLockoutService(db)
    const now = Date.now()
    if (identifier !== null) {
      const state = await lockout.check(identifier, now)
      if (state.locked)
        throw new RetryLaterError(
          "auth_account_locked",
          state.retryAfterSeconds,
        )
    }

    const response = await new AuthService(db).handler(request)
    if (response.status === 401) {
      //an unknown player is counted too: it answers exactly like a known one
      if (identifier !== null) await lockout.recordFailure(identifier, now)
      await recordAuthFailure(c)
    } else if (response.ok && identifier !== null) {
      //best effort: the session exists now, and a row left behind only means
      //the next failures start from a higher count
      await tryCatch(() => lockout.reset(identifier))
    }
    return response
  }
}

//better-auth owns every method under its basePath (/api/v1/auth/*): sign-up,
//sign-in with a username, sign-out, get-session. the raw request goes straight
//to its handler — its client SDK on the frontend drives them. there is no
//provider-discovery route because there are no providers: a username and a
//password is the only way in.
//
//every POST is in the auth rate-limit tier (burst + sustained bindings) and,
//when it carries the session cookie, must come from one of our origins. a GET
//(get-session) is a read like any other, so it gets the `api` ceiling. both
//password sign-in paths the handler would answer get an explicit route first,
//for the lockout; everything else falls through to the wildcard.
export const authHandlerRoutes = newEndpoint<Env>()
  .get("/*", rateLimit("api"))
  .post("/*", rateLimit("auth"), requireAllowedOrigin())
  .post("/sign-in/email", signIn("email"))
  .post("/sign-in/username", signIn("username"))
  .on(["GET", "POST"], "/*", (c) =>
    new AuthService(getDb(c.env.DB)).handler(c.req.raw),
  )
