import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { act, createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Game, Invite } from "@/data/online/queries"
import { onlineKeys } from "@/data/online/queries"
import { useOnlineHome } from "@/hooks/use-online-home"
import { renderHook } from "@/test-support/render-hook"

//the server, as far as the hook can tell: what the three lists answer with and
//what each row action gets back. the hook and the query cache are real.
const server = vi.hoisted(() => ({
  invites: [] as unknown[],
  active: [] as unknown[],
  finished: [] as unknown[],
  accept: null as null | ((inviteId: string) => Promise<unknown>),
  decline: null as null | ((inviteId: string) => Promise<unknown>),
  remove: null as null | ((inviteId: string) => Promise<unknown>),
  send: null as null | ((input: unknown) => Promise<unknown>),
  connected: true,
  listFailure: null as Error | null,
}))

vi.mock("@/data/online/queries", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("@/data/online/queries")>()
  const { queryOptions } = await import("@tanstack/react-query")
  return {
    ...real,
    invitesQueryOptions: queryOptions({
      queryKey: real.onlineKeys.invites,
      queryFn: async () => {
        if (server.listFailure) throw server.listFailure
        return server.invites as Invite[]
      },
    }),
    gamesQueryOptions: (status: "active" | "finished") =>
      queryOptions({
        queryKey: real.onlineKeys.games(status),
        queryFn: async () => {
          if (server.listFailure) throw server.listFailure
          return (
            status === "active" ? server.active : server.finished
          ) as Game[]
        },
      }),
  }
})

vi.mock("@/data/online/mutations", () => ({
  sendInviteMutationOptions: {
    mutationFn: (input: unknown) => server.send?.(input),
  },
  acceptInviteMutationOptions: {
    mutationFn: (inviteId: string) => server.accept?.(inviteId),
  },
  declineInviteMutationOptions: {
    mutationFn: (inviteId: string) => server.decline?.(inviteId),
  },
  removeInviteMutationOptions: {
    mutationFn: (inviteId: string) => server.remove?.(inviteId),
  },
}))

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: "me" } }),
}))
vi.mock("@/providers/realtime-provider", () => ({
  useRealtime: () => ({ isConnected: server.connected }),
}))
vi.mock("@/hooks/use-api-error", () => ({
  useApiError: () => (error: unknown) =>
    `said:${(error as Error).message}`,
}))

function invite(
  id: string,
  fromUserId: string,
  toUserId: string,
  createdAt: number,
): Invite {
  return {
    id,
    createdAt,
    from: { userId: fromUserId },
    to: { userId: toUserId },
  } as unknown as Invite
}

function game(id: string, opponentName: string, updatedAt: number): Game {
  return {
    id,
    updatedAt,
    black: { userId: "me", name: "Me", avatarUrl: null },
    white: {
      userId: `id-${opponentName}`,
      name: opponentName,
      avatarUrl: null,
    },
  } as unknown as Game
}

/** Lets queries land and effects run. */
async function settle() {
  for (let round = 0; round < 8; round++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve))
    })
  }
}

const mounted: { unmount: () => void }[] = []

function mountHome() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const hook = renderHook(
    () => useOnlineHome(queryClient),
    ({ children }: { children: ReactNode }) =>
      createElement(
        QueryClientProvider,
        { client: queryClient },
        children,
      ),
  )
  mounted.push(hook)
  return { hook, queryClient }
}

