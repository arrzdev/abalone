import type { InvalidateQueryFilters } from "@tanstack/react-query"
import { QueryClient } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Game } from "@/data/online/queries"
import { onlineKeys } from "@/data/online/queries"
import { applyRealtimeEvent } from "@/data/realtime/invalidate"

//what a beacon is allowed to make the app do. the two players in a game see
//different things from the same event — one of them just acted and one of them
//is finding out — so most of these are about the asymmetry.

const GAME_ID = "3f7b1c60-0000-4000-8000-000000000001"

/** Only the fields the invalidation actually reads. */
function heldGame(updatedAt: number): Game {
  return { id: GAME_ID, updatedAt } as Game
}

describe("applyRealtimeEvent", () => {
  let queryClient: QueryClient
  let invalidate: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    queryClient = new QueryClient()
    invalidate = vi.spyOn(queryClient, "invalidateQueries")
  })

  /** The keys this event asked to be refetched, in order. */
  function invalidatedKeys() {
    return invalidate.mock.calls.map(
      (call: [InvalidateQueryFilters?]) => call[0]?.queryKey,
    )
  }

  //---- news the client does not have ----------------

  it("refetches a game row a newer version was announced for", () => {
    queryClient.setQueryData(onlineKeys.game(GAME_ID), heldGame(1_000))

    applyRealtimeEvent(queryClient, {
      event: "game-updated",
      meta: { gameId: GAME_ID, updatedAt: 2_000 },
    })

    expect(invalidatedKeys()).toEqual([onlineKeys.game(GAME_ID)])
  })

  it("refetches when it is holding nothing for that game", () => {
    applyRealtimeEvent(queryClient, {
      event: "game-updated",
      meta: { gameId: GAME_ID, updatedAt: 2_000 },
    })

    expect(invalidatedKeys()).toEqual([onlineKeys.game(GAME_ID)])
  })

  //---- an echo of this device's own move ----------------
  //THE REGRESSION. every event goes to both seats, so the player who moved is
  //told about their own move — and their mutation already wrote that exact row
  //from the response. without the version check they refetch what they hold, on
  //every single move they make.

  it("ignores a version it already holds", () => {
    queryClient.setQueryData(onlineKeys.game(GAME_ID), heldGame(2_000))

    applyRealtimeEvent(queryClient, {
      event: "game-updated",
      meta: { gameId: GAME_ID, updatedAt: 2_000 },
    })

    expect(invalidate).not.toHaveBeenCalled()
  })

  it("ignores a version older than the one it holds", () => {
    queryClient.setQueryData(onlineKeys.game(GAME_ID), heldGame(5_000))

    applyRealtimeEvent(queryClient, {
      event: "game-updated",
      meta: { gameId: GAME_ID, updatedAt: 2_000 },
    })

    expect(invalidate).not.toHaveBeenCalled()
  })

  //a resignation ends a game without adding a ply, so the move count is the
  //same on both sides of it. this is why the beacon carries the row's timestamp
  //rather than `moveCount` — guarding on the count would leave the opponent's
  //open board never learning the game was over.
  it("refetches a resignation, which adds no move", () => {
    queryClient.setQueryData(onlineKeys.game(GAME_ID), {
      id: GAME_ID,
      updatedAt: 1_000,
      moveCount: 7,
      status: "active",
    } as Game)

    applyRealtimeEvent(queryClient, {
      event: "game-updated",
      meta: { gameId: GAME_ID, updatedAt: 4_000 },
    })

    expect(invalidatedKeys()).toEqual([onlineKeys.game(GAME_ID)])
  })

  //---- what a game beacon must NOT drag down ----------------

  it("leaves the move history alone", () => {
    applyRealtimeEvent(queryClient, {
      event: "game-updated",
      meta: { gameId: GAME_ID, updatedAt: 2_000 },
    })

    //the history is keyed UNDER the row, so a non-exact invalidation would pull
    //every ply down on every beacon and undo the cheap-row/expensive-history
    //split the api was built around
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ exact: true }),
    )
    expect(invalidatedKeys()).not.toContainEqual(onlineKeys.moves(GAME_ID))
  })

  //---- the lists ----------------

  it("refetches the invite list when invites change", () => {
    applyRealtimeEvent(queryClient, { event: "invites-changed" })

    expect(invalidatedKeys()).toEqual([onlineKeys.invites])
  })

  it("refetches both game lists when a game opens or ends", () => {
    applyRealtimeEvent(queryClient, { event: "games-changed" })

    expect(invalidatedKeys()).toEqual([
      onlineKeys.games("active"),
      onlineKeys.games("finished"),
    ])
  })

  it("does not touch a game row when only the lists moved", () => {
    queryClient.setQueryData(onlineKeys.game(GAME_ID), heldGame(1_000))

    applyRealtimeEvent(queryClient, { event: "games-changed" })

    expect(invalidatedKeys()).not.toContainEqual(onlineKeys.game(GAME_ID))
  })
})
