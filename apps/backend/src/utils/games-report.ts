/**
 * Games started and finished per day and mode, read from `game_events`.
 *
 * Pure on purpose: the SQL and the table are built here, and whoever runs the
 * SQL (the `report:games` script against production, the test against a local
 * D1) hands the rows back. Counts only, so online starts and finishes, which
 * never pair (see docs/game-events.md), are read the same way as the rest.
 */

import type { GameEventMode } from "@/database/schema"

export type GamesReportRow = {
  //utc, yyyy-mm-dd
  day: string
  mode: GameEventMode
  started: number
  //starts with the first-game guide showing
  guided: number
  //finishes that reached an end: abandoned games are not finished
  finished: number
}

export type GamesReportWindow = {
  //whole utc days, today included
  days: number
  //epoch ms
  now: number
}

const DAY_MS = 86_400_000
const MAX_DAYS = 366

//the order and the names the growth team reads, not the stored values
const MODE_LABELS = {
  ai: "bot",
  local: "pass-and-play",
  online: "online",
} as const satisfies Record<GameEventMode, string>

const MODES = Object.keys(MODE_LABELS) as GameEventMode[]

//---- query ----------------

export function gamesReportSql(window: GamesReportWindow): string {
  const since = windowStart(window)

  return `select date(created_at / 1000, 'unixepoch') as day,
       mode,
       sum(kind = 'start') as started,
       sum(kind = 'start' and guided = 1) as guided,
       sum(kind = 'finish' and result != 'abandoned') as finished
from game_events
where created_at >= ${since}
group by day, mode
order by day desc, mode`
}

/**
 * Midnight utc at the start of the first day in the window. Throws on a
 * window that is not a whole number of days, so nothing but an integer ever
 * reaches the SQL.
 */
function windowStart(window: GamesReportWindow): number {
  const isWholeDays =
    Number.isInteger(window.days) &&
    window.days >= 1 &&
    window.days <= MAX_DAYS
  if (!isWholeDays) {
    throw new Error(
      `days must be a whole number from 1 to ${MAX_DAYS}, got ${window.days}`,
    )
  }

  const today = Math.floor(window.now / DAY_MS) * DAY_MS
  return today - (window.days - 1) * DAY_MS
}

//---- table ----------------

const COLUMNS = [
  { title: "day", width: 10, align: "left" },
  { title: "mode", width: 13, align: "left" },
  { title: "started", width: 7, align: "right" },
  { title: "guided", width: 6, align: "right" },
  { title: "not guided", width: 10, align: "right" },
  { title: "finished", width: 8, align: "right" },
  { title: "finish rate", width: 11, align: "right" },
] as const

export function formatGamesReport(
  rows: GamesReportRow[],
  window: GamesReportWindow,
): string {
  const firstDay = isoDay(windowStart(window))
  const lastDay = isoDay(window.now)
  const dayWord = window.days === 1 ? "day" : "days"

  const lines = [
    `Games, last ${window.days} ${dayWord} (${firstDay} to ${lastDay}, UTC)`,
    "",
    formatLine(COLUMNS.map((column) => column.title)),
  ]

  for (const row of rows) {
    lines.push(formatCounts(row.day, row))
  }

  for (const mode of MODES) {
    lines.push(formatCounts("total", totalFor(rows, mode)))
  }

  return `${lines.join("\n")}\n`
}

function totalFor(
  rows: GamesReportRow[],
  mode: GameEventMode,
): Omit<GamesReportRow, "day"> {
  const total = { mode, started: 0, guided: 0, finished: 0 }
  for (const row of rows) {
    if (row.mode !== mode) continue
    total.started += row.started
    total.guided += row.guided
    total.finished += row.finished
  }
  return total
}

function formatCounts(
  label: string,
  counts: Omit<GamesReportRow, "day">,
): string {
  return formatLine([
    label,
    MODE_LABELS[counts.mode],
    String(counts.started),
    String(counts.guided),
    String(counts.started - counts.guided),
    String(counts.finished),
    finishRate(counts),
  ])
}

/**
 * Finished over started in the same rows. Counted, not paired, so a game
 * started before the window and finished inside it can push a day past 100%.
 */
function finishRate(counts: Omit<GamesReportRow, "day">): string {
  if (counts.started === 0) return "-"
  return `${Math.round((100 * counts.finished) / counts.started)}%`
}

function formatLine(cells: readonly string[]): string {
  return COLUMNS.map((column, i) => {
    const cell = cells[i] ?? ""
    if (column.align === "left") return cell.padEnd(column.width)
    return cell.padStart(column.width)
  }).join("  ")
}

function isoDay(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10)
}
