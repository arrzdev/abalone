import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"
import type { GamesReportRow } from "@/utils/games-report"
import { formatGamesReport, gamesReportSql } from "@/utils/games-report"

//2026-10-11 15:00 UTC
const NOW = Date.UTC(2026, 9, 11, 15)
const DAY_MS = 86_400_000

type FixtureEvent = {
  kind: "start" | "finish"
  mode: "ai" | "local" | "online"
  result?: string
  guided?: boolean
  daysAgo: number
}

async function seed(events: FixtureEvent[]) {
  const statements = events.map((event, index) =>
    env.DB.prepare(
      `insert into game_events
         (id, game_ref, kind, mode, bot_level, result, move_count, guided, app_version, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      `event-${index}`,
      `game-${index}`,
      event.kind,
      event.mode,
      event.mode === "ai" ? 3 : null,
      event.result ?? null,
      event.kind === "finish" ? 40 : null,
      event.guided ? 1 : 0,
      "test",
      NOW - event.daysAgo * DAY_MS,
    ),
  )
  await env.DB.batch(statements)
}

async function report(days: number) {
  const { results } = await env.DB.prepare(
    gamesReportSql({ days, now: NOW }),
  ).all<GamesReportRow>()
  return formatGamesReport(results, { days, now: NOW })
}

describe("games report", () => {
  beforeEach(async () => {
    await env.DB.prepare("delete from game_events").run()
  })

  it("counts starts, guided starts and real finishes per day and mode, newest day first", async () => {
    await seed([
      //today
      { kind: "start", mode: "ai", guided: true, daysAgo: 0 },
      { kind: "start", mode: "ai", daysAgo: 0 },
      { kind: "start", mode: "ai", daysAgo: 0 },
      { kind: "finish", mode: "ai", result: "win", daysAgo: 0 },
      { kind: "finish", mode: "ai", result: "abandoned", daysAgo: 0 },
      { kind: "start", mode: "online", daysAgo: 0 },
      { kind: "finish", mode: "online", result: "black", daysAgo: 0 },
      //yesterday
      { kind: "start", mode: "local", guided: true, daysAgo: 1 },
      { kind: "finish", mode: "local", result: "draw", daysAgo: 1 },
      //before the window: never counted
      { kind: "start", mode: "ai", daysAgo: 7 },
      { kind: "finish", mode: "ai", result: "loss", daysAgo: 7 },
    ])

    expect(await report(7)).toBe(
      [
        "Games, last 7 days (2026-10-05 to 2026-10-11, UTC)",
        "",
        "day         mode           started  guided  not guided  finished  finish rate",
        "2026-10-11  bot                  3       1           2         1          33%",
        "2026-10-11  online               1       0           1         1         100%",
        "2026-10-10  pass-and-play        1       1           0         1         100%",
        "total       bot                  3       1           2         1          33%",
        "total       pass-and-play        1       1           0         1         100%",
        "total       online               1       0           1         1         100%",
        "",
      ].join("\n"),
    )
  })

  it("prints every mode in the totals with a dash for the rate when nothing started", async () => {
    await seed([{ kind: "finish", mode: "ai", result: "win", daysAgo: 0 }])

    expect(await report(1)).toBe(
      [
        "Games, last 1 day (2026-10-11 to 2026-10-11, UTC)",
        "",
        "day         mode           started  guided  not guided  finished  finish rate",
        "2026-10-11  bot                  0       0           0         1            -",
        "total       bot                  0       0           0         1            -",
        "total       pass-and-play        0       0           0         0            -",
        "total       online               0       0           0         0            -",
        "",
      ].join("\n"),
    )
  })

  it("refuses a window that is not a whole number of days from 1 to 366", () => {
    for (const days of [0, -1, 1.5, 367, Number.NaN]) {
      expect(() => gamesReportSql({ days, now: NOW })).toThrow()
    }
  })

  it("is a single select, so it can never write", () => {
    const sql = gamesReportSql({ days: 14, now: NOW })
    expect(sql.trim().toLowerCase().startsWith("select")).toBe(true)
    expect(sql).not.toContain(";")
  })
})
