import { env } from "cloudflare:workers"
import { eq } from "drizzle-orm"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { user } from "@/database/auth.schema"
import { getDb } from "@/database/client"
import { profiles } from "@/database/schema"
import worker from "@/entrypoint"
import { envRegistry } from "@/env/registry"
import { newExecutionContext } from "@/test-support/execution-context"

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
      newExecutionContext(),
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
      newExecutionContext(),
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

//---- the auth standard (stack-auth) ----------------------------------------
//what follows ports the template's proof of the standard onto this repo's
//wiring: better-auth's handler mounted under /api/v1/auth, sessions as bearer
//tokens (the `bearer()` plugin), and the app's own routes behind requireAuth().
//
//these run WITHOUT the x-test-bypass header, so the rate-limit bindings count.
//the bindings keep their counts for the whole run, so every request comes from
//an ip of its own unless a test is about one ip.
//
//time travel is `vi.setSystemTime` on Date only: the worker under test runs in
//this isolate, so better-auth and the lockout read the same clock the test
//moves. the lockout therefore has to take "now" from Date, not from SQL.

type Envelope<Data = unknown> = {
  status: string
  error_code?: string
  data?: Data
}

const PASSWORD = "correct-horse"
const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

let standardIpCounter = 0
function freshIp(): string {
  standardIpCounter++
  return `198.51.${Math.floor(standardIpCounter / 250)}.${(standardIpCounter % 250) + 1}`
}

let usernameCounter = 0
function freshUsername(): string {
  usernameCounter++
  return `std${Date.now() % 100_000}_${usernameCounter}`
}

function derivedEmail(username: string): string {
  return `${username.toLowerCase()}@users.abalone.invalid`
}

//a binding that always lets the request through, so a test about one limiter
//is not decided by another
const allowAll: RateLimit = {
  async limit() {
    return { success: true }
  },
}

type CallInit = {
  method?: string
  body?: unknown
  token?: string | null
  cookie?: string
  ip?: string
  origin?: string
  bypass?: boolean
  bindings?: Record<string, unknown>
}

