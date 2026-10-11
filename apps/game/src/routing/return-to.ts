/**
 * Where signing in may send someone afterwards.
 *
 * A closed set of tokens rather than a validated path: `?redirect=` is a
 * parameter a stranger can write, and this is what makes "send them where they
 * were going" impossible to turn into "send them anywhere". A game is in the set
 * because being asked to sign in and then landing somewhere other than the board
 * you followed a link to is the same as losing the link.
 *
 * A token, not a path, because one of these destinations is not a route: the
 * invite composer is an overlay on the hub, so "go there" means the hub plus a
 * search parameter. Mapping tokens to navigation options here keeps that split
 * in the one file that already knows which destinations are allowed at all.
 *
 * The two tokens that carry anything are a game and an invite link, and what
 * they carry is checked to be an id rather than a path. `/online/../../evil`
 * never matches.
 */

const FIXED_ROUTES = {
  "/": { to: "/" },
  "/online": { to: "/online" },
  /** The hub, with the invite composer already open over it. */
  "/invite": { to: "/online", search: { invite: "new" } },
  "/online/history": { to: "/online/history", search: { page: 1 } },
} as const satisfies Record<string, { to: string; search?: object }>

type FixedRoute = keyof typeof FIXED_ROUTES

const GAME_PATH =
  /^\/online\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

//an invite link's token: 32 random bytes as base64url, no padding. signing up
//from a link has to land back on it, or the invite is lost on the way through
const INVITE_LINK_PATH = /^\/invite\/([A-Za-z0-9_-]{43})$/

export type ReturnTo =
  | FixedRoute
  | `/online/${string}`
  | `/invite/${string}`

/** The front door: where a sign-in with nowhere else to be ends up. */
export const DEFAULT_RETURN_TO: ReturnTo = "/"

export function parseReturnTo(value: unknown): ReturnTo | undefined {
  if (typeof value !== "string") return undefined
  if (value in FIXED_ROUTES) return value as FixedRoute
  if (GAME_PATH.test(value)) return value as ReturnTo
  return INVITE_LINK_PATH.test(value) ? (value as ReturnTo) : undefined
}

/**
 * A checked destination as router navigation options.
 *
 * A game and an invite link are parameterised routes, so neither can be handed
 * to `navigate` as the path it reads as; the composer is a search parameter rather than a path at
 * all. Both are resolved here so every caller stays typed.
 */
export function returnToOptions(returnTo: ReturnTo) {
  const game = returnTo.match(GAME_PATH)
  if (game) {
    return {
      to: "/online/$gameId",
      params: { gameId: game[1] },
    } as const
  }
  const inviteLink = returnTo.match(INVITE_LINK_PATH)
  if (inviteLink) {
    return {
      to: "/invite/$linkId",
      params: { linkId: inviteLink[1] },
    } as const
  }
  return FIXED_ROUTES[returnTo as FixedRoute]
}
