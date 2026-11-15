import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { authClient } from "@/data/auth/auth-client"
import { getBearerToken, writeToken } from "@/data/auth/token"
import { stubMemoryStorage } from "@/test-support/memory-storage"

//better-auth's client takes hold of `fetch` when it is built, at import, so the
//stand-in goes in before any import runs and each test says what it answers
const network = vi.hoisted(() => {
  const state: {
    answer: (request: { url: string; headers: Headers }) => Response
    sent: Array<{ url: string; headers: Headers }>
  } = {
    answer: () => {
      throw new TypeError("no answer arranged")
    },
    sent: [],
  }
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const request = {
      url: String((input as Request).url ?? input),
      headers: new Headers(
        (input as Request).headers ?? init?.headers ?? {},
      ),
    }
    state.sent.push(request)
    return state.answer(request)
  }) as typeof fetch
  return state
})

//the token half of the auth client: the bearer goes out on every call, a
//`set-auth-token` reply is stashed, and a dead token is dropped on the first
//notice this device gets. a 503 or a dropped connection says nothing about
//the token and must change nothing.

function reply(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  })
}

const SESSION = { user: { id: "u1" }, session: { id: "s1" } }

describe("authClient token handling", () => {
  beforeEach(() => {
    stubMemoryStorage()
    network.sent = []
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("sends the stored token as a bearer on every call", async () => {
    writeToken("tok")
    network.answer = () => reply(200, SESSION)

    await authClient.getSession()

    expect(network.sent).toHaveLength(1)
    expect(network.sent[0]?.url).toContain("/api/v1/auth/get-session")
    expect(network.sent[0]?.headers.get("authorization")).toBe(
      "Bearer tok",
    )
  })

  it("stashes the token a reply hands back", async () => {
    network.answer = () =>
      reply(200, SESSION, { "set-auth-token": "fresh" })

    await authClient.getSession()

    expect(getBearerToken()).toBe("fresh")
  })

  it("keeps the token while the session read comes back with a user", async () => {
    writeToken("tok")
    network.answer = () => reply(200, SESSION)

    await authClient.getSession()

    expect(getBearerToken()).toBe("tok")
  })

  it("drops the token when a session read comes back empty", async () => {
    writeToken("expired")
    network.answer = () => reply(200, null)

    await authClient.getSession()

    expect(getBearerToken()).toBe("")
  })

  it("keeps a newer token when the empty read was for an older one", async () => {
    writeToken("old")
    network.answer = () => {
      //a sign-in lands while this read is still in flight
      writeToken("new")
      return reply(200, null)
    }

    await authClient.getSession()

    expect(getBearerToken()).toBe("new")
  })

  it("does not treat an empty answer to any other call as a dead token", async () => {
    writeToken("tok")
    network.answer = () => reply(200, null)

    await authClient.$fetch("/some-other-call")

    expect(getBearerToken()).toBe("tok")
  })

  it("ends the session when a session read is refused with a 401", async () => {
    writeToken("revoked")
    localStorage.setItem("abalone.profile", '{"username":"ada"}')
    network.answer = () => reply(401, { message: "unauthorized" })

    await authClient.getSession()

    expect(getBearerToken()).toBe("")
    expect(localStorage.getItem("abalone.profile")).toBeNull()
  })

  it("leaves the session alone on a 503", async () => {
    writeToken("tok")
    localStorage.setItem("abalone.profile", '{"username":"ada"}')
    network.answer = () => reply(503, { message: "unavailable" })

    await authClient.getSession()

    expect(getBearerToken()).toBe("tok")
    expect(localStorage.getItem("abalone.profile")).not.toBeNull()
  })

  it("leaves the session alone when another call is refused with a 401", async () => {
    writeToken("tok")
    network.answer = () => reply(401, { message: "unauthorized" })

    await authClient.$fetch("/some-other-call")

    expect(getBearerToken()).toBe("tok")
  })

  it("does not end a session whose token was replaced since the refused read", async () => {
    writeToken("old")
    network.answer = () => {
      writeToken("new")
      return reply(401, { message: "unauthorized" })
    }

    await authClient.getSession()

    expect(getBearerToken()).toBe("new")
  })
})
