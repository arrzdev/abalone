// Binding parity check (PR gate and the deploy `verify` job).
//
// Wrangler does not inherit bindings or vars into a named env: a binding added
// to the dev top level only is `undefined` in staging and production, and the
// deploy succeeds anyway. This check reads every app in deploy-units.jsonc with
// wrangler's own parser (the app's wrangler, so the same version that deploys),
// once for the top level and once per [env.*], and fails when:
//
//   - an env lacks a binding or a `vars` key that the top level has, or has
//     one the top level lacks (every kind wrangler binds: D1, KV, R2, DO,
//     services, queues, rate limits, AI, analytics engine, ...);
//   - an env has no explicit `name`, or reuses the dev name;
//   - [env.production] is missing, or its `name` is not the live Worker name
//     recorded in .github/wrangler-envs.jsonc (a rename deploys a new Worker);
//   - an env this repo deploys (wrangler-envs.jsonc `deployed`) has a
//     placeholder id;
//   - two blocks share a D1 id, KV id, R2 bucket or rate-limit namespace_id;
//   - a named env binds a service to a `-dev` Worker.
//
// A Pages project (wrangler.toml has pages_build_output_dir) has no named
// envs and no bindings here, so only its project `name` is checked against the
// live one.
//
// A binding that only a deployed env has (a Workers AI or Vectorize binding,
// which `wrangler dev` can reach only remotely) is allowed per app and env in
// wrangler-envs.jsonc `envOnly`. The entry must still exist, so it cannot go
// stale.
//
// Usage: node .github/scripts/checks/wrangler-envs.mjs   (or pnpm check:wrangler-envs)
// Tests: node --test .github/scripts/checks/wrangler-envs.test.mjs

import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

// Binding kinds, each with the field that names the binding in the Worker.
// `durable_objects` and `queues` nest their lists one level down.
const LISTS = {
  d1_databases: "binding",
  kv_namespaces: "binding",
  r2_buckets: "binding",
  services: "binding",
  ratelimits: "name",
  analytics_engine_datasets: "binding",
  vectorize: "binding",
  hyperdrive: "binding",
  workflows: "binding",
  dispatch_namespaces: "binding",
  mtls_certificates: "binding",
  send_email: "name",
  secrets_store_secrets: "binding",
}
const SINGLES = ["ai", "browser", "images", "version_metadata", "assets"]

// Ids that must not be shared between two blocks, and their field.
const IDS = {
  d1_databases: "database_id",
  kv_namespaces: "id",
  r2_buckets: "bucket_name",
  ratelimits: "namespace_id",
}

const PLACEHOLDER =
  /^(0+(-0+)*|REPLACE_WITH.*|<.*>|TODO.*|placeholder.*)$/i

/** Every binding of a resolved config, as "kind NAME" strings. */
export function bindingsOf(config) {
  const out = new Set()
  for (const [kind, field] of Object.entries(LISTS)) {
    for (const b of config[kind] ?? []) out.add(`${kind} ${b[field]}`)
  }
  for (const b of config.durable_objects?.bindings ?? []) {
    out.add(`durable_objects ${b.name}`)
  }
  for (const b of config.queues?.producers ?? []) {
    out.add(`queues.producers ${b.binding}`)
  }
  for (const kind of SINGLES) {
    if (config[kind]?.binding) out.add(`${kind} ${config[kind].binding}`)
  }
  for (const key of Object.keys(config.vars ?? {})) out.add(`vars ${key}`)
  return out
}

/**
 * Checks one app's wrangler config. Returns a list of error strings.
 *   wrangler   the wrangler module (unstable_readConfig, experimental_readRawConfig)
 *   deployed   envs this repo deploys today
 *   liveName   the live production Worker name, or undefined if not recorded
 *   envOnly    { <env>: ["kind NAME", ...] } bindings the env may have and the
 *              top level may not
 */
