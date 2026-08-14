/**
 * Where the login screen may send someone afterwards.
 *
 * A closed list rather than a validated path: `?redirect=` is a parameter a
 * stranger can write, and the whitelist is what makes "send them where they were
 * going" impossible to turn into "send them anywhere". It is also what keeps the
 * value a route the router knows, so `navigate({ to })` stays typed.
 */
export const RETURN_TO_ROUTES = ["/", "/game/online"] as const

export type ReturnTo = (typeof RETURN_TO_ROUTES)[number]

/** The front door: where a sign-in with nowhere else to be ends up. */
export const DEFAULT_RETURN_TO: ReturnTo = "/"

export function parseReturnTo(value: unknown): ReturnTo | undefined {
  return RETURN_TO_ROUTES.find((route) => route === value)
}
