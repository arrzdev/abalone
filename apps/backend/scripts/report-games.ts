import { execFileSync } from "node:child_process"
import { parseArgs } from "node:util"
import type { GamesReportRow } from "@/utils/games-report"
import { formatGamesReport, gamesReportSql } from "@/utils/games-report"

//games started and finished per day and mode, from production D1. one select,
//read-only: `pnpm --filter @repo/backend report:games [--days 7]`

const DEFAULT_DAYS = 7

type D1ExecuteResult = { results: GamesReportRow[] }

const { values } = parseArgs({
  options: { days: { type: "string", default: String(DEFAULT_DAYS) } },
})

const window = { days: Number(values.days), now: Date.now() }
const sql = gamesReportSql(window)

const output = execFileSync(
  "wrangler",
  [
    "d1",
    "execute",
    "abalone-backend-db",
    "--remote",
    "--env",
    "production",
    "--json",
    "--command",
    sql,
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
)

const [result] = JSON.parse(output) as D1ExecuteResult[]
process.stdout.write(formatGamesReport(result?.results ?? [], window))
