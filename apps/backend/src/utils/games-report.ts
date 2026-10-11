export type GamesReportRow = {
  day: string
  mode: string
  started: number
  guided: number
  finished: number
}

export type GamesReportWindow = {
  days: number
  now: number
}

export function gamesReportSql(_window: GamesReportWindow): string {
  throw new Error("not implemented")
}

export function formatGamesReport(
  _rows: GamesReportRow[],
  _window: GamesReportWindow,
): string {
  throw new Error("not implemented")
}
