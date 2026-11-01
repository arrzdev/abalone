#!/usr/bin/env node
// Measures how long each spec file takes per project, from the logs of a green
// CI run, and prints the weights e2e/support/shard.ts balances the shards with.
// Usage:
//   gh run view <run-id> --log > run.log
//   node scripts/e2e-shard-weights.mjs run.log > e2e/support/shard-weights.json
//
// The line reporter prints one timestamped line per test start. With the
// shard's workers busy, the gap to the next start is that test's share of the
// shard's wall time, so the gaps add up per file to what the file costs a shard.
// Skipped tests start and end at once and weigh nothing.
import { readFileSync } from "node:fs"

const testStart =
  /(\d{4}-\d\d-\d\dT[\d:.]+Z) \[\d+\/\d+\] (?:\[retry #\d+\] )?\[([\w-]+)\] › e2e\/([\w.-]+\.spec\.ts):/
const shardEnd = /(\d{4}-\d\d-\d\dT[\d:.]+Z)\s+\d+ passed \(/

const weights = {}

function addWeight(project, file, seconds) {
  weights[project] ??= {}
  weights[project][file] = (weights[project][file] ?? 0) + seconds
}

for (const path of process.argv.slice(2)) {
  // `gh run view --log` prefixes every line with its job name; a job's test
  // starts are only compared with each other.
  const startsByJob = new Map()
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const job = line.split("\t")[0]
    const starts = startsByJob.get(job) ?? []
    startsByJob.set(job, starts)
    const start = line.match(testStart)
    if (start) {
      starts.push({
        time: Date.parse(start[1]),
        project: start[2],
        file: start[3],
      })
      continue
    }
    const end = line.match(shardEnd)
    if (end && starts.length > 0) {
      starts.push({ time: Date.parse(end[1]) })
    }
  }
  for (const starts of startsByJob.values()) {
    for (let index = 0; index + 1 < starts.length; index++) {
      const { time, project, file } = starts[index]
      if (!file) continue
      addWeight(project, file, (starts[index + 1].time - time) / 1000)
    }
  }
}

const sorted = Object.fromEntries(
  Object.entries(weights)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([project, files]) => [
      project,
      Object.fromEntries(
        Object.entries(files)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([file, seconds]) => [
            file,
            Math.max(1, Math.round(seconds)),
          ]),
      ),
    ]),
)
process.stdout.write(`${JSON.stringify(sorted, null, 2)}\n`)
