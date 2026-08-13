// Backward-compat cleanup reminder (non-blocking).
//
// Expand/contract leaves temporary shims behind (dual-writes, tolerant reads,
// columns kept for old code). They are marked in source with:
//   // BACKWARD_COMPAT 2026-06-30: dual-write old_name until 0009 drops it (expand)
// This guard lists every marker with its age and emits a CI warning for stale
// ones, so the contract/cleanup deploy doesn't get forgotten. It never fails the
// build — only a human/agent with context can decide a shim is safe to drop
// (stack/database-migrations).
//
// Usage: node check-compat-markers.mjs

import { execSync } from "node:child_process"

const STALE_DAYS = Number(process.env.COMPAT_STALE_DAYS || 30)
const now = Date.now()

function markers() {
  let out = ""
  try {
    // source only — exclude the example markers in the skill docs
    out = execSync(
      "git grep -n -E 'BACKWARD_COMPAT [0-9]{4}-[0-9]{2}-[0-9]{2}' -- apps packages",
      { encoding: "utf8" },
    )
  } catch {
    return [] // git grep exits 1 when there are no matches
  }
  const rows = []
  for (const line of out.split("\n").filter(Boolean)) {
    const m = line.match(
      /^(.+?):(\d+):.*BACKWARD_COMPAT (\d{4}-\d{2}-\d{2})(.*)$/,
    )
    if (!m) continue
    const ageDays = Math.floor(
      (now - new Date(m[3]).getTime()) / 86_400_000,
    )
    rows.push({
      file: m[1],
      line: Number(m[2]),
      ageDays,
      note: m[4].trim(),
    })
  }
  return rows
}

const rows = markers()
if (rows.length === 0) {
  console.log("backward-compat markers: none")
  process.exit(0)
}

console.log(`backward-compat markers (${rows.length}):`)
let stale = 0
for (const r of rows.sort((a, b) => b.ageDays - a.ageDays)) {
  const flag = r.ageDays >= STALE_DAYS ? "  STALE" : ""
  console.log(`  ${r.file}:${r.line}  ${r.ageDays}d${flag}  ${r.note}`)
  if (r.ageDays >= STALE_DAYS) {
    stale++
    console.log(
      `::warning file=${r.file},line=${r.line}::backward-compat shim is ${r.ageDays} days old — confirm the contract/cleanup deploy ran and drop it (see stack/database-migrations).`,
    )
  }
}
console.log(
  stale > 0
    ? `\n${stale} stale marker(s) past ${STALE_DAYS}d — review for cleanup.`
    : `\nno markers past ${STALE_DAYS}d.`,
)
process.exit(0) // reminder only — never blocks
