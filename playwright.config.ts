import { defineConfig, devices } from "@playwright/test"

// The main user flows, end to end: an e2e build of the game in front of the
// real backend Worker (local D1, R2 and Durable Object), both started here by
// the scripts in e2e/support/.
//
// The committed dev ports are the default, which is what CI uses. On a machine
// where something else already holds them, move the whole suite with
// E2E_GAME_PORT / E2E_API_PORT. Outside CI a server already up on the chosen
// ports is reused, which is what makes a second local run quick.
const gamePort = Number(process.env.E2E_GAME_PORT ?? 6161)
const apiPort = Number(process.env.E2E_API_PORT ?? 8181)
const inspectorPort = Number(process.env.E2E_API_INSPECTOR_PORT ?? 9218)

const baseURL = `http://localhost:${gamePort}`
// The backend's health route, at its root, answers 200 once it is up.
const apiURL = `http://localhost:${apiPort}`

const serverEnv = {
  E2E_GAME_PORT: String(gamePort),
  E2E_API_PORT: String(apiPort),
  E2E_API_INSPECTOR_PORT: String(inspectorPort),
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // One preview server and one backend Worker behind every test; two browsers
  // at a time is what a CI runner serves without pages timing out.
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["line"], ["github"], ["html", { open: "never" }]]
    : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // WebKit ≈ Mobile Safari for this iOS-PWA (desktop WebKit engine, NOT a real
    // device — escalate device-only quirks to the iOS Simulator).
    { name: "webkit-iphone", use: { ...devices["iPhone 13"] } },
  ],
  webServer: [
    {
      command: "bash e2e/support/serve-backend.sh",
      url: apiURL,
      env: serverEnv,
      // Its request log, so a failed run shows what the api answered.
      stdout: "pipe",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "bash e2e/support/serve-game.sh",
      url: baseURL,
      env: serverEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
})
