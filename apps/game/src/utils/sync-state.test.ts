import { describe, expect, it } from "vitest"
import type { SyncSource } from "@/utils/sync-state"
import { syncStateOf } from "@/utils/sync-state"

/** A settled query holding data it fetched itself, which is the happy case. */
const CONFIRMED: SyncSource = {
  data: [],
  isError: false,
  isFetching: false,
  isFetchedAfterMount: true,
  isPaused: false,
}

/** The same query as the cache restored it: data on screen, nobody asked. */
const RESTORED: SyncSource = { ...CONFIRMED, isFetchedAfterMount: false }

const source = (overrides: Partial<SyncSource>): SyncSource => ({
  ...RESTORED,
  ...overrides,
})

describe("syncStateOf", () => {
  it("is fresh once every query has answered since the screen opened", () => {
    expect(syncStateOf([CONFIRMED, CONFIRMED])).toBe("fresh")
  })

  //the case this exists for: the screen is full, and none of it has been
  //checked against the server yet
  it("is syncing while a restored copy is being confirmed", () => {
    expect(syncStateOf([source({ isFetching: true })])).toBe("syncing")
  })

  it("is loading when there is nothing saved to show", () => {
    expect(
      syncStateOf([source({ data: undefined, isFetching: true })]),
    ).toBe("loading")
  })

  it("is offline when the browser has paused the request", () => {
    expect(syncStateOf([source({ isPaused: true })])).toBe("offline")
  })

  it("is stale once the attempt to confirm has failed", () => {
    expect(syncStateOf([source({ isError: true })])).toBe("stale")
  })

  //a retry is a question still open, so it reads as syncing rather than as an
  //answer that came back empty
  it("stays syncing while a failed query is retrying", () => {
    expect(
      syncStateOf([source({ isError: true, isFetching: true })]),
    ).toBe("syncing")
  })

  //what a query cached forever looks like on every mount: never refetched, and
  //right anyway. a notice here would never come down.
  it("trusts a query the cache decided not to refetch", () => {
    expect(syncStateOf([RESTORED])).toBe("fresh")
  })

  it("reports the least current query on the screen", () => {
    expect(
      syncStateOf([CONFIRMED, source({ isFetching: true }), CONFIRMED]),
    ).toBe("syncing")
    expect(syncStateOf([CONFIRMED, source({ isPaused: true })])).toBe(
      "offline",
    )
  })

  it("is fresh when there is nothing to be current about", () => {
    expect(syncStateOf([])).toBe("fresh")
  })
})
