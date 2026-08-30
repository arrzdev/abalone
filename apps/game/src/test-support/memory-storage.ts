import { vi } from "vitest"

//happy-dom gives the tests a document but no `localStorage`, and half this
//app's data layer is a key in it — the token, and every snapshot painted before
//the network answers. so the store is stubbed, in memory, per test.

/** Puts an empty `localStorage` in place. Undone by `vi.unstubAllGlobals()`. */
export function stubMemoryStorage(): void {
  const entries = new Map<string, string>()

  vi.stubGlobal("localStorage", {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value)
    },
    removeItem: (key: string) => {
      entries.delete(key)
    },
    clear: () => {
      entries.clear()
    },
  })
}
