import { Logger } from "@repo/shared/logging"
import { authClient } from "@/data/auth/client"
import { endSession } from "@/data/auth/session-end"

const log = new Logger("auth")

//---- the rules the form validates against -------------------------
//these mirror apps/backend/src/services/auth.service.ts. they are duplicated
//rather than imported because a runtime import across two apps is not allowed
//(only the RPC interface type crosses), and the backend enforces them anyway —
//the copies here exist so the form can say no before a round trip.

export const MIN_USERNAME_LENGTH = 3
export const MAX_USERNAME_LENGTH = 20
export const MIN_PASSWORD_LENGTH = 8

/** What better-auth's own username validator accepts. */
export const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/

/**
 * better-auth requires an email even though this app has no concept of one, so
 * the client sends the same value the server derives.
 *
 * Sending the derived value rather than a placeholder matters: better-auth
 * checks the email for uniqueness before our hook rewrites it, so one shared
 * placeholder would make the second player to sign up look like a duplicate.
 * The server overwrites this regardless, so it is a formality, not a claim.
 */
function derivedEmailFor(username: string): string {
  return `${username.toLowerCase()}@users.abalone.invalid`
}

//---- failures the form can talk about -----------------------------

export type AuthErrorCode =
  | "username_taken"
  | "username_invalid"
  | "password_too_short"
  | "invalid_credentials"
  | "account_locked"
  | "unknown"

/** A sign-in or sign-up failure, reduced to something the UI can translate. */
export class AuthError extends Error {
  override readonly name = "AuthError"

  constructor(
    public readonly code: AuthErrorCode,
    /** For `account_locked`: whole minutes until the lock lifts, rounded up. */
    public readonly retryAfterMinutes?: number,
  ) {
    super(code)
  }
}

//better-auth answers with its own code strings, and the api's own routes in
//front of it answer with the app envelope's `error_code`; this is the one place
//that knows both, so the form deals in this app's vocabulary instead.
function toAuthErrorCode(error: AuthFailure): AuthErrorCode {
  if (error.error_code === "auth_account_locked") return "account_locked"
  switch (error.code) {
    case "USERNAME_IS_ALREADY_TAKEN":
    case "USER_ALREADY_EXISTS":
      return "username_taken"
    case "USERNAME_TOO_SHORT":
    case "USERNAME_TOO_LONG":
    case "INVALID_USERNAME":
    case "INVALID_DISPLAY_USERNAME":
      return "username_invalid"
    case "PASSWORD_TOO_SHORT":
      return "password_too_short"
    case "INVALID_USERNAME_OR_PASSWORD":
    case "INVALID_EMAIL_OR_PASSWORD":
      return "invalid_credentials"
    default:
      return "unknown"
  }
}

type AuthFailure = { code?: string; error_code?: string }

/**
 * Seconds in a `Retry-After` header as whole minutes, rounded up: a lock with
 * 13 min 1 s left is not "13 minutes". Undefined when there is no usable value.
 */
function retryAfterMinutes(header: string | null): number | undefined {
  const seconds = Number(header)
  if (!header || !Number.isFinite(seconds) || seconds <= 0)
    return undefined
  return Math.ceil(seconds / 60)
}

/**
 * Per-call fetch options that keep the `Retry-After` of a refused attempt.
 *
 * The SDK's result carries the body of a failure but not its headers, and the
 * header is where a locked account's remaining time lives.
 */
function retryAfterReader() {
  let header: string | null = null
  return {
    fetchOptions: {
      onError: (context: { response: Response }) => {
        header = context.response.headers.get("retry-after")
      },
    },
    minutes: () => retryAfterMinutes(header),
  }
}

//the client SDK returns failures rather than throwing them, and every caller
//here wants a throw so mutations behave like mutations
function throwOnError(
  result: { error?: AuthFailure | null },
  minutes?: () => number | undefined,
): void {
  if (!result.error) return
  const code = toAuthErrorCode(result.error)
  throw new AuthError(
    code,
    code === "account_locked" ? minutes?.() : undefined,
  )
}

//---- the three things a player can do ------------------------------

export type Credentials = {
  username: string
  password: string
}

export async function signUp(credentials: Credentials): Promise<void> {
  const retryAfter = retryAfterReader()
  const result = await authClient.signUp.email(
    {
      username: credentials.username,
      //what they typed, casing intact — this is the name the game shows
      displayUsername: credentials.username,
      //better-auth requires both, and neither is ever shown or used
      name: credentials.username,
      email: derivedEmailFor(credentials.username),
      password: credentials.password,
    },
    retryAfter.fetchOptions,
  )
  throwOnError(result, retryAfter.minutes)
}

export async function signIn(credentials: Credentials): Promise<void> {
  const retryAfter = retryAfterReader()
  const result = await authClient.signIn.username(
    {
      username: credentials.username,
      password: credentials.password,
    },
    retryAfter.fetchOptions,
  )
  throwOnError(result, retryAfter.minutes)
}

/**
 * Sign out here first, then tell the server.
 *
 * The local session goes regardless of what the network says, because a
 * sign-out that fails to reach the server still has to take effect on the
 * device the player is holding.
 */
export async function signOut(): Promise<void> {
  endSession()

  const result = await authClient.signOut()
  //the session may still be live server-side, which is worth saying out loud
  //rather than swallowing, but it changes nothing for this device
  if (result.error) log.warn("server sign-out failed", result.error)
}