async function call<Data = unknown>(path: string, init: CallInit = {}) {
  const headers: Record<string, string> = {
    origin: init.origin ?? "http://example.com",
    "content-type": "application/json",
    "cf-connecting-ip": init.ip ?? freshIp(),
  }
  if (init.token) headers.authorization = `Bearer ${init.token}`
  if (init.cookie) headers.cookie = init.cookie
  if (init.bypass) headers["x-test-bypass"] = "true"
  const response = await worker.fetch(
    new Request(`http://example.com${path}`, {
      method: init.method ?? "GET",
      headers,
      body:
        init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
    (init.bindings ? { ...env, ...init.bindings } : env) as never,
    newExecutionContext(),
  )
  const text = await response.text()
  let body: Envelope<Data> | null = null
  try {
    body = JSON.parse(text) as Envelope<Data>
  } catch {
    body = null
  }
  return { response, text, body }
}

//workerd has Headers#getSetCookie(); the type lib in use does not declare it
function setCookiesOf(response: Response): string[] {
  return (
    response.headers as Headers & { getSetCookie: () => string[] }
  ).getSetCookie()
}

//the name=value pairs a browser on the shared origin sends back
function cookieFrom(response: Response): string {
  return setCookiesOf(response)
    .map((cookie) => cookie.split(";")[0])
    .join("; ")
}

/** A fresh player, signed up, with what a device on the shared origin keeps. */
async function signedUpPlayer() {
  const username = freshUsername()
  const { response } = await call("/api/v1/auth/sign-up/email", {
    method: "POST",
    body: {
      username,
      name: username,
      email: derivedEmail(username),
      password: PASSWORD,
    },
    bypass: true,
  })
  expect(response.status).toBe(200)
  const token = response.headers.get("set-auth-token")
  expect(token).toBeTruthy()
  return { username, token: token ?? "", cookie: cookieFrom(response) }
}

function signInUsername(username: string, password: string, ip?: string) {
  return call("/api/v1/auth/sign-in/username", {
    method: "POST",
    body: { username, password },
    ip,
  })
}

function signInEmail(email: string, password: string, ip?: string) {
  return call("/api/v1/auth/sign-in/email", {
    method: "POST",
    body: { email, password },
    ip,
  })
}

//any route behind requireAuth() that reads data: the "next call" of the rules
function readProfile(auth: { token?: string | null; cookie?: string }) {
  return call("/api/v1/profile/me", auth)
}

describe("auth standard", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function revokeSessionsOf(username: string) {
    //what an admin revoke or a sign-out on another device does
    await env.DB.prepare(
      "delete from session where user_id = (select id from user where username = ?)",
    )
      .bind(username.toLowerCase())
      .run()
  }

  //---- revocation: sessions are read from D1 on every request ----------------

  it("refuses a revoked bearer token on the very next data call", async () => {
    const player = await signedUpPlayer()
    expect(
      (await readProfile({ token: player.token })).response.status,
    ).toBe(200)

    await revokeSessionsOf(player.username)

    const after = await readProfile({ token: player.token })
    expect(after.response.status).toBe(401)
    expect(after.body?.error_code).toBe("unauthorized")
  })

  //in production the api shares the game's origin (wrangler.toml routes), so
  //the browser also holds and sends the cookies better-auth sets. with the
  //cookie cache on, its signed session_data cookie keeps a revoked session
  //alive for 5 minutes.
  it("refuses a revoked session on the next call even when the browser sends its cookies", async () => {
    const player = await signedUpPlayer()
    const auth = { token: player.token, cookie: player.cookie }
    expect((await readProfile(auth)).response.status).toBe(200)

    await revokeSessionsOf(player.username)

    const after = await readProfile(auth)
    expect(after.response.status).toBe(401)
    expect(after.body?.error_code).toBe("unauthorized")
    const session = await call("/api/v1/auth/get-session", auth)
    expect(session.text).not.toContain(player.username.toLowerCase())
  })

  it("signs out: the old bearer token is refused afterwards", async () => {
    const player = await signedUpPlayer()
    const signOut = await call("/api/v1/auth/sign-out", {
      method: "POST",
      token: player.token,
    })
    expect(signOut.response.status).toBe(200)

    const after = await readProfile({ token: player.token })
    expect(after.response.status).toBe(401)
  })

  it("signs out: the old token and cookies, replayed, are refused afterwards", async () => {
    const player = await signedUpPlayer()
    const auth = { token: player.token, cookie: player.cookie }
    const signOut = await call("/api/v1/auth/sign-out", {
      method: "POST",
      ...auth,
    })
    expect(signOut.response.status).toBe(200)

    const after = await readProfile(auth)
    expect(after.response.status).toBe(401)
  })

  //---- rate limit: cloudflare bindings ----------------

  it("sheds the 6th sign-in from one ip within 10 s with 429 and Retry-After", async () => {
    const ip = freshIp()
    for (let attempt = 0; attempt < 5; attempt++) {
      //a different unknown player each time, so the lockout stays out of it
      const { response } = await signInUsername(freshUsername(), "x", ip)
      expect(response.status).toBe(401)
    }

    const limited = await signInUsername(freshUsername(), "x", ip)
    expect(limited.response.status).toBe(429)
    expect(limited.body?.error_code).toBe("rate_limit_exceeded")
    expect(
      Number(limited.response.headers.get("Retry-After")),
    ).toBeGreaterThan(0)
  })

  it("puts an ip over 10 failed sign-ins in 60 s in a 10-minute cooldown", async () => {
    const failures = new Map<string, number>()
    const failureLimiter: RateLimit = {
      async limit({ key }) {
        const count = (failures.get(key) ?? 0) + 1
        failures.set(key, count)
        return { success: count <= 10 }
      },
    }
    //only the failure cap is under test: the per-request tiers let it all by
    const bindings = {
      AUTH_RATE_LIMITER: allowAll,
      AUTH_BURST_RATE_LIMITER: allowAll,
      AUTH_SUSTAINED_RATE_LIMITER: allowAll,
      AUTH_FAILURE_RATE_LIMITER: failureLimiter,
    }
    const player = await signedUpPlayer()
    const ip = freshIp()

    //11 failures, each against a different unknown player so no account locks
    for (let attempt = 0; attempt < 11; attempt++) {
      const { response } = await call("/api/v1/auth/sign-in/username", {
        method: "POST",
        body: { username: freshUsername(), password: "wrong" },
        ip,
        bindings,
      })
      expect(response.status).toBe(401)
    }

    const capped = await call("/api/v1/auth/sign-in/username", {
      method: "POST",
      body: { username: player.username, password: PASSWORD },
      ip,
      bindings,
    })
    expect(capped.response.status).toBe(429)
    expect(capped.body?.error_code).toBe("rate_limit_exceeded")
    const retryAfter = Number(capped.response.headers.get("Retry-After"))
    expect(retryAfter).toBeGreaterThan(9 * 60)
    expect(retryAfter).toBeLessThanOrEqual(10 * 60)

    //another ip is not affected
    const other = await call("/api/v1/auth/sign-in/username", {
      method: "POST",
      body: { username: player.username, password: PASSWORD },
      bindings,
    })
    expect(other.response.status).toBe(200)
  })

  //---- per-account lockout ----------------

  it("locks an account after 5 failures from 5 ips: the 6th is 429 even with the right password", async () => {
    const player = await signedUpPlayer()

    for (let attempt = 0; attempt < 5; attempt++) {
      const { response } = await signInUsername(
        player.username,
        `wrong-${attempt}`,
      )
      expect(response.status).toBe(401)
    }

    const locked = await signInUsername(player.username, PASSWORD)
    expect(locked.response.status).toBe(429)
    expect(locked.body).toMatchObject({
      status: "error",
      error_code: "auth_account_locked",
    })
    const retryAfter = Number(locked.response.headers.get("Retry-After"))
    expect(retryAfter).toBeGreaterThan(14 * 60)
    expect(retryAfter).toBeLessThanOrEqual(15 * 60)
    expect(locked.response.headers.get("set-auth-token")).toBeNull()
    expect(setCookiesOf(locked.response)).toEqual([])
  })

  //better-auth's handler is mounted wholesale, so both of its password
  //sign-in endpoints are reachable and both must sit behind the lockout
  it("locks across both sign-in paths: /sign-in/email and /sign-in/username share one count", async () => {
    const player = await signedUpPlayer()
    const email = derivedEmail(player.username)

    for (let attempt = 0; attempt < 5; attempt++) {
      const { response } =
        attempt % 2
          ? await signInEmail(email, "wrong")
          : await signInUsername(player.username, "wrong")
      expect(response.status).toBe(401)
    }

    const byUsername = await signInUsername(player.username, PASSWORD)
    expect(byUsername.response.status).toBe(429)
    expect(byUsername.body?.error_code).toBe("auth_account_locked")
    const byEmail = await signInEmail(email, PASSWORD)
    expect(byEmail.response.status).toBe(429)
    expect(byEmail.body?.error_code).toBe("auth_account_locked")
  })

  it("keys the lockout on the normalized handle", async () => {
    const player = await signedUpPlayer()
    for (let attempt = 0; attempt < 5; attempt++)
      await signInUsername(
        attempt % 2 ? player.username.toUpperCase() : player.username,
        "wrong",
      )
    expect(
      (await signInUsername(player.username, PASSWORD)).response.status,
    ).toBe(429)
  })

  it("unlocks after 15 minutes, and a successful sign-in clears the count", async () => {
    const player = await signedUpPlayer()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(Date.now())

    for (let attempt = 0; attempt < 5; attempt++)
      await signInUsername(player.username, `wrong-${attempt}`)
    expect(
      (await signInUsername(player.username, PASSWORD)).response.status,
    ).toBe(429)

    vi.setSystemTime(Date.now() + 15 * MINUTE + 1_000)
    const unlocked = await signInUsername(player.username, PASSWORD)
    expect(unlocked.response.status).toBe(200)

    //the success deleted the row: 4 more failures do not lock
    for (let attempt = 0; attempt < 4; attempt++)
      await signInUsername(player.username, "wrong")
    expect(
      (await signInUsername(player.username, PASSWORD)).response.status,
    ).toBe(200)
  })

  it("counts 4 failures and then a success as nothing: the count starts over", async () => {
    const player = await signedUpPlayer()
    for (let attempt = 0; attempt < 4; attempt++)
      await signInUsername(player.username, "wrong")
    expect(
      (await signInUsername(player.username, PASSWORD)).response.status,
    ).toBe(200)

    for (let attempt = 0; attempt < 4; attempt++)
      expect(
        (await signInUsername(player.username, "wrong")).response.status,
      ).toBe(401)
    expect(
      (await signInUsername(player.username, PASSWORD)).response.status,
    ).toBe(200)
  })

  it("locks failures split around a 15-minute edge: the count restarts only 15 min after the last one", async () => {
    const player = await signedUpPlayer()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(Date.now())

    for (let attempt = 0; attempt < 3; attempt++)
      await signInUsername(player.username, "wrong")
    //14 minutes pass since the last failure, 16 since the first
    vi.setSystemTime(Date.now() + 14 * MINUTE)
    for (let attempt = 0; attempt < 2; attempt++)
      await signInUsername(player.username, "wrong")

    const locked = await signInUsername(player.username, PASSWORD)
    expect(locked.response.status).toBe(429)
    expect(locked.body?.error_code).toBe("auth_account_locked")
  })

  it("starts the count over once 15 minutes pass after the last failure", async () => {
    const player = await signedUpPlayer()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(Date.now())

    for (let attempt = 0; attempt < 4; attempt++)
      await signInUsername(player.username, "wrong")
    vi.setSystemTime(Date.now() + 15 * MINUTE + 1_000)
    for (let attempt = 0; attempt < 4; attempt++)
      await signInUsername(player.username, "wrong")

    expect(
      (await signInUsername(player.username, PASSWORD)).response.status,
    ).toBe(200)
  })

  it("treats an unknown player exactly like a known one", async () => {
    const known = (await signedUpPlayer()).username
    const unknown = freshUsername()

    for (let attempt = 0; attempt < 5; attempt++) {
      const knownAnswer = await signInUsername(known, "wrong")
      const unknownAnswer = await signInUsername(unknown, "wrong")
      expect(unknownAnswer.response.status).toBe(
        knownAnswer.response.status,
      )
      expect(unknownAnswer.text).toBe(knownAnswer.text)
    }

    const knownLocked = await signInUsername(known, "wrong")
    const unknownLocked = await signInUsername(unknown, "wrong")
    expect(knownLocked.response.status).toBe(429)
    expect(unknownLocked.response.status).toBe(429)
    expect(unknownLocked.text).toBe(knownLocked.text)
    expect(unknownLocked.response.headers.get("Retry-After")).toBe(
      knownLocked.response.headers.get("Retry-After"),
    )
  })

  //---- session renewal ----------------

  //better-auth extends a session once a day of use (updateAge). requireAuth()
  //must pass the renewed session on rather than dropping it: the cookie a
  //browser on the shared origin holds would otherwise die after 7 days while
  //D1 still says the session is live.
  it("forwards the renewed session when requireAuth() extends a day-old one", async () => {
    const player = await signedUpPlayer()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(Date.now() + DAY + MINUTE)

    const renewed = await readProfile({ token: player.token })
    expect(renewed.response.status).toBe(200)
    expect(setCookiesOf(renewed.response).join("\n")).toMatch(
      /better-auth\.session_token=.*Max-Age=604800/i,
    )
  })

  //---- csrf ----------------

  //the browser on the shared origin sends better-auth's session cookie with
  //every request, and requireAuth() accepts it without a bearer token, so a
  //POST to the app's own routes is cookie-authenticated. better-auth's origin
  //check only covers its own handler.
  it("refuses a cookie-authenticated POST from a foreign origin with 403", async () => {
    const player = await signedUpPlayer()

    const forged = await call("/api/v1/realtime/ticket", {
      method: "POST",
      cookie: player.cookie,
      origin: "https://evil.example.net",
    })
    expect(forged.response.status).toBe(403)
    expect(forged.body?.error_code).toBe("forbidden_origin")
  })

  it("lets a cookie-authenticated POST from our own origin through", async () => {
    const player = await signedUpPlayer()
    const own = await call("/api/v1/realtime/ticket", {
      method: "POST",
      cookie: player.cookie,
      origin: "http://second.example.com",
    })
    expect(own.response.status).toBe(201)
  })

  it("refuses a cookie-authenticated sign-out from a foreign origin", async () => {
    const player = await signedUpPlayer()
    const forged = await call("/api/v1/auth/sign-out", {
      method: "POST",
      cookie: player.cookie,
      origin: "https://evil.example.net",
    })
    expect(forged.response.status).toBe(403)
    expect(
      (await readProfile({ token: player.token })).response.status,
    ).toBe(200)
  })
})
