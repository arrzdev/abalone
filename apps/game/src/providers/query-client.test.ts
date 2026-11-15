import { describe, expect, it } from "vitest"
import { CACHE_MAX_AGE, queryClient } from "@/providers/query-client"

const DAY_MS = 24 * 60 * 60 * 1000

//the numbers here are a contract between the client and the persister: a
//restored query must outlive the snapshot it came from, or it is collected
//between the restore and the screen that wanted it.

describe("queryClient", () => {
  it("restores a saved cache for up to a week", () => {
    expect(CACHE_MAX_AGE).toBe(7 * DAY_MS)
  })

  it("keeps a query in memory longer than a saved cache stays valid", () => {
    const { gcTime } = queryClient.getDefaultOptions().queries ?? {}
    expect(gcTime).toBeGreaterThan(CACHE_MAX_AGE)
  })

  it("treats data as fresh for 30s and retries a failure once", () => {
    const defaults = queryClient.getDefaultOptions().queries
    expect(defaults?.staleTime).toBe(30_000)
    expect(defaults?.retry).toBe(1)
  })
})
