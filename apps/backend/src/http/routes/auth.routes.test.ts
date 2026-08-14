import { env } from "cloudflare:workers"
import { eq } from "drizzle-orm"
import { beforeAll, describe, expect, it } from "vitest"
import { user } from "@/database/auth.schema"
import { getDb } from "@/database/client"
import { profiles } from "@/database/schema"
import worker from "@/entrypoint"
import { envRegistry } from "@/env/registry"

//drive the mounted better-auth handler end to end against the real local D1.
//we do not re-test better-auth itself — what these cover is the wiring only this
//repo owns: the native scrypt override actually verifying its own hashes, the
//derived email a client cannot choose, and the profiles row a new user gets.

//only the fields these tests read — better-auth's own response type is not
//worth importing to assert two strings.
type AuthResponseBody = {
  user?: { username?: string; displayUsername?: string }
}

describe("auth routes", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  async function post(path: string, body: unknown) {
    const response = await worker.fetch(
      new Request(`http://example.com${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://example.com",
          "x-test-bypass": "true",
        },
        body: JSON.stringify(body),
      }),
      env as never,
      {} as ExecutionContext,
    )
    return {
      response,
      body: (await response.json()) as AuthResponseBody,
    }
  }

  //what the sign-up form will send: the player types a username and a password,
  //and the client fills the two fields better-auth requires but this app has no
  //concept of. the email is overwritten server-side regardless (see below).
  function signUp(username: string, password: string, email?: string) {
    return post("/api/v1/auth/sign-up/email", {
      username,
      name: username,
      email: email ?? `${username.toLowerCase()}@users.abalone.invalid`,
      password,
    })
  }

  //---- sign-up ----------------

  it("signs a new player up and hands back a bearer token", async () => {
    const { response, body } = await signUp("Kasparov", "correct-horse")

    expect(response.status).toBe(200)
    expect(body.user?.username).toBe("kasparov")
    expect(body.user?.displayUsername).toBe("Kasparov")
    expect(response.headers.get("set-auth-token")).toBeTruthy()
  })

  it("mirrors the new user into a profiles row with no avatar", async () => {
    await signUp("mirrored", "correct-horse")
    const db = getDb(env.DB)

    const created = await db
      .select()
      .from(user)
      .where(eq(user.username, "mirrored"))
      .get()
    const profile = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, created?.id ?? ""))
      .get()

    expect(profile?.avatarKey).toBeNull()
  })

  it("derives the email from the username, ignoring the one sent", async () => {
    await signUp("derived", "correct-horse", "attacker@example.com")

    const created = await getDb(env.DB)
      .select()
      .from(user)
      .where(eq(user.username, "derived"))
      .get()

    expect(created?.email).toBe("derived@users.abalone.invalid")
  })

  it("refuses a username that is already taken", async () => {
    await signUp("duplicate", "correct-horse")
    const { response } = await signUp("DUPLICATE", "another-password")

    expect(response.status).toBe(400)
  })

  //---- sign-in ----------------

  it("signs in with the username and resolves the session", async () => {
    await signUp("returning", "correct-horse")

    const signedIn = await post("/api/v1/auth/sign-in/username", {
      username: "returning",
      password: "correct-horse",
    })
    expect(signedIn.response.status).toBe(200)

    const token = signedIn.response.headers.get("set-auth-token")
    const session = await worker.fetch(
      new Request("http://example.com/api/v1/auth/get-session", {
        headers: {
          authorization: `Bearer ${token}`,
          "x-test-bypass": "true",
        },
      }),
      env as never,
      {} as ExecutionContext,
    )

    expect(session.status).toBe(200)
    const resolved = (await session.json()) as AuthResponseBody
    expect(resolved.user?.username).toBe("returning")
  })

  it("is case insensitive about the username at sign-in", async () => {
    await signUp("MixedCase", "correct-horse")

    const { response } = await post("/api/v1/auth/sign-in/username", {
      username: "mIXEDcASE",
      password: "correct-horse",
    })

    expect(response.status).toBe(200)
  })

  it("rejects the wrong password", async () => {
    await signUp("guarded", "correct-horse")

    const { response } = await post("/api/v1/auth/sign-in/username", {
      username: "guarded",
      password: "wrong-horse",
    })

    expect(response.status).toBe(401)
  })

  it("rejects a username that was never registered", async () => {
    const { response } = await post("/api/v1/auth/sign-in/username", {
      username: "nobody",
      password: "correct-horse",
    })

    expect(response.status).toBe(401)
  })
})
