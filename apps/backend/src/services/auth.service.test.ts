import { env } from "cloudflare:workers"
import { eq } from "drizzle-orm"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { user } from "@/database/auth.schema"
import { getDb } from "@/database/client"
import { profiles } from "@/database/schema"
import { envRegistry } from "@/env/registry"
import { AuthService, resetAuthForTests } from "@/services/auth.service"
import { failingD1 } from "@/test-support/failing-bindings"

/**
 * The service half of auth: resolving a session, D1 failing underneath it, and
 * the dev origin policy that only switches on with a private frontend. The
 * route tests drive sign-in and sign-up over the worker with public origins.
 */
describe("auth service", () => {
  const db = getDb(env.DB)

  function useFrontends(frontendUrls: string) {
    envRegistry.setEnv({
      ...(env as unknown as Record<string, unknown>),
      FRONTEND_URLS: frontendUrls,
    })
    //the better-auth instance reads its trusted origins once, when it is built
    resetAuthForTests()
  }

  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  afterEach(() => {
    useFrontends(env.FRONTEND_URLS)
  })

  function signUp(
    body: Record<string, unknown>,
    origin = "http://example.com",
  ) {
    return new AuthService(db).handler(
      new Request("http://example.com/api/v1/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({ password: "correct-horse", ...body }),
      }),
    )
  }

  async function signedUpToken(username: string): Promise<string> {
    const response = await signUp({
      username,
      name: username,
      email: `${username}@users.abalone.invalid`,
    })
    expect(response.status).toBe(200)
    return response.headers.get("set-auth-token") ?? ""
  }

  //---- resolving the session ----------------

  it("resolves no headers to a guest", async () => {
    const { user: found } = await new AuthService(db).getSession(
      new Headers(),
    )

    expect(found).toBeNull()
  })

  it("resolves a token nobody issued to a guest", async () => {
    const { user: found } = await new AuthService(db).getSession(
      new Headers({ authorization: "Bearer not-a-real-token" }),
    )

    expect(found).toBeNull()
  })

  it("resolves a bearer token to the player, casing of the name intact", async () => {
    const token = await signedUpToken("CasedName")

    const { user: found } = await new AuthService(db).getSession(
      new Headers({ authorization: `Bearer ${token}` }),
    )

    expect(found).toMatchObject({
      username: "casedname",
      displayUsername: "CasedName",
    })
    expect(found?.id).toEqual(expect.any(String))
  })

  it("answers service_unavailable rather than guest when D1 is down", async () => {
    const token = await signedUpToken("blipped")
    const broken = new AuthService(getDb(failingD1()))

    await expect(
      broken.getSession(new Headers({ authorization: `Bearer ${token}` })),
    ).rejects.toMatchObject({ errorCode: "service_unavailable" })
  })

  //---- the user create hooks ----------------

  it("keeps the email a sign-up without a username sent", async () => {
    const response = await signUp({
      name: "No Handle",
      email: "no-handle@users.abalone.invalid",
    })
    expect(response.status).toBe(200)

    const created = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.email, "no-handle@users.abalone.invalid"))
      .get()
    expect(created).toBeDefined()

    //every new user still gets its profile row
    const profile = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, created?.id ?? ""))
      .get()
    expect(profile?.avatarKey).toBeNull()
  })

  //---- dev origin policy ----------------

  it("trusts a private origin when every frontend is private", async () => {
    useFrontends("http://localhost:7171")

    const response = await signUp(
      {
        username: "lanplayer",
        name: "lanplayer",
        email: "lanplayer@users.abalone.invalid",
      },
      "http://192.168.1.20:7171",
    )

    expect(response.status).toBe(200)
  })

  it("still refuses a public origin in dev mode", async () => {
    useFrontends("http://localhost:7171")

    const response = await signUp(
      {
        username: "outsider",
        name: "outsider",
        email: "outsider@users.abalone.invalid",
      },
      "https://elsewhere.example.org",
    )

    expect(response.status).toBe(403)
  })

  it("refuses a private origin when the frontends are public", async () => {
    const response = await signUp(
      {
        username: "lanblocked",
        name: "lanblocked",
        email: "lanblocked@users.abalone.invalid",
      },
      "http://192.168.1.20:7171",
    )

    expect(response.status).toBe(403)
  })
})
