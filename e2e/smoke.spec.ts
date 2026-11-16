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
})
