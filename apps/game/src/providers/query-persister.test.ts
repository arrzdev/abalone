import type { PersistedClient } from "@tanstack/react-query-persist-client"
import { del, get, set } from "idb-keyval"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CACHE_MAX_AGE } from "@/providers/query-client"
import { persister, persistOptions } from "@/providers/query-persister"

//the saved cache lives in IndexedDB, which is not always there (private
//windows, a full disk). a device that cannot save its cache must still play,
//so no storage failure may reach the caller.

vi.mock("idb-keyval", () => ({
  del: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
}))

const saved: PersistedClient = {
  timestamp: 1,
  buster: "1",
  clientState: { mutations: [], queries: [] },
}

describe("persister", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("saves the client under one key", async () => {
    await persister.persistClient(saved)
    expect(set).toHaveBeenCalledWith("abalone-query-cache", saved)
  })

  it("restores what was saved", async () => {
    vi.mocked(get).mockResolvedValue(saved)

    expect(await persister.restoreClient()).toEqual(saved)
    expect(get).toHaveBeenCalledWith("abalone-query-cache")
  })

  it("restores undefined when nothing was saved", async () => {
    vi.mocked(get).mockResolvedValue(undefined)
    expect(await persister.restoreClient()).toBeUndefined()
  })

  it("removes the saved client", async () => {
    await persister.removeClient()
    expect(del).toHaveBeenCalledWith("abalone-query-cache")
  })

  it("does not throw when saving fails", async () => {
    vi.mocked(set).mockRejectedValue(new Error("quota exceeded"))
    await expect(persister.persistClient(saved)).resolves.toBeUndefined()
  })

  it("restores undefined, not an error, when storage is unavailable", async () => {
    vi.mocked(get).mockRejectedValue(new Error("no indexeddb"))
    expect(await persister.restoreClient()).toBeUndefined()
  })

  it("does not throw when removing fails", async () => {
    vi.mocked(del).mockRejectedValue(new Error("no indexeddb"))
    await expect(persister.removeClient()).resolves.toBeUndefined()
  })

  it("does not throw when storage throws synchronously", async () => {
    vi.mocked(set).mockImplementation(() => {
      throw new Error("blocked")
    })
    await expect(persister.persistClient(saved)).resolves.toBeUndefined()
  })
})

describe("persistOptions", () => {
  it("restores a cache for as long as the query client keeps one", () => {
    expect(persistOptions.maxAge).toBe(CACHE_MAX_AGE)
    expect(persistOptions.persister).toBe(persister)
  })

  it("is versioned, so a changed shape drops what devices saved", () => {
    expect(persistOptions.buster).toBeTruthy()
  })

  it("never saves a mutation in flight", () => {
    const shouldDehydrate =
      persistOptions.dehydrateOptions?.shouldDehydrateMutation
    expect(shouldDehydrate?.({} as never)).toBe(false)
  })
})
