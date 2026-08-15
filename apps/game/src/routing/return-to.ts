/**
 * Where the login screen may send someone afterwards.
 *
 * A closed set of shapes rather than a validated path: `?redirect=` is a
 * parameter a stranger can write, and this is what makes "send them where they
 * were going" impossible to turn into "send them anywhere". A game is in the set
 * because being asked to sign in and then landing somewhere other than the board
 * you followed a link to is the same as losing the link.
 *
 * The one shape that carries anything is a game, and what it carries is checked
 * to be an id rather than a path. `/game/online/../../evil` never matches.
 */

const FIXED_ROUTES = ["/", "/game/online"] as const

type FixedRoute = (typeof FIXED_ROUTES)[number]

const GAME_PATH =
  /^\/game\/online\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

export type ReturnTo = FixedRoute | `/game/online/${string}`

/** The front door: where a sign-in with nowhere else to be ends up. */
export const DEFAULT_RETURN_TO: ReturnTo = "/"

export function parseReturnTo(value: unknown): ReturnTo | undefined {
  if (typeof value !== "string") return undefined
  const fixed = FIXED_ROUTES.find((route) => route === value)
  if (fixed) return fixed
  return GAME_PATH.test(value) ? (value as ReturnTo) : undefined
}

/**
 * A checked destination as router navigation options.
 *
 * A game is a parameterised route, so it cannot be handed to `navigate` as the
 * path it reads as. Splitting it here keeps every caller typed and keeps the
 * split in the one file that knows which paths are allowed at all.
 */
export function returnToOptions(returnTo: ReturnTo) {
  const game = returnTo.match(GAME_PATH)
  if (game) {
    return {
      to: "/game/online/$gameId",
      params: { gameId: game[1] },
    } as const
  }
  return { to: returnTo as FixedRoute } as const
}