describe("useOnlineHome", () => {
  beforeEach(() => {
    server.invites = []
    server.active = []
    server.finished = []
    server.accept = null
    server.decline = null
    server.remove = null
    server.send = null
    server.connected = true
    server.listFailure = null
  })

  afterEach(() => {
    for (const hook of mounted.splice(0)) hook.unmount()
  })

  describe("the lists", () => {
    it("is empty before anything has arrived", () => {
      const { hook } = mountHome()
      expect(hook.current.activeGames).toEqual([])
      expect(hook.current.finishedGames).toEqual([])
      expect(hook.current.received).toEqual([])
      expect(hook.current.sent).toEqual([])
      expect(hook.current.recentOpponents).toBeUndefined()
    })

    it("splits invites into the ones sent to me and the ones I sent", async () => {
      server.invites = [
        invite("in", "them", "me", 1),
        invite("out", "me", "them", 2),
        invite("elsewhere", "a", "b", 3),
      ]
      const { hook } = mountHome()
      await settle()

      expect(hook.current.received.map((row) => row.id)).toEqual(["in"])
      expect(hook.current.sent.map((row) => row.id)).toEqual(["out"])
    })

    //the server hands them over oldest first, which buries the one just sent
    it("lists sent invites newest first", async () => {
      server.invites = [
        invite("old", "me", "them", 1),
        invite("new", "me", "them", 9),
        invite("middle", "me", "them", 5),
      ]
      const { hook } = mountHome()
      await settle()

      expect(hook.current.sent.map((row) => row.id)).toEqual([
        "new",
        "middle",
        "old",
      ])
    })

    it("hands over both game lists", async () => {
      server.active = [game("a", "Ana", 5)]
      server.finished = [game("f", "Rui", 3)]
      const { hook } = mountHome()
      await settle()

      expect(hook.current.activeGames.map((row) => row.id)).toEqual(["a"])
      expect(hook.current.finishedGames.map((row) => row.id)).toEqual([
        "f",
      ])
    })

    it("offers recent opponents once both lists are in, newest first", async () => {
      server.active = [game("a", "Ana", 5)]
      server.finished = [game("f", "Rui", 9)]
      const { hook } = mountHome()
      await settle()

      expect(hook.current.recentOpponents?.map((row) => row.name)).toEqual(
        ["Rui", "Ana"],
      )
    })

    //typing a name works without the chips, so no spinner that never ends
    it("settles recent opponents as empty when the lists cannot be read", async () => {
      server.listFailure = new Error("network_unreachable")
      const { hook } = mountHome()
      await settle()

      expect(hook.current.recentOpponents).toEqual([])
    })
  })

  describe("polling", () => {
    function pollingOf(queryClient: QueryClient) {
      const query = queryClient
        .getQueryCache()
        .find({ queryKey: onlineKeys.invites })
      return query?.observers[0]?.options.refetchInterval
    }

    //the channel says when a list moved, so the timer is only the fallback
    it("does not poll while the realtime channel is up", async () => {
      server.connected = true
      const { queryClient } = mountHome()
      await settle()
      expect(pollingOf(queryClient)).toBe(false)
    })

    it("polls again when the channel is down", async () => {
      server.connected = false
      const { queryClient } = mountHome()
      await settle()
      expect(pollingOf(queryClient)).toBe(15_000)
    })
  })

  describe("errors", () => {
    it("has no error while everything works", async () => {
      const { hook } = mountHome()
      await settle()
      expect(hook.current.error).toBeUndefined()
      expect(hook.current.composeError).toBeUndefined()
    })

    it("translates a list that failed", async () => {
      server.listFailure = new Error("service_unavailable")
      const { hook } = mountHome()
      await settle()

      expect(hook.current.error).toBe("said:service_unavailable")
    })

    it("puts a failed send under the composer, not in the page's one slot", async () => {
      server.send = async () => {
        throw new Error("player_not_found")
      }
      const { hook } = mountHome()
      await settle()

      act(() => hook.current.send({} as never, vi.fn()))
      await settle()

      expect(hook.current.composeError).toBe("said:player_not_found")
      expect(hook.current.error).toBeUndefined()
    })

    it("reports a failed row action in the page's slot", async () => {
      server.decline = async () => {
        throw new Error("not_found")
      }
      const { hook } = mountHome()
      await settle()

      act(() => hook.current.decline("i1"))
      await settle()

      expect(hook.current.error).toBe("said:not_found")
    })
  })

  describe("row actions", () => {
    it("refetches invites after a decline", async () => {
      server.invites = [invite("i1", "them", "me", 1)]
      server.decline = async () => ({ id: "i1" })
      const { hook } = mountHome()
      await settle()
      expect(hook.current.received).toHaveLength(1)

      server.invites = []
      act(() => hook.current.decline("i1"))
      await settle()

      expect(hook.current.received).toEqual([])
    })

    it("refetches invites after taking one back", async () => {
      server.invites = [invite("i1", "me", "them", 1)]
      server.remove = async () => undefined
      const { hook } = mountHome()
      await settle()
      expect(hook.current.sent).toHaveLength(1)

      server.invites = []
      act(() => hook.current.remove("i1"))
      await settle()

      expect(hook.current.sent).toEqual([])
    })

    it("refetches invites after sending one and tells the caller", async () => {
      server.send = async () => ({ id: "new" })
      const { hook } = mountHome()
      await settle()
      const onSent = vi.fn()

      server.invites = [invite("new", "me", "them", 1)]
      act(() => hook.current.send({} as never, onSent))
      await settle()

      expect(onSent).toHaveBeenCalledTimes(1)
      expect(hook.current.sent.map((row) => row.id)).toEqual(["new"])
    })

    //saying yes ends an invite and starts a game: both lists move, and the new
    //row is seeded so the board it opens paints at once
    it("seeds the opened game, refetches both lists and hands it to the caller", async () => {
      server.invites = [invite("i1", "them", "me", 1)]
      const opened = game("g1", "Ana", 7)
      server.accept = async () => opened
      const { hook, queryClient } = mountHome()
      await settle()

      server.invites = []
      server.active = [opened]
      const onOpened = vi.fn()
      act(() => hook.current.accept("i1", onOpened))
      await settle()

      //react-query passes the variables and context along after the game
      expect(onOpened.mock.calls[0]?.[0]).toEqual(opened)
      expect(queryClient.getQueryData(onlineKeys.game("g1"))).toEqual(
        opened,
      )
      expect(hook.current.received).toEqual([])
      expect(hook.current.activeGames.map((row) => row.id)).toEqual(["g1"])
    })

    it("says which row action is in flight, and clears it after", async () => {
      server.invites = [invite("i1", "them", "me", 1)]
      let finish: (value: unknown) => void = () => {}
      server.decline = () =>
        new Promise((resolve) => {
          finish = resolve
        })
      const { hook } = mountHome()
      await settle()
      expect(hook.current.pendingInvite).toBeNull()
      expect(hook.current.isBusy).toBe(false)

      act(() => hook.current.decline("i1"))
      await settle()

      expect(hook.current.pendingInvite).toEqual({
        inviteId: "i1",
        action: "decline",
      })
      expect(hook.current.isBusy).toBe(true)

      await act(async () => finish({ id: "i1" }))
      await settle()

      expect(hook.current.pendingInvite).toBeNull()
      expect(hook.current.isBusy).toBe(false)
    })

    it("says a send is in flight without calling the page busy", async () => {
      let finish: (value: unknown) => void = () => {}
      server.send = () =>
        new Promise((resolve) => {
          finish = resolve
        })
      const { hook } = mountHome()
      await settle()

      act(() => hook.current.send({} as never, vi.fn()))
      await settle()

      expect(hook.current.isSending).toBe(true)
      expect(hook.current.isBusy).toBe(false)

      await act(async () => finish({ id: "x" }))
      await settle()
      expect(hook.current.isSending).toBe(false)
    })
  })
})
