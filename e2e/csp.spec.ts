import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { openApp } from "./support/app"
import { expect, test } from "./support/test"

// The policy is enforced and every spec is watched for violations
// (e2e/support/test.ts). This file checks both.

test("pages and static files carry the enforced policy, not a report-only one", async ({
  request,
}) => {
  const home = await request.get("/")
  const html = await home.text()
  const assetPath = html.match(/(?:src|href)="(\/assets\/[^"]+\.js)"/)?.[1]
  expect(assetPath, "a build asset linked from the home page").toBeTruthy()
  const asset = await request.get(assetPath as string)

  for (const response of [home, asset]) {
    const headers = response.headers()
    expect(headers["content-security-policy"], response.url()).toContain(
      "default-src 'self'",
    )
    expect(headers["content-security-policy-report-only"]).toBeUndefined()
  }
})

test("a request the policy refuses fails the spec", async ({
  page,
  cspViolations,
}) => {
  await openApp(page, "/")
  await page.evaluate(() =>
    fetch("https://csp-probe.invalid/").catch(() => undefined),
  )
  await expect.poll(() => cspViolations.length).toBeGreaterThan(0)
  expect(cspViolations.join("\n")).toContain("connect-src")
  // a browser prints a few console lines for one violation: let them land
  let seen = -1
  await expect
    .poll(async () => {
      const settled = seen === cspViolations.length
      seen = cspViolations.length
      await page.waitForTimeout(300)
      return settled
    })
    .toBe(true)
  // provoked on purpose: the guard would fail this spec for it otherwise
  cspViolations.length = 0
})

test("every spec takes `test` from the guard", () => {
  const specs = readdirSync(__dirname).filter((file) =>
    file.endsWith(".spec.ts"),
  )
  const bypassing = specs.filter((file) =>
    /import\s*\{[^}]*\btest\b[^}]*\}\s*from\s*"@playwright\/test"/.test(
      readFileSync(join(__dirname, file), "utf8"),
    ),
  )
  expect(bypassing, "import { test } from ./support/test").toEqual([])
})
