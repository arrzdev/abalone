import { expect, test } from "./support/test"

// Smoke self-test: the app responds, mounts content, and throws no uncaught
// errors. Minimal "is it alive" check to run headlessly against a local
// (ideally isolated) dev server — not an exhaustive user-flow suite.
test("app shell boots and mounts", async ({ page }) => {
  const pageErrors: string[] = []
  page.on("pageerror", (err) => pageErrors.push(err.message))

  const response = await page.goto("/")
  expect(response?.ok(), `navigation status: ${response?.status()}`).toBe(
    true,
  )

  // The app rendered something into the document (not a blank / error shell).
  await expect
    .poll(() => page.evaluate(() => document.body.childElementCount))
    .toBeGreaterThan(0)

  expect(pageErrors, `uncaught errors:\n${pageErrors.join("\n")}`).toEqual(
    [],
  )
})

// The probe production uptime checks hit: under /api, the only prefix routed to
// the backend Worker, and it asks D1 and R2 before it answers.
test("api health check reports every resource ok", async ({ request }) => {
  test.skip(
    !!process.env.E2E_BASE_URL,
    "the local api port is not deployed",
  )
  const apiPort = process.env.E2E_API_PORT ?? 8181
  const response = await request.get(
    `http://localhost:${apiPort}/api/v1/health`,
  )

  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({
    status: "success",
    data: { database: "ok", r2: "ok" },
  })
})

// Read-only smoke for a deployed environment: E2E_BASE_URL=<url> pnpm test:e2e
// smoke. Only GETs, no accounts, no writes. The game has no sign-in page (the
// account sheet opens from the app), so there is no sign-in check here.
test.describe("deployed environment", () => {
  test.skip(
    !process.env.E2E_BASE_URL,
    "runs only against a deployed environment",
  )

  test("the game answers 200 with its title", async ({ page }) => {
    const response = await page.goto("/")
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(/abalone/i)
  })

  test("/version.json serves the deployed commit", async ({ request }) => {
    const response = await request.get("/version.json")
    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({
      sha: expect.stringMatching(/^[0-9a-f]{40}$/),
    })
  })

  test("/api/version serves the deployed backend commit", async ({
    request,
  }) => {
    const response = await request.get("/api/version")
    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({
      sha: expect.stringMatching(/^[0-9a-f]{40}$/),
    })
  })

  // The one exception to "no accounts": it signs in with an existing QA
  // account (E2E_QA_EMAIL, E2E_QA_PASSWORD) and signs out again, so the only
  // write is the session row that sign-out deletes. Skipped without them.
  test("sign-in sets the session cookie Secure, HttpOnly and SameSite=Lax", async ({
    request,
    baseURL,
  }) => {
    const email = process.env.E2E_QA_EMAIL
    const password = process.env.E2E_QA_PASSWORD
    test.skip(
      !email || !password,
      "needs E2E_QA_EMAIL and E2E_QA_PASSWORD",
    )
    const headers = { origin: new URL(baseURL ?? "").origin }

    const signIn = await request.post("/api/v1/auth/sign-in/email", {
      data: { email, password },
      headers,
    })
    expect(signIn.status()).toBe(200)
    const sessionCookie = signIn
      .headersArray()
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value)
      .find((cookie) => cookie.includes("session_token="))
    // only the attributes, so a failure never prints the token
    const attributes = sessionCookie
      ?.split(";")
      .slice(1)
      .map((attribute) => attribute.trim().toLowerCase())
    expect(attributes).toEqual(
      expect.arrayContaining(["secure", "httponly", "samesite=lax"]),
    )

    // better-auth refuses a POST without a JSON body (415)
    const signOut = await request.post("/api/v1/auth/sign-out", {
      data: {},
      headers,
    })
    expect(signOut.status()).toBe(200)
  })
})
