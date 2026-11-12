// Tests for wrangler-envs.mjs. Most cases start from this repo's own
// apps/backend/wrangler.toml and break one thing, so they prove the check
// against the config that deploys.
//
// Run: node --test .github/scripts/checks/wrangler-envs.test.mjs

import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { after, test } from "node:test"
// biome-ignore lint/style/noRestrictedImports: repo scripts sit outside apps/packages and have no alias
import { checkApp } from "./wrangler-envs.mjs"

process.env.WRANGLER_LOG ??= "error"
const root = resolve(import.meta.dirname, "../../..")
const wrangler = createRequire(join(root, "apps/backend/package.json"))(
  "wrangler",
)
const backend = readFileSync(
  join(root, "apps/backend/wrangler.toml"),
  "utf8",
)
const dir = mkdtempSync(join(tmpdir(), "wrangler-envs-"))
after(() => rmSync(dir, { recursive: true, force: true }))

let n = 0
function check(toml, opts = {}) {
  const deployed = opts.deployed ?? ["production"]
  const liveName = "liveName" in opts ? opts.liveName : "abalone-backend"
  const configPath = join(dir, `wrangler-${n++}.toml`)
  writeFileSync(configPath, toml)
  return checkApp({
    app: opts.app ?? "apps/backend",
    configPath,
    wrangler,
    deployed,
    liveName,
    envOnly: opts.envOnly,
  }).errors
}

// Removes the block that starts with `header` (a line of the file), up to the
// next blank line.
function dropBlock(toml, header, nth = 0) {
  const lines = toml.split("\n")
  let start = -1
  for (let i = 0, seen = 0; i < lines.length; i++) {
    if (lines[i] === header && seen++ === nth) {
      start = i
      break
    }
  }
  assert.notEqual(start, -1, `${header} not found`)
  let end = start
  while (end < lines.length && lines[end].trim() !== "") end++
  lines.splice(start, end - start)
  return lines.join("\n")
}

const PROD_D1 = "8eff88f0-fa50-4d63-9dce-c0dfdafc1129"
const DEV_D1 = "00000000-0000-0000-0000-000000000000"

test("the backend config passes", () => {
  assert.deepEqual(check(backend), [])
})

const game = readFileSync(join(root, "apps/game/wrangler.toml"), "utf8")
const GAME_ENV_ONLY = { production: ["services BACKEND"] }

test("the game config passes", () => {
  assert.deepEqual(
    check(game, {
      app: "apps/game",
      liveName: "abalone-game",
      envOnly: GAME_ENV_ONLY,
    }),
    [],
  )
})

test("the game's production-only BACKEND binding needs its envOnly entry", () => {
  assert.deepEqual(
    check(game, { app: "apps/game", liveName: "abalone-game" }),
    [
      "apps/game [env.production]: has services BACKEND, which the top level lacks",
    ],
  )
})

test("an envOnly entry the env no longer has fails", () => {
  const errors = check(dropBlock(game, "[[env.production.services]]"), {
    app: "apps/game",
    liveName: "abalone-game",
    envOnly: GAME_ENV_ONLY,
  })
  assert.deepEqual(errors, [
    "apps/game [env.production]: envOnly lists services BACKEND, which the env does not have",
  ])
})

test("a binding dropped from [env.production] fails", () => {
  const errors = check(
    dropBlock(backend, "[[env.production.ratelimits]]", 2),
  )
  assert.deepEqual(errors, [
    "apps/backend [env.production]: missing ratelimits AUTH_FAILURE_RATE_LIMITER (declared at the top level)",
  ])
})

test("a D1 binding dropped from [env.production] fails", () => {
  const errors = check(
    dropBlock(backend, "[[env.production.d1_databases]]"),
  )
  assert.deepEqual(errors, [
    "apps/backend [env.production]: missing d1_databases DB (declared at the top level)",
  ])
})

