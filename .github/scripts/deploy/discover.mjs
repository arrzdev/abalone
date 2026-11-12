// Build the deploy matrix from .github/deploy-units.jsonc — the source of truth
// for WHAT deploys and how it's grouped. An app deploys only if it's listed here;
// a unit's apps deploy together, in order, fail-stop. Only apps changed since the
// last successful deploy to this environment deploy (turbo --affected from the
// DEPLOYED_TAG commit to TURBO_SCM_HEAD). A wrangler.toml that isn't listed is
// warned about (so you don't forget one) but never deployed.
// Emits GITHUB_OUTPUT `units` (matrix of units with >=1 changed app) and `any`.
//
// FORCE_ALL=true treats every listed app as changed: the manual workflow dispatch
// (used after rotating secrets/vars, which change no files) and the
// deployment-test branch.
//
// DEPLOYED_TAG (e.g. deployed/staging) names the tag deploy.yml moves after a
// run deployed everything it had to. Diffing against it, not against the
// previous push, means a push whose deploy was superseded, failed or never ran
// still ships with the next one, whatever unit that one touches. No tag, or a
// tag that is not an ancestor of HEAD (deployment-test shipped another branch,
// or a rollback deleted it), deploys every unit.

import { execSync } from "node:child_process"
import {
  appendFileSync,
  existsSync,
  readdirSync,
  readFileSync,
} from "node:fs"

const DEPLOYED_TAG = process.env.DEPLOYED_TAG
let FORCE_ALL = process.env.FORCE_ALL === "true"
const CONFIG = ".github/deploy-units.jsonc"

function readUnits() {
  if (!existsSync(CONFIG)) {
    throw new Error(`${CONFIG} not found — it defines what deploys.`)
  }
  const stripped = readFileSync(CONFIG, "utf8")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l)) // full-line // comments
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
  let units
  try {
    units = JSON.parse(stripped)
  } catch (e) {
    throw new Error(`${CONFIG} parse error: ${e.message}`)
  }
  if (!Array.isArray(units)) {
    throw new Error(`${CONFIG} must be a JSON array of { name, apps }.`)
  }
  return units
}

// validate the manifest + collect the declared apps (the entire deployable set)
const units = readUnits()
const declared = new Set()
for (const u of units) {
  if (
    !u ||
    typeof u.name !== "string" ||
    !Array.isArray(u.apps) ||
    u.apps.length === 0
  ) {
    throw new Error(
      `${CONFIG}: each unit needs { name: string, apps: non-empty string[] }. Bad: ${JSON.stringify(u)}`,
    )
  }
  for (const app of u.apps) {
    if (declared.has(app)) {
      throw new Error(`${CONFIG}: ${app} is listed in more than one unit.`)
    }
    declared.add(app)
    if (!existsSync(`${app}/wrangler.toml`)) {
      throw new Error(
        `${CONFIG}: unit "${u.name}" lists ${app}, which has no ${app}/wrangler.toml (not deployable).`,
      )
    }
  }
}

// heads-up for a deployable app that was never declared (so it isn't forgotten)
for (const dir of readdirSync("apps", { withFileTypes: true })) {
  const app = `apps/${dir.name}`
  if (
    dir.isDirectory() &&
    existsSync(`${app}/wrangler.toml`) &&
    !declared.has(app)
  ) {
    console.log(
      `::warning::${app} has a wrangler.toml but is not in ${CONFIG} — it will NOT deploy. Add it if intended.`,
    )
  }
}

function packageNameToApp(apps) {
  const map = {}
  for (const p of apps) {
    map[JSON.parse(readFileSync(`${p}/package.json`, "utf8")).name] = p
  }
  return map
}

function warn(msg) {
  console.log(`::warning::${msg}`)
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `> **Warning:** ${msg}\n`,
    )
  }
}

function git(args) {
  return execSync(`git ${args}`, {
    encoding: "utf8",
    stdio: "pipe",
  }).trim()
}

// The commit the environment last deployed from, or null (then deploy all).
// Always read from origin: a local tag can be stale.
function deployedBase(tag) {
  try {
    git(
      `fetch --quiet --no-tags origin +refs/tags/${tag}:refs/tags/${tag}`,
    )
  } catch {
    return null
  }
  const sha = git(`rev-parse refs/tags/${tag}^{commit}`)
  try {
    git(`merge-base --is-ancestor ${sha} HEAD`)
  } catch {
    console.log(`${tag} (${sha}) is not an ancestor of HEAD`)
    return null
  }
  return sha
}

if (!FORCE_ALL && DEPLOYED_TAG) {
  const base = deployedBase(DEPLOYED_TAG)
  if (base) {
    process.env.TURBO_SCM_BASE = base
    console.log(`diff base: ${DEPLOYED_TAG} = ${base}`)
  } else {
    FORCE_ALL = true
    warn(`no usable ${DEPLOYED_TAG} tag; deploying all declared apps.`)
  }
}

function changedApps(apps) {
  if (FORCE_ALL) return new Set(apps)
  const byPkg = packageNameToApp(apps)
  try {
    const plan = JSON.parse(
      execSync("pnpm exec turbo run build --affected --dry-run=json", {
        encoding: "utf8",
      }),
    )
    const affected = new Set(plan.packages || [])
    return new Set(
      Object.entries(byPkg)
        .filter(([pkg]) => affected.has(pkg))
        .map(([, app]) => app),
    )
  } catch (e) {
    warn(
      `affected detection failed (${e.message.split("\n")[0]}); deploying all declared apps.`,
    )
    return new Set(apps)
  }
}

const changed = changedApps([...declared])
const matrix = units
  .map((u) => ({
    name: u.name,
    // ordered, changed-only — exactly what gets deployed
    affected: u.apps.filter((a) => changed.has(a)),
  }))
  .filter((u) => u.affected.length > 0)

const json = JSON.stringify(matrix)
console.log(`declared apps: ${[...declared].join(", ") || "none"}`)
console.log(`units to deploy: ${json}`)
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `units=${json}\n`)
  appendFileSync(process.env.GITHUB_OUTPUT, `any=${matrix.length > 0}\n`)
}
