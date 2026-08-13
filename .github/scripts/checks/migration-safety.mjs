// Migration safety guard (PR gate).
//
// A migration runs against the live database in Phase 3, *before* the new
// Worker version is promoted in Phase 4 — so old code briefly serves against
// the new schema. Destructive DDL (drop/rename/retype, or a NOT NULL add with
// no default) breaks old code immediately. This guard fails the PR if a newly
// added migration contains destructive SQL without an explicit, in-file
// acknowledgment, forcing the expand/contract decision (stack/database-migrations).
//
// Acknowledge a deliberate destructive/contract step with a header line in the
// migration .sql:
//   -- safety: destructive: counter unused since v2, no prod rows
//   -- safety: contract: drops old_name; expand landed in 0007, code migrated
//
// Usage:
//   node check-migration-safety.mjs                 # diff BASE_REF...HEAD (CI)
//   node check-migration-safety.mjs <file.sql ...>  # check explicit files (local/test)

import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"

const DESTRUCTIVE = [
  { re: /\bDROP\s+COLUMN\b/i, label: "DROP COLUMN" },
  { re: /\bDROP\s+TABLE\b/i, label: "DROP TABLE" },
  { re: /\bRENAME\s+(COLUMN|TO)\b/i, label: "RENAME" },
]

const ACK = /^\s*--\s*safety:\s*(destructive|contract)\b/im

const isMigration = (file) => /\/migrations\/[^/]+\.sql$/.test(file)

function addNotNullWithoutDefault(sql) {
  return sql
    .split(";")
    .some(
      (stmt) =>
        /\bADD\b/i.test(stmt) &&
        /\bNOT\s+NULL\b/i.test(stmt) &&
        !/\bDEFAULT\b/i.test(stmt),
    )
}

// Every migration tracked in the tree — the fail-closed fallback when we cannot
// diff against a base. Filtered through isMigration so it matches the diff path.
function allMigrations() {
  try {
    const out = execSync("git ls-files -- '*.sql'", { encoding: "utf8" })
    return out
      .split("\n")
      .map((l) => l.trim())
      .filter(isMigration)
  } catch {
    return []
  }
}

function targets() {
  const explicit = process.argv.slice(2).filter(isMigration)
  if (explicit.length > 0) return explicit

  const base = process.env.BASE_REF || "origin/main"
  // No usable base — the all-zero SHA that GitHub sends as `github.event.before`
  // on a branch's first push / a force-push. We cannot compute "new" migrations,
  // so fail CLOSED: scan every migration in the tree rather than skip the check.
  if (/^0+$/.test(base)) {
    console.log(
      `::notice::migration-safety: no usable base ('${base}') — scanning ALL migrations (fail closed).`,
    )
    return allMigrations()
  }
  try {
    const out = execSync(
      `git diff --name-only --diff-filter=AM ${base}...HEAD`,
      {
        encoding: "utf8",
      },
    )
    return out
      .split("\n")
      .map((l) => l.trim())
      .filter(isMigration)
  } catch {
    // base ref unreachable (shallow clone, deleted ref, …): fail closed, don't skip.
    console.log(
      `::notice::migration-safety: could not diff against '${base}' — scanning ALL migrations (fail closed).`,
    )
    return allMigrations()
  }
}

let violations = 0
for (const file of targets()) {
  const sql = readFileSync(file, "utf8")
  const hits = DESTRUCTIVE.filter((d) => d.re.test(sql)).map(
    (d) => d.label,
  )
  if (addNotNullWithoutDefault(sql))
    hits.push("ADD NOT NULL without DEFAULT")
  if (hits.length === 0) continue
  if (ACK.test(sql)) continue // a human consciously acknowledged it

  violations++
  console.error(
    `::error file=${file}::Destructive migration (${hits.join(", ")}) with no acknowledgment. Old code runs against this schema before the new version promotes. Restructure as expand/contract, or add a header line to the migration:  -- safety: destructive: <why it's safe now>   (see stack/database-migrations).`,
  )
}

if (violations > 0) {
  console.error(
    `\n${violations} migration(s) need a safety decision — expand/contract or an explicit acknowledgment.`,
  )
  process.exit(1)
}
console.log("migration-safety: ok")
