import tryCatch from "@repo/shared/try-catch"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { isAPIError } from "better-auth/api"
import { bearer, username } from "better-auth/plugins"
import { authSchema } from "@/database/auth.schema"
import type { Db } from "@/database/client"
import { profiles } from "@/database/schema"
import { env } from "@/env/registry"
import { CustomError } from "@/http/errors"
import {
  allowsPrivateOrigins,
  frontendOrigins,
} from "@/http/network-policy"
import { isPrivateOrigin } from "@/utils/is-private-origin"

/** What a signed-in player is, everywhere downstream of `requireAuth`. */
export type SessionUser = {
  id: string
  //normalised handle — the one sign-in matches on
  username: string | null
  //what they typed, casing intact. this is the name the game shows.
  displayUsername: string | null
}

//---- username rules ----------------
//kept in one place because three things have to agree: what the plugin accepts,
//what the derived email is built from, and what the sign-up form validates.

export const MIN_USERNAME_LENGTH = 3
export const MAX_USERNAME_LENGTH = 20

//stated rather than left to better-auth's default, because the sign-up form
//validates against the same number and a silent default is not something the
//other side can read.
export const MIN_PASSWORD_LENGTH = 8

/**
 * The domain every derived address sits under.
 *
 * `.invalid` is reserved by RFC 2606 precisely so it can never resolve, which is
 * the point: this app has no email, and an address that could accidentally reach
 * a real inbox would be a liability rather than a placeholder.
 */
const DERIVED_EMAIL_DOMAIN = "users.abalone.invalid"

/**
 * better-auth requires an email even when the app never asks for one, so we make
 * one up from the username and overwrite whatever the client sent.
 *
 * Overwriting rather than trusting the request matters: the column is unique, so
 * a client free to choose it could squat on another player's future address, and
 * deriving it makes the email's uniqueness the same fact as the username's.
 */
export function derivedEmailFor(handle: string): string {
  return `${handle.toLowerCase()}@${DERIVED_EMAIL_DOMAIN}`
}

//---- better-auth instance ----------------
//one instance per worker isolate (re-creating per request blows cpu on cold
//sign-in), so it's cached by the db handle it was built with — and getDb()
//hands back a stable handle per binding, making this effectively per-isolate.
//bearer-token sessions: the PWA stores the token, so there is no cross-origin
//cookie to fight Safari over.
//
//no social providers on purpose. this app signs in with a username and a
//password and nothing else, so there is no oauth dance to mount and no provider
//discovery endpoint for a client to ask about.

const authCache = new Map<Db, ReturnType<typeof createAuth>>()

function createAuth(db: Db) {
  return betterAuth({
    appName: "abalone",
    secret: env.BETTER_AUTH_SECRET,
    //the full api url — better-auth builds its own absolute urls from this
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/v1/auth",
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: authSchema,
    }),
    //every configured frontend origin, because the game answers on more than
    //one domain. in dev the request's own private origin is added to them.
    trustedOrigins: allowsPrivateOrigins()
      ? async (request) => {
          //createAuthContext probes getTrustedOrigins() with no request at
          //init; skip until real HTTP traffic carries an origin
          if (request === undefined) return []
          const origin = request.headers.get("origin")
          if (origin && isPrivateOrigin(origin)) return [origin]
          return frontendOrigins()
        }
      : frontendOrigins(),
    emailAndPassword: {
      //this is the credential flow the username plugin sits on top of — the
      //player never sees an email field, but the password half is this one
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      //no custom password hash: better-auth's default scrypt runs on native
      //node:crypto under workerd (scripts/check-password-bundle.ts guards it)
    },
    plugins: [
      //the SPA reads the token from the `set-auth-token` response header and
      //sends it back as `Authorization: Bearer …`
      bearer(),
      //adds `username` + `displayUsername` to `user` and the sign-in path that
      //matches on them. it owns uniqueness and normalisation, which is why the
      //handle lives on better-auth's table rather than on `profiles`.
      username({
        minUsernameLength: MIN_USERNAME_LENGTH,
        maxUsernameLength: MAX_USERNAME_LENGTH,
      }),
    ],
    //no session.cookieCache: every request reads its session from D1, so a
    //sign-out or a revoked session fails on the very next call
    //one limiter only: the cloudflare bindings in middlewares/rate-limit.ts.
    //better-auth's own counts in memory, which on workers is per isolate
    rateLimit: { enabled: false },
    databaseHooks: {
      user: {
        create: {
          before: async (created) => {
            //derive the email from the handle rather than trusting the body
            const handle = created.username
            if (typeof handle !== "string" || handle.length === 0) return
            return {
              data: { ...created, email: derivedEmailFor(handle) },
            }
          },
          after: async (created) => {
            //mirror every new auth user into our own profile row — the app's
            //own editable fields live there, never on better-auth's `user`
            const now = new Date()
            await db
              .insert(profiles)
              .values({
                userId: created.id,
                avatarKey: null,
                createdAt: now,
                updatedAt: now,
              })
              .onConflictDoNothing()
          },
        },
      },
    },
  })
}

//test-only: drop cached instances so a fresh env/secret takes effect
export function resetAuthForTests(): void {
  authCache.clear()
}

//---- Auth service ----------------
//thin domain wrapper over better-auth: sign-in/up/out are handled by its mounted
//handler and its client SDK, so all WE own is (1) forwarding requests to that
//handler and (2) resolving the current user for our own user-scoped routes.

export class AuthService {
  constructor(private db: Db) {}

  private auth() {
    const cached = authCache.get(this.db)
    if (cached) return cached
    const instance = createAuth(this.db)
    authCache.set(this.db, instance)
    return instance
  }

  //forward a request straight to better-auth's mounted handler (every method
  //under its basePath: sign-in/up/out, get-session).
  handler(request: Request): Promise<Response> {
    return this.auth().handler(request)
  }

  //resolve the signed-in player from request headers (bearer token / cookie)
  //against D1, or null for a guest. `renewal` holds the headers better-auth
  //sets when it extends the session (once a day of use): the renewed cookie
  //and its `set-auth-token`. the caller must send them, or the client's
  //session runs out while D1 still says it is live. D1 failing throws
  //service_unavailable, never "guest", so a blip does not sign anyone out.
  async getSession(
    headers: Headers,
  ): Promise<{ user: SessionUser | null; renewal: Headers }> {
    const [found, sessionError] = await tryCatch(() =>
      this.auth().api.getSession({ headers, returnHeaders: true }),
    )
    if (sessionError) {
      //better-auth's own 401 (a session deleted mid-refresh) is "no session"
      if (isAPIError(sessionError) && sessionError.statusCode === 401)
        return { user: null, renewal: new Headers() }
      throw new CustomError("service_unavailable", sessionError)
    }
    const renewal = found.headers ?? new Headers()
    const session = found.response
    if (!session?.user?.id) return { user: null, renewal }
    return {
      user: {
        id: session.user.id,
        username: session.user.username ?? null,
        displayUsername: session.user.displayUsername ?? null,
      },
      renewal,
    }
  }
}
