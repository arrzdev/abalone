import { env } from "cloudflare:workers"
import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import worker from "@/entrypoint"
import { envRegistry } from "@/env/registry"
import type { AuthedVariables } from "@/http/middlewares/auth"
import { requireAllowedOrigin, requireAuth } from "@/http/middlewares/auth"
import { errorCatcher } from "@/http/middlewares/error-catcher"
import { resetRateLimitBuckets } from "@/http/middlewares/rate-limit"
import { newExecutionContext } from "@/test-support/execution-context"
import { failingD1 } from "@/test-support/failing-bindings"

type Envelope = { status: string; error_code?: string }

//both middlewares on a throwaway app, so what answers is the guard and not a
//route behind it. sessions come from a real sign-up against the local D1.
describe("auth middlewares", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  beforeEach(() => {
    resetRateLimitBuckets()
  })

  const app = new Hono<{ Variables: AuthedVariables }>()
    .post("/open", requireAllowedOrigin(), (c) => c.json({ ok: true }))
    .get("/open", requireAllowedOrigin(), (c) => c.json({ ok: true }))
    .post("/mine", requireAuth(), (c) =>
      c.json({ userId: c.get("user").id }),
    )
    .get("/mine", requireAuth(), (c) =>
      c.json({ userId: c.get("user").id }),
    )
  app.onError(errorCatcher)

  function send(
    method: string,
    path: string,
    headers: Record<string, string>,
    bindings: object = env,
  ) {
    return app.request(
      `http://example.com${path}`,
      { method, headers },
      bindings,
    )
  }

  let handles = 0
  async function signUp() {
    handles += 1
    const username = `guard${handles}`
    const response = await worker.fetch(
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
      env as never,
      newExecutionContext(),
    )
    const token = response.headers.get("set-auth-token")
    if (!token) throw new Error(`sign-up failed: ${response.status}`)
    const { user } = (await response.json()) as { user: { id: string } }
    return { username, userId: user.id, token }
  }

  //session.expires_at is stored in seconds
  async function moveSessionExpiry(username: string, expiresAtMs: number) {
    await env.DB.prepare(
      "update session set expires_at = ? where user_id = (select id from user where username = ?)",
    )
      .bind(Math.floor(expiresAtMs / 1000), username)
      .run()
  }

  describe("requireAllowedOrigin", () => {
    it("refuses a cookie-carrying POST from a foreign origin", async () => {
      const response = await send("POST", "/open", {
        cookie: "better-auth.session_token=anything",
        origin: "http://attacker.example.net",
      })

      expect(response.status).toBe(403)
      expect(((await response.json()) as Envelope).error_code).toBe(
        "forbidden_origin",
      )
    })

    it("refuses a private origin against a public frontend", async () => {
      const response = await send("POST", "/open", {
        cookie: "better-auth.session_token=anything",
        origin: "http://localhost:6161",
      })

      expect(response.status).toBe(403)
    })

    it("lets a cookie-carrying POST from a configured origin through", async () => {
      const response = await send("POST", "/open", {
        cookie: "better-auth.session_token=anything",
        origin: "http://second.example.com",
      })

      expect(response.status).toBe(200)
    })

    //a forged request needs the victim's cookie to ride on
    it("lets a POST without a cookie through whatever its origin", async () => {
      const response = await send("POST", "/open", {
        origin: "http://attacker.example.net",
      })

      expect(response.status).toBe(200)
    })

    //no origin at all is not a browser, so there is no session to borrow
    it("lets a cookie-carrying POST without an origin through", async () => {
      const response = await send("POST", "/open", {
        cookie: "better-auth.session_token=anything",
      })

      expect(response.status).toBe(200)
    })

    it("lets a safe method through from a foreign origin", async () => {
      const response = await send("GET", "/open", {
        cookie: "better-auth.session_token=anything",
        origin: "http://attacker.example.net",
      })

      expect(response.status).toBe(200)
    })
  })

  describe("requireAuth", () => {
    it("resolves the signed-in player from a bearer token", async () => {
      const { userId, token } = await signUp()

      const response = await send("GET", "/mine", {
        authorization: `Bearer ${token}`,
      })

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ userId })
    })

    it("refuses a request with no session", async () => {
      const response = await send("GET", "/mine", {})

      expect(response.status).toBe(401)
      expect(((await response.json()) as Envelope).error_code).toBe(
        "unauthorized",
      )
    })

    it("refuses a token that is not a session", async () => {
      const response = await send("GET", "/mine", {
        authorization: "Bearer not-a-real-session-token",
      })

      expect(response.status).toBe(401)
    })

    it("refuses an expired session", async () => {
      const { username, token } = await signUp()
      await moveSessionExpiry(username, Date.now() - 60_000)

      const response = await send("GET", "/mine", {
        authorization: `Bearer ${token}`,
      })

      expect(response.status).toBe(401)
    })

    it("refuses a session that was revoked", async () => {
      const { username, token } = await signUp()
      await env.DB.prepare(
        "delete from session where user_id = (select id from user where username = ?)",
      )
        .bind(username)
        .run()

      const response = await send("GET", "/mine", {
        authorization: `Bearer ${token}`,
      })

      expect(response.status).toBe(401)
    })

    //a session past its update age is extended, and the new token has to reach
    //the client on whatever this request answers
    it("passes a renewed session token back to the client", async () => {
      const { username, token } = await signUp()
      await moveSessionExpiry(username, Date.now() + 60 * 60 * 1000)

      const response = await send("GET", "/mine", {
        authorization: `Bearer ${token}`,
      })

      expect(response.status).toBe(200)
      expect(response.headers.get("set-auth-token")).toBeTruthy()
    })

    //the origin check runs first: a valid session does not excuse a forgery
    it("refuses a forged POST before looking at the session", async () => {
      const { token } = await signUp()

      const response = await send("POST", "/mine", {
        authorization: `Bearer ${token}`,
        cookie: "better-auth.session_token=anything",
        origin: "http://attacker.example.net",
      })

      expect(response.status).toBe(403)
      expect(((await response.json()) as Envelope).error_code).toBe(
        "forbidden_origin",
      )
    })

    it("lets a POST with a session from a configured origin through", async () => {
      const { userId, token } = await signUp()

      const response = await send("POST", "/mine", {
        authorization: `Bearer ${token}`,
        origin: "http://example.com",
      })

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ userId })
    })

    //a blip in D1 must not read as "signed out"
    it("answers 503 rather than 401 when D1 is down", async () => {
      const { token } = await signUp()

      const response = await send(
        "GET",
        "/mine",
        { authorization: `Bearer ${token}` },
        { ...env, DB: failingD1() },
      )

      expect(response.status).toBe(503)
      expect(((await response.json()) as Envelope).error_code).toBe(
        "service_unavailable",
      )
    })
  })
})
