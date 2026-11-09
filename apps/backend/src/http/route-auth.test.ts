import { env } from "cloudflare:workers"
import { inspectRoutes } from "hono/dev"
import { beforeAll, describe, expect, it } from "vitest"
import worker from "@/entrypoint"
import { envRegistry } from "@/env/registry"
import { api } from "@/http/api"
import type { Game } from "@/services/game.service"
import type { Invite } from "@/services/invite.service"
import { newExecutionContext } from "@/test-support/execution-context"

//the auth matrix for the whole api. every route the app registers has to be
//sorted into one of the two lists below, so a new route cannot ship without
//someone deciding whether a signed-out caller may reach it, and every route
//that needs a session is called signed out and has to answer 401.
//
//the route table comes from the app itself (hono's own inspector), never from
//a list kept by hand, so a route nobody remembered still shows up here.

type Envelope<Data> = {
  status: string
  error_code?: string
  data?: Data
}

//---- the two lists ----------------
//keyed `METHOD path`, exactly as the route table spells them

/** Routes a signed-out caller may reach, each with why. */
const PUBLIC_ROUTES: Record<string, string> = {
  "GET /": "uptime probe",
  "GET /api/version": "deployed commit, for drift checks",
  "GET /api/v1/health": "dependency health, for monitoring",
  "GET /api/v1/auth/*": "better-auth: session reads, oauth callbacks",
  "POST /api/v1/auth/*": "better-auth: sign up, sign out, oauth start",
  "POST /api/v1/auth/sign-in/email": "signing in is how a session starts",
  "POST /api/v1/auth/sign-in/username":
    "signing in is how a session starts",
  "GET /api/v1/invite-links/:id":
    "whoever was sent a link sees who sent it before signing in",
  "GET /api/v1/realtime":
    "the socket upgrade, gated by a ticket minted behind a session",
  "POST /api/v1/events/game":
    "anonymous start and finish counts, guests included",
  "GET /api/v1/events/game/recent-starts":
    "the daily production check, a yes or no with no counts",
  "GET /api/v1/avatars/:key{.+}":
    "dev only picture server, not found in production",
  "ALL /*": "the not-found fallback",
}

/** Routes that need a session. A signed-out call answers 401. */
const SIGNED_IN_ROUTES = [
  "GET /api/v1/profile/me",
  "POST /api/v1/profile/me/avatar",
  "GET /api/v1/invites",
  "POST /api/v1/invites",
  "PATCH /api/v1/invites/:id",
  "DELETE /api/v1/invites/:id",
  "POST /api/v1/invite-links",
  "POST /api/v1/invite-links/:id/accept",
  "GET /api/v1/games",
  "POST /api/v1/games",
  "GET /api/v1/games/:id",
  "GET /api/v1/games/:id/moves",
  "POST /api/v1/games/:id/moves",
  "POST /api/v1/games/:id/resignation",
  "POST /api/v1/realtime/ticket",
]

/**
 * Signed-in routes that name a resource by id, and why another user may not
 * act on it. Every signed-in route with a path parameter has to be here, so a
 * new one cannot skip the cross-user check below.
 */
const ID_ROUTES: Record<string, string> = {
  "PATCH /api/v1/invites/:id": "cross-user case below",
  "DELETE /api/v1/invites/:id": "cross-user case below",
  "GET /api/v1/games/:id": "cross-user case below",
  "GET /api/v1/games/:id/moves": "cross-user case below",
  "POST /api/v1/games/:id/moves": "cross-user case below",
  "POST /api/v1/games/:id/resignation": "cross-user case below",
  "POST /api/v1/invite-links/:id/accept":
    "a link is open to whoever holds it, by design (invite-link.routes.test)",
}

/** Every handler the app registers, as `METHOD path`, middleware left out. */
function registeredRoutes(): string[] {
  const keys = inspectRoutes(api)
    .filter((route) => !route.isMiddleware)
    .map((route) => `${route.method} ${route.path}`)
  return [...new Set(keys)].sort()
}

/** A path from the table with its parameters filled in with something. */
function concretePath(path: string): string {
  return path
    .replace(/:\w+(\{[^}]+\})?/g, crypto.randomUUID())
    .replace(/\*/g, "anything")
}

