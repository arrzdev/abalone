/**
 * The ladder a duration is measured against, smallest first. Each entry says how
 * many of its own unit fit in the next one up, so the loop divides until the
 * number is small enough to be worth saying.
 *
 * Weeks are 4.34524 months' worth apart rather than 4, and months 12 to the
 * year, because the alternative is "5 weeks ago" for something that happened
 * last month.
 */
const DIVISIONS = [
  { per: 60, unit: "second" },
  { per: 60, unit: "minute" },
  { per: 24, unit: "hour" },
  { per: 7, unit: "day" },
  { per: 4.34524, unit: "week" },
  { per: 12, unit: "month" },
  { per: Number.POSITIVE_INFINITY, unit: "year" },
] as const satisfies readonly {
  per: number
  unit: Intl.RelativeTimeFormatUnit
}[]

/**
 * How long ago something happened, in the reader's own language.
 *
 * `Intl` rather than a table of strings, because "3 days ago" is thirteen
 * translations, a plural rule per language, and a decision about whether the
 * number goes before or after the word — all of which the platform already
 * knows and none of which belongs in a locale file.
 *
 * The narrow style is what makes it fit beside a score: English gives "3d ago",
 * and a language with no short form gives its own full phrase rather than a
 * truncation of one.
 */
export function formatRelativeTime(
  timestamp: number,
  language: string,
  now = Date.now(),
): string {
  const formatter = new Intl.RelativeTimeFormat(language, {
    numeric: "auto",
    style: "narrow",
  })

  let remaining = (timestamp - now) / 1000
  for (const division of DIVISIONS) {
    if (Math.abs(remaining) < division.per) {
      return formatter.format(Math.round(remaining), division.unit)
    }
    remaining /= division.per
  }

  //unreachable: the last division is infinite, so the loop always returns
  return formatter.format(Math.round(remaining), "year")
}
