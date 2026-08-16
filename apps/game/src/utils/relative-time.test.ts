import { describe, expect, it } from "vitest"
import { formatRelativeTime } from "@/utils/relative-time"

const NOW = Date.UTC(2026, 7, 16, 12, 0, 0)

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** How long ago, in words, as an English reader sees it. */
const ago = (ms: number) => formatRelativeTime(NOW - ms, "en", NOW)

describe("formatRelativeTime", () => {
  it("says now for something that has just happened", () => {
    expect(ago(0)).toMatch(/now/i)
  })

  //the point of the ladder: every stamp lands in the largest unit it fills, so
  //nothing is ever reported as "90 minutes" or "36 hours"
  it("climbs to the largest unit the gap fills", () => {
    expect(ago(45 * SECOND)).toBe("45s ago")
    expect(ago(5 * MINUTE)).toBe("5m ago")
    expect(ago(5 * HOUR)).toBe("5h ago")
    expect(ago(3 * DAY)).toBe("3d ago")
    expect(ago(3 * 7 * DAY)).toBe("3w ago")
    expect(ago(90 * DAY)).toBe("3mo ago")
    expect(ago(400 * DAY)).toBe("last yr.")
  })

  it("names yesterday rather than counting the day", () => {
    expect(ago(DAY)).toBe("yesterday")
  })

  //a device whose clock runs slow gets stamps from the server that are ahead of
  //its own now. it is said forwards rather than clamped: "in 30s" is odd but
  //true of the two clocks, and a stamp pinned to "now" would hide a device that
  //is minutes out.
  it("reads a stamp ahead of the clock as the future", () => {
    expect(formatRelativeTime(NOW + 30 * SECOND, "en", NOW)).toMatch(
      /^in /,
    )
  })

  it("answers in the language it is asked in", () => {
    expect(formatRelativeTime(NOW - 5 * MINUTE, "pt", NOW)).not.toBe(
      formatRelativeTime(NOW - 5 * MINUTE, "en", NOW),
    )
  })
})