test("a vars key missing from an env fails", () => {
  const errors = check(
    backend.replace(
      '[env.production.vars]\nDEPLOY_ENV = "production"\n',
      "",
    ),
  )
  assert.deepEqual(errors, [
    "apps/backend [env.production]: missing vars DEPLOY_ENV (declared at the top level)",
  ])
})

test("a binding in an env but not at the top level fails", () => {
  const errors = check(
    `${backend}\n[[env.production.kv_namespaces]]\nbinding = "CACHE"\nid = "33333333333333333333333333333333"\n`,
  )
  assert.deepEqual(errors, [
    "apps/backend [env.production]: has kv_namespaces CACHE, which the top level lacks",
  ])
})

test("an env without an explicit name fails", () => {
  const errors = check(backend.replace('name = "abalone-backend"\n', ""))
  assert.deepEqual(errors, [
    'apps/backend [env.production]: no explicit name (wrangler would deploy "abalone-backend-dev-production")',
  ])
})

test("an env that reuses the dev name fails", () => {
  const errors = check(
    backend.replace(
      'name = "abalone-backend"\n',
      'name = "abalone-backend-dev"\n',
    ),
  )
  assert.deepEqual(errors, [
    'apps/backend [env.production]: name "abalone-backend-dev" is the dev name',
    'apps/backend [env.production]: name "abalone-backend-dev" is not the live Worker "abalone-backend" (wrangler-envs.jsonc); a rename deploys a second Worker',
  ])
})

test("a production name that is not the live Worker fails", () => {
  const errors = check(backend, { liveName: "acme-api" })
  assert.equal(errors.length, 1)
  assert.match(
    errors[0],
    /name "abalone-backend" is not the live Worker "acme-api"/,
  )
})

test("a production name that is not recorded fails", () => {
  const errors = check(backend, { liveName: undefined })
  assert.equal(errors.length, 1)
  assert.match(errors[0], /no live Worker name recorded/)
})

test("placeholder ids fail in a deployed env only", () => {
  const placeholder = backend.replace(PROD_D1, DEV_D1)
  assert.deepEqual(check(placeholder), [
    `apps/backend [env.production]: d1_databases DB has placeholder database_id "${DEV_D1}"`,
  ])
  assert.deepEqual(check(placeholder, { deployed: [] }), [])
})

test("a D1 id shared by dev and production fails", () => {
  const errors = check(backend.replace(DEV_D1, PROD_D1))
  assert.deepEqual(errors, [
    `apps/backend [env.production]: d1_databases database_id "${PROD_D1}" is also used by top level`,
  ])
})

test("a rate-limit namespace shared by two blocks fails", () => {
  const errors = check(
    backend.replace('namespace_id = "5001"', 'namespace_id = "5101"'),
  )
  assert.deepEqual(errors, [
    'apps/backend [env.production]: ratelimits namespace_id "5101" is also used by top level',
  ])
})

test("a service binding to a -dev Worker fails", () => {
  const svc = (scope, service) =>
    `[[${scope}services]]\nbinding = "API"\nservice = "${service}"\n`
  const toml = backend
    .replace(
      "[[d1_databases]]",
      `${svc("", "app-api-dev")}\n[[d1_databases]]`,
    )
    .replace(
      "[[env.production.d1_databases]]",
      `${svc("env.production.", "app-api-dev")}\n[[env.production.d1_databases]]`,
    )
  const errors = check(toml)
  assert.deepEqual(errors, [
    'apps/backend [env.production]: service binding API points at the dev Worker "app-api-dev"',
  ])
})

test("a config without [env.production] fails", () => {
  const errors = check(
    'name = "x-dev"\nmain = "w.ts"\ncompatibility_date = "2026-03-17"\n',
    { deployed: [] },
  )
  assert.deepEqual(errors, [
    "apps/backend [env.production]: missing; the top level is dev, so production must be a named env",
  ])
})