describe("route auth matrix", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  //---- talking to the worker ----------------

  function fetchWorker(request: Request) {
    return worker.fetch(request, env as never, newExecutionContext())
  }

  async function call<Data>(
    method: string,
    path: string,
    token: string | null,
    body?: unknown,
  ) {
    const headers: Record<string, string> = {
      origin: "http://example.com",
      "x-test-bypass": "true",
    }
    if (token) headers.authorization = `Bearer ${token}`
    if (body !== undefined) headers["content-type"] = "application/json"

    const response = await fetchWorker(
      new Request(`http://example.com${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    )
    return {
      response,
      body: (await response.json()) as Envelope<Data>,
    }
  }

  //usernames are unique across the suite, so a counter keeps each cast apart
  let handles = 0
  async function signUp(role: string) {
    handles += 1
    const username = `${role}${handles}`
    const response = await fetchWorker(
      new Request("http://example.com/api/v1/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://example.com",
          "x-test-bypass": "true",
        },
        body: JSON.stringify({
          username,
          name: username,
          email: `${username}@users.abalone.invalid`,
          password: "correct-horse",
        }),
      }),
    )
    const token = response.headers.get("set-auth-token")
    if (!token) throw new Error(`sign up failed for ${username}`)
    return { username, token }
  }

  //---- every route is sorted ----------------

  it("sorts every registered route into public or signed in", () => {
    const sorted = new Set([
      ...Object.keys(PUBLIC_ROUTES),
      ...SIGNED_IN_ROUTES,
    ])
    const unsorted = registeredRoutes().filter((key) => !sorted.has(key))

    expect(
      unsorted,
      "add each route to PUBLIC_ROUTES or SIGNED_IN_ROUTES",
    ).toEqual([])
  })

  it("lists no route the app does not register", () => {
    const registered = new Set(registeredRoutes())
    const listed = [...Object.keys(PUBLIC_ROUTES), ...SIGNED_IN_ROUTES]

    expect(listed.filter((key) => !registered.has(key))).toEqual([])
  })

  it("never lists a route as both public and signed in", () => {
    expect(SIGNED_IN_ROUTES.filter((key) => key in PUBLIC_ROUTES)).toEqual(
      [],
    )
  })

  //---- signed out ----------------

  it.each(SIGNED_IN_ROUTES)(
    "answers %s signed out with 401",
    async (key) => {
      const [method, path] = key.split(" ")
      const body = method === "GET" ? undefined : {}

      const { response, body: envelope } = await call(
        method,
        concretePath(path),
        null,
        body,
      )

      expect(response.status).toBe(401)
      expect(envelope.error_code).toBe("unauthorized")
    },
  )

  it("answers a signed-in route with 401 for a token that is not a session", async () => {
    const { response } = await call("GET", "/api/v1/games", "not-a-token")

    expect(response.status).toBe(401)
  })

  //---- another user's resources ----------------

  it("covers every signed-in route that takes an id", () => {
    const withId = SIGNED_IN_ROUTES.filter((key) => key.includes("/:"))

    expect(withId.filter((key) => !(key in ID_ROUTES))).toEqual([])
  })

  describe("as someone who is not a party", () => {
    //a game between black and white, and an invite from black to a fourth
    //player still waiting. `outsider` is party to neither.
    let black: { username: string; token: string }
    let white: { username: string; token: string }
    let invitee: { username: string; token: string }
    let outsider: { username: string; token: string }
    let game: Game
    let pending: Invite
    let unopened: Invite

    async function invite(from: string, username: string) {
      const { body } = await call<{ invite: Invite }>(
        "POST",
        "/api/v1/invites",
        from,
        { username, setupType: "standard", side: "black" },
      )
      if (!body.data) throw new Error(`invite failed: ${body.error_code}`)
      return body.data.invite
    }

    beforeAll(async () => {
      black = await signUp("black")
      white = await signUp("white")
      invitee = await signUp("invitee")
      outsider = await signUp("outsider")

      const sent = await invite(black.token, white.username)
      const opened = await call<{ game: Game }>(
        "POST",
        "/api/v1/games",
        white.token,
        { inviteId: sent.id },
      )
      if (!opened.body.data)
        throw new Error(`accept failed: ${opened.body.error_code}`)
      game = opened.body.data.game

      pending = await invite(black.token, invitee.username)
      unopened = await invite(white.token, invitee.username)
    })

    //each case: who calls, and what. every one must answer 404 not_found: a
    //resource you are not party to answers the same as one that never existed,
    //so the answer does not even confirm the id is real (http/errors.ts).
    const cases: Array<{
      name: string
      caller: () => string
      method: string
      path: () => string
      body?: () => unknown
    }> = [
      {
        name: "reads another pair's game",
        caller: () => outsider.token,
        method: "GET",
        path: () => `/api/v1/games/${game.id}`,
      },
      {
        name: "reads another pair's moves",
        caller: () => outsider.token,
        method: "GET",
        path: () => `/api/v1/games/${game.id}/moves`,
      },
      {
        name: "plays in another pair's game",
        caller: () => outsider.token,
        method: "POST",
        path: () => `/api/v1/games/${game.id}/moves`,
        body: () => ({
          marbles: ["0,0"],
          destination: "0,1",
          moveIndex: 0,
        }),
      },
      {
        name: "resigns another pair's game",
        caller: () => outsider.token,
        method: "POST",
        path: () => `/api/v1/games/${game.id}/resignation`,
      },
      {
        name: "declines an invite sent to someone else",
        caller: () => outsider.token,
        method: "PATCH",
        path: () => `/api/v1/invites/${pending.id}`,
        body: () => ({ status: "declined" }),
      },
      {
        name: "declines their own outgoing invite",
        caller: () => black.token,
        method: "PATCH",
        path: () => `/api/v1/invites/${pending.id}`,
        body: () => ({ status: "declined" }),
      },
      {
        name: "deletes an invite someone else sent",
        caller: () => outsider.token,
        method: "DELETE",
        path: () => `/api/v1/invites/${pending.id}`,
      },
      {
        name: "deletes an invite as its recipient",
        caller: () => invitee.token,
        method: "DELETE",
        path: () => `/api/v1/invites/${pending.id}`,
      },
      {
        name: "accepts an invite sent to someone else",
        caller: () => outsider.token,
        method: "POST",
        path: () => "/api/v1/games",
        body: () => ({ inviteId: unopened.id }),
      },
      {
        name: "accepts their own outgoing invite",
        caller: () => white.token,
        method: "POST",
        path: () => "/api/v1/games",
        body: () => ({ inviteId: unopened.id }),
      },
    ]

    it.each(cases)("answers 404 when a user $name", async (testCase) => {
      const { response, body } = await call(
        testCase.method,
        testCase.path(),
        testCase.caller(),
        testCase.body?.(),
      )

      expect(response.status).toBe(404)
      expect(body.error_code).toBe("not_found")
    })

    it("leaves the game and both invites as they were", async () => {
      const read = await call<{ game: Game }>(
        "GET",
        `/api/v1/games/${game.id}`,
        black.token,
      )
      expect(read.body.data?.game.status).toBe("active")
      expect(read.body.data?.game.moveCount).toBe(0)

      const listed = await call<{ invites: Invite[] }>(
        "GET",
        "/api/v1/invites",
        invitee.token,
      )
      const ids = listed.body.data?.invites.map((invite) => invite.id)
      expect(ids).toEqual(
        expect.arrayContaining([pending.id, unopened.id]),
      )
    })

    it("lists none of them to the outsider", async () => {
      const games = await call<{ games: Game[] }>(
        "GET",
        "/api/v1/games",
        outsider.token,
      )
      const invites = await call<{ invites: Invite[] }>(
        "GET",
        "/api/v1/invites",
        outsider.token,
      )

      expect(games.body.data?.games).toEqual([])
      expect(invites.body.data?.invites).toEqual([])
    })

    it("answers the profile with the caller's own, never another's", async () => {
      //the profile routes take no id: `/me` is the only profile a user can
      //read or change, so there is no other user's profile to ask for
      const { body } = await call<{ profile: { username: string } }>(
        "GET",
        "/api/v1/profile/me",
        outsider.token,
      )

      expect(body.data?.profile.username).toBe(outsider.username)
    })
  })
})
