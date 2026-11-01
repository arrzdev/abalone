import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

// Splits the suite into CI shards by measured time, not by test count.
// Playwright's own --shard cuts the test list into equal counts, so a shard
// that drew the skipped tests and the slow WebKit layout specs ran twice as
// long as the others. Here every spec file of every project is one unit,
// weighed in shard-weights.json (seconds of shard time from a green CI run;
// refresh with scripts/e2e-shard-weights.mjs), and the heaviest units go
// first, each to the lightest shard. Every shard computes the same plan from
// the same file list, so each unit runs exactly once.

// A spec file with no measurement yet, about an average file.
const unmeasuredWeight = 15

type Unit = { project: string; file: string; weight: number }

export function parseShard(shard: string | undefined) {
  if (!shard) return undefined
  const match = shard.match(/^(\d+)\/(\d+)$/)
  const current = Number(match?.[1])
  const total = Number(match?.[2])
  if (!match || current < 1 || current > total) {
    throw new Error(`E2E_SHARD must look like 2/3, got "${shard}"`)
  }
  return { current, total }
}

export function planShards(
  testDir: string,
  projects: string[],
  total: number,
): Map<string, string[]>[] {
  const measured: Record<string, Record<string, number>> = JSON.parse(
    readFileSync(join(testDir, "support", "shard-weights.json"), "utf8"),
  )
  const files = readdirSync(testDir)
    .filter((file) => file.endsWith(".spec.ts"))
    .sort()
  const units: Unit[] = projects.flatMap((project) =>
    files.map((file) => ({
      project,
      file,
      weight: measured[project]?.[file] ?? unmeasuredWeight,
    })),
  )
  units.sort(
    (a, b) =>
      b.weight - a.weight ||
      a.project.localeCompare(b.project) ||
      a.file.localeCompare(b.file),
  )

  const shards = Array.from({ length: total }, () => ({
    weight: 0,
    files: new Map(projects.map((project) => [project, [] as string[]])),
  }))
  for (const unit of units) {
    const lightest = shards.reduce((best, shard) =>
      shard.weight < best.weight ? shard : best,
    )
    lightest.weight += unit.weight
    lightest.files.get(unit.project)?.push(join(testDir, unit.file))
  }
  return shards.map((shard) => shard.files)
}
