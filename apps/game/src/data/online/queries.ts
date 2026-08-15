import { queryOptions } from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"
import { api, withClientRequest } from "@/data/backend-client"

//---- shapes ----------------
//read off the rpc contract rather than written out again here. a field added to
//a game on the server arrives in this app as soon as it typechecks, and one
//removed becomes a compile error at whatever was reading it.

type Success<Endpoint> = Extract<
  InferResponseType<Endpoint>,
  { status: "success" }
>

/** An invite as either side of it sees it. */
export type Invite = Success<
  typeof api.api.v1.invites.$get
>["data"]["invites"][number]

/** Where a game stands, and who is playing it. */
export type Game = Success<
  typeof api.api.v1.games.$get
>["data"]["games"][number]

/** One ply, and the position it reached. */
export type GameMove = Success<
  (typeof api.api.v1.games)[":id"]["moves"]["$get"]
>["data"]["moves"][number]

/** The two lists a player's games fall into. */
export type GameStatus = "active" | "finished"

//---- keys ----------------

export const onlineKeys = {
  invites: ["online", "invites"] as const,
  games: (status: GameStatus) => ["online", "games", status] as const,
  game: (gameId: string) => ["online", "game", gameId] as const,
  moves: (gameId: string) => ["online", "game", gameId, "moves"] as const,
}

//an invite arrives while nobody is looking at anything, so the list checks for
//itself. slow enough not to be a heartbeat, quick enough that accepting a game
//somebody just offered does not need a reload.
const INVITE_POLL_MS = 15_000

//---- reads ----------------

/** Every invite the player is party to, sent or received. */
export const invitesQueryOptions = queryOptions({
  queryKey: onlineKeys.invites,
  queryFn: async ({ signal }) => {
    const response = await withClientRequest(() =>
      api.api.v1.invites.$get({}, { init: { signal } }),
    )
    const body = await response.json()
    if (body.status !== "success") throw new Error(body.error_code)
    return body.data.invites
  },
  staleTime: INVITE_POLL_MS,
  refetchInterval: INVITE_POLL_MS,
})

/**
 * The player's games on one side of the line.
 *
 * A finished game never changes again, so the two halves of this are cached
 * quite differently: the active list keeps looking, and history is asked for
 * once and then believed.
 */
export function gamesQueryOptions(status: GameStatus) {
  const isFinished = status === "finished"

  return queryOptions({
    queryKey: onlineKeys.games(status),
    queryFn: async ({ signal }) => {
      const response = await withClientRequest(() =>
        api.api.v1.games.$get({ query: { status } }, { init: { signal } }),
      )
      const body = await response.json()
      if (body.status !== "success") throw new Error(body.error_code)
      return body.data.games
    },
    staleTime: isFinished ? Number.POSITIVE_INFINITY : INVITE_POLL_MS,
    refetchInterval: isFinished ? false : INVITE_POLL_MS,
  })
}

/**
 * Where one game stands. The row the board polls.
 *
 * How long it stays fresh is the board's to say, not this module's — a finished
 * game is never worth asking about again, and that rule lives next to the poll
 * interval that is the other half of it.
 */
export function gameQueryOptions(gameId: string) {
  return queryOptions({
    queryKey: onlineKeys.game(gameId),
    queryFn: async ({ signal }) => {
      const response = await withClientRequest(() =>
        api.api.v1.games[":id"].$get(
          { param: { id: gameId } },
          { init: { signal } },
        ),
      )
      const body = await response.json()
      if (body.status !== "success") throw new Error(body.error_code)
      return body.data.game
    },
  })
}

/**
 * Every ply of a game, the opening included.
 *
 * Never polled, and never stale on its own account. The game row carries
 * `moveCount`, so the cheap request is the one that learns whether there is
 * anything new, and this one runs only once that number has moved — which the
 * board asks for by hand. A timer here would fetch the whole history to find
 * out what a number already said.
 */
export function gameMovesQueryOptions(gameId: string) {
  return queryOptions({
    queryKey: onlineKeys.moves(gameId),
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async ({ signal }) => {
      const response = await withClientRequest(() =>
        api.api.v1.games[":id"].moves.$get(
          { param: { id: gameId } },
          { init: { signal } },
        ),
      )
      const body = await response.json()
      if (body.status !== "success") throw new Error(body.error_code)
      return body.data.moves
    },
  })
}