export function checkApp({
  app,
  configPath,
  wrangler,
  deployed,
  liveName,
  envOnly = {},
}) {
  const errors = []
  const fail = (scope, msg) => errors.push(`${app} ${scope}: ${msg}`)

  const raw = wrangler.experimental_readRawConfig({
    config: configPath,
  }).rawConfig
  if (raw.pages_build_output_dir) {
    if (liveName === undefined) {
      fail(
        "Pages project",
        `no live project name recorded for ${app} in .github/wrangler-envs.jsonc`,
      )
    } else if (raw.name !== liveName) {
      fail(
        "Pages project",
        `name "${raw.name}" is not the live project "${liveName}" (wrangler-envs.jsonc); a rename deploys a second project`,
      )
    }
    return { errors, envs: [], bindings: 0, pages: true }
  }
  const envs = Object.keys(raw.env ?? {})
  const top = wrangler.unstable_readConfig({ config: configPath })
  const scopes = [["top level", top]]
  for (const env of envs) {
    scopes.push([
      `[env.${env}]`,
      wrangler.unstable_readConfig({ config: configPath, env }),
    ])
  }

  if (!envs.includes("production")) {
    fail(
      "[env.production]",
      "missing; the top level is dev, so production must be a named env",
    )
  }
  for (const env of deployed) {
    if (!envs.includes(env))
      fail(
        `[env.${env}]`,
        "listed as deployed in wrangler-envs.jsonc but not declared",
      )
  }

  const topBindings = bindingsOf(top)
  for (const env of envs) {
    const scope = `[env.${env}]`
    const config = scopes.find(([s]) => s === scope)[1]

    // `name` from the raw file: the resolved config fills a missing one in
    // as `<top>-<env>`, which hides the omission.
    const name = raw.env[env].name
    if (typeof name !== "string" || name === "") {
      fail(
        scope,
        `no explicit name (wrangler would deploy "${raw.name}-${env}")`,
      )
    } else if (name === raw.name) {
      fail(scope, `name "${name}" is the dev name`)
    }
    if (env === "production" && name !== undefined) {
      if (liveName === undefined) {
        fail(
          scope,
          `no live Worker name recorded for ${app} in .github/wrangler-envs.jsonc`,
        )
      } else if (name !== liveName) {
        fail(
          scope,
          `name "${name}" is not the live Worker "${liveName}" (wrangler-envs.jsonc); a rename deploys a second Worker`,
        )
      }
    }

    const envBindings = bindingsOf(config)
    for (const b of topBindings) {
      if (!envBindings.has(b))
        fail(scope, `missing ${b} (declared at the top level)`)
    }
    const allowed = envOnly[env] ?? []
    for (const b of envBindings) {
      if (!topBindings.has(b) && !allowed.includes(b))
        fail(scope, `has ${b}, which the top level lacks`)
    }
    for (const b of allowed) {
      if (!envBindings.has(b))
        fail(scope, `envOnly lists ${b}, which the env does not have`)
    }

    for (const s of config.services ?? []) {
      if (/-dev$/.test(s.service))
        fail(
          scope,
          `service binding ${s.binding} points at the dev Worker "${s.service}"`,
        )
    }

    if (deployed.includes(env)) {
      for (const [kind, field] of Object.entries(IDS)) {
        for (const b of config[kind] ?? []) {
          if (PLACEHOLDER.test(String(b[field] ?? ""))) {
            fail(
              scope,
              `${kind} ${b.binding ?? b.name} has placeholder ${field} "${b[field]}"`,
            )
          }
        }
      }
    }
  }

  // Shared ids across blocks (placeholders excluded: the rule above owns them).
  for (const [kind, field] of Object.entries(IDS)) {
    const seen = new Map()
    for (const [scope, config] of scopes) {
      for (const b of config[kind] ?? []) {
        const id = String(b[field] ?? "")
        if (id === "" || PLACEHOLDER.test(id)) continue
        const other = seen.get(id)
        if (other && other !== scope)
          fail(scope, `${kind} ${field} "${id}" is also used by ${other}`)
        else seen.set(id, scope)
      }
    }
  }

  return { errors, envs, bindings: topBindings.size }
}

function readJsonc(path) {
  const stripped = readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
  return JSON.parse(stripped)
}

function main() {
  // Wrangler's own warnings repeat what this check reports, less precisely.
  process.env.WRANGLER_LOG ??= "error"
  const root = resolve(import.meta.dirname, "../../..")
  const units = readJsonc(join(root, ".github/deploy-units.jsonc"))
  const record = readJsonc(join(root, ".github/wrangler-envs.jsonc"))
  const deployed = record.deployed ?? []

  let failed = 0
  for (const app of units.flatMap((u) => u.apps)) {
    const dir = join(root, app)
    // The app's own wrangler: the version that parses this config at deploy.
    const wrangler = createRequire(join(dir, "package.json"))("wrangler")
    const { errors, envs, bindings, pages } = checkApp({
      app,
      configPath: join(dir, "wrangler.toml"),
      wrangler,
      deployed,
      liveName: record.production?.[app],
      envOnly: record.envOnly?.[app],
    })
    if (errors.length) {
      failed += errors.length
      for (const e of errors) console.error(`::error::${e}`)
    } else if (pages) {
      console.log(`ok ${app}: Pages project, name matches the live one`)
    } else {
      console.log(
        `ok ${app}: top level + ${envs.join(", ")} match (${bindings} bindings and vars)`,
      )
    }
  }
  if (failed) {
    console.error(
      `wrangler-envs: ${failed} problem(s). Bindings and vars are not inherited: repeat each one in every [env.*].`,
    )
    process.exit(1)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
