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
  | "unknown"

/** A sign-in or sign-up failure, reduced to something the UI can translate. */
export class AuthError extends Error {
  override readonly name = "AuthError"

  constructor(public readonly code: AuthErrorCode) {
    super(code)
  }
}

//better-auth answers with its own code strings; this is the one place that knows
//them, so the form deals in this app's vocabulary instead.
function toAuthErrorCode(code: string | undefined): AuthErrorCode {
  switch (code) {
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

//the client SDK returns failures rather than throwing them, and every caller
//here wants a throw so mutations behave like mutations
function throwOnError(result: { error?: { code?: string } | null }): void {
  if (result.error) throw new AuthError(toAuthErrorCode(result.error.code))
}

//---- the three things a player can do ------------------------------

export type Credentials = {
  username: string
  password: string
}

export async function signUp(credentials: Credentials): Promise<void> {
  const result = await authClient.signUp.email({
    username: credentials.username,
    //what they typed, casing intact — this is the name the game shows
    displayUsername: credentials.username,
    //better-auth requires both, and neither is ever shown or used
    name: credentials.username,
    email: derivedEmailFor(credentials.username),
    password: credentials.password,
  })
  throwOnError(result)
}

export async function signIn(credentials: Credentials): Promise<void> {
  const result = await authClient.signIn.username({
    username: credentials.username,
    password: credentials.password,
  })
  throwOnError(result)
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
