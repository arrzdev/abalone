import { getBearerToken } from "@/data/auth/token"

//---- Route guard --------------------------------------------------
//whether a navigation has to ask for an account first, and in which shape.
//
//the token rather than a cached session, because the token is the credential:
//no token is a guest with certainty, and a stale cached user would let someone
//through on a session the server has since dropped. a token that turns out to
//be dead fails on the first request instead, which is where a dead token
//should be found out.

/**
 * Whether this navigation must ask for an account first.
 *
 * ONLY A DEVICE CAN ANSWER THIS. The app is a spa, but a hard load still
 * reaches a worker that runs the router to answer the document request — and
 * that worker has no `localStorage`, so the token store there reads empty for
 * everyone. A guard that trusts that answer turns every reload and every
 * pasted link into a 307 to the login page, however signed in the device is,
 * and the client never gets far enough to disagree.
 *
 * So the server declines to judge and serves the shell. The client boots,
 * runs this again with the store it can actually see, and asks only if the
 * device really is a guest.
 */
export function needsSignIn(): boolean {
  if (typeof window === "undefined") return false
  return !getBearerToken()
}

/** How a screen should ask, if it has to ask at all. */
export type SignInPrompt = "none" | "login-screen" | "drawer"

/**
 * Which shape the ask takes on this screen.
 *
 * One rule, wherever the app needs an account: a desktop has room for the login
 * screen and a url worth landing on, so it goes there; a phone gets the form in
 * a drawer over what it was already showing, because a page swap for two fields
 * costs the screen underneath and gives nothing back. `AuthPromptProvider`
 * applies the same split to the asks that start from a tap.
 */
export function signInPrompt(isDesktop: boolean): SignInPrompt {
  if (!needsSignIn()) return "none"
  return isDesktop ? "login-screen" : "drawer"
}
