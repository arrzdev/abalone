import type { InvalidateQueryFilters } from "@tanstack/react-query"
import { QueryClient } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Game } from "@/data/online/queries"
import { onlineKeys } from "@/data/online/queries"
import { applyRealtimeEvent } from "@/data/realtime/invalidate"

//what a beacon is allowed to make the app do. the two players in a game see
//different things from the same event — one of them just acted and one of them
//is finding out — so most of these are about the asymmetry.

const GAME_ID = "3f7b1c60-0000-4000-8000-000000000001"
const OTHER_GAME_ID = "3f7b1c60-0000-4000-8000-000000000002"

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

  /**
   * Puts a write to a game in flight, as the board's play and resign mutations
   * do. Returns the way to let it answer, so a test can look at both sides.
   */
  function startWrite(gameId: string) {
    //the resolver is taken here rather than inside `mutationFn`, which is not
    //called until `execute` reaches it
    let answer: () => void = () => {}
    const answered = new Promise<void>((resolve) => {
      answer = resolve
    })

    const done = queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationKey: onlineKeys.write(gameId),
        mutationFn: () => answered,
      })
      .execute(undefined)

    return async () => {
      answer()
      await done
    }
  }

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

  //THE OTHER HALF OF IT, and the one the version check cannot cover. the beacon
  //is fanned out in `waitUntil` while the answer to the same request is still on
  //the wire, so an echo routinely lands BEFORE the row it echoes — and the
  //versions then read as news. That refetch races the mutation's own answer for
  //the row, mid-move, which is the flicker.
  it("ignores a beacon for a game this device is writing", async () => {
    queryClient.setQueryData(onlineKeys.game(GAME_ID), heldGame(1_000))
    const settle = startWrite(GAME_ID)

    applyRealtimeEvent(queryClient, {
      event: "game-updated",
      meta: { gameId: GAME_ID, updatedAt: 2_000 },
    })

    expect(invalidate).not.toHaveBeenCalled()
    await settle()
  })

  it("refetches for a game a write is in flight for elsewhere", async () => {
    queryClient.setQueryData(onlineKeys.game(GAME_ID), heldGame(1_000))
    const settle = startWrite(OTHER_GAME_ID)

    applyRealtimeEvent(queryClient, {
      event: "game-updated",
      meta: { gameId: GAME_ID, updatedAt: 2_000 },
    })

    expect(invalidatedKeys()).toEqual([onlineKeys.game(GAME_ID)])
    await settle()
  })

  //the drop lasts exactly as long as the write does. once it has answered, the
  //row it wrote is what tells an echo from news again.
  it("refetches once that write has finished", async () => {
    queryClient.setQueryData(onlineKeys.game(GAME_ID), heldGame(1_000))
    await startWrite(GAME_ID)()

    applyRealtimeEvent(queryClient, {
      event: "game-updated",
      meta: { gameId: GAME_ID, updatedAt: 2_000 },
    })

    expect(invalidatedKeys()).toEqual([onlineKeys.game(GAME_ID)])
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

//the hub keeps every game on screen and has no socket of its own to read. a
//beacon for one game asks the api for that one game and puts the answer where
//the hub already looks, so the list is never fetched again for one move.
describe("applyRealtimeEvent on the hub's lists", () => {
  let queryClient: QueryClient
  let invalidate: ReturnType<typeof vi.spyOn>
  let fetch: ReturnType<typeof vi.fn>

  /** A list entry, with only the fields the hub update reads or writes. */
  function listed(
    id: string,
    updatedAt: number,
    status: "active" | "finished" = "active",
  ): Game {
    return { id, updatedAt, status } as Game
  }

  /** The api answering `GET /games/:id` with `game`. */
  function answerWith(game: Game) {
    fetch.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ status: "success", data: { game } }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
    )
  }

  function requestedPaths() {
    return fetch.mock.calls.map((call: unknown[]) => {
      const target = call[0]
      const url = target instanceof Request ? target.url : String(target)
      return new URL(url).pathname
    })
  }

  function invalidatedKeys() {
    return invalidate.mock.calls.map(
      (call: [InvalidateQueryFilters?]) => call[0]?.queryKey,
    )
  }

  function announce(gameId: string, updatedAt: number) {
    applyRealtimeEvent(queryClient, {
      event: "game-updated",
      meta: { gameId, updatedAt },
    })
  }

  beforeEach(() => {
    queryClient = new QueryClient()
    invalidate = vi.spyOn(queryClient, "invalidateQueries")
    fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("puts the announced game into the active list in place, asking only for that game", async () => {
    queryClient.setQueryData(onlineKeys.games("active"), [
      listed(OTHER_GAME_ID, 3_000),
      listed(GAME_ID, 1_000),
    ])
    answerWith(listed(GAME_ID, 2_000))

    announce(GAME_ID, 2_000)

    await vi.waitFor(() => {
      expect(
        queryClient.getQueryData<Game[]>(onlineKeys.games("active")),
      ).toEqual([listed(OTHER_GAME_ID, 3_000), listed(GAME_ID, 2_000)])
    })
    expect(requestedPaths()).toEqual([`/api/v1/games/${GAME_ID}`])
    expect(invalidatedKeys()).not.toContainEqual(
      onlineKeys.games("active"),
    )
  })

  it("moves a game that ended out of the active list and to the top of the finished one", async () => {
    queryClient.setQueryData(onlineKeys.games("active"), [
      listed(GAME_ID, 1_000),
    ])
    queryClient.setQueryData(onlineKeys.games("finished"), [
      listed(OTHER_GAME_ID, 500, "finished"),
    ])
    answerWith(listed(GAME_ID, 2_000, "finished"))

    announce(GAME_ID, 2_000)

    await vi.waitFor(() => {
      expect(
        queryClient.getQueryData<Game[]>(onlineKeys.games("active")),
      ).toEqual([])
    })
    expect(
      queryClient.getQueryData<Game[]>(onlineKeys.games("finished")),
    ).toEqual([
      listed(GAME_ID, 2_000, "finished"),
      listed(OTHER_GAME_ID, 500, "finished"),
    ])
  })

  it("leaves the list alone for a version it already shows", async () => {
    queryClient.setQueryData(onlineKeys.games("active"), [
      listed(GAME_ID, 2_000),
    ])

    announce(GAME_ID, 2_000)
    await Promise.resolve()

    expect(fetch).not.toHaveBeenCalled()
  })

  it("asks for the whole active list again for a game the list does not have", () => {
    queryClient.setQueryData(onlineKeys.games("active"), [
      listed(OTHER_GAME_ID, 3_000),
    ])

    announce(GAME_ID, 2_000)

    expect(invalidatedKeys()).toContainEqual(onlineKeys.games("active"))
  })

  it("asks for nothing for the list while this device is writing to the game", async () => {
    queryClient.setQueryData(onlineKeys.games("active"), [
      listed(GAME_ID, 1_000),
    ])
    let answer: () => void = () => {}
    const answered = new Promise<void>((resolve) => {
      answer = resolve
    })
    const done = queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationKey: onlineKeys.write(GAME_ID),
        mutationFn: () => answered,
      })
      .execute(undefined)

    announce(GAME_ID, 2_000)
    answer()
    await done

    expect(fetch).not.toHaveBeenCalled()
  })
})
