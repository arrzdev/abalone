import { describe, expect, it, vi } from "vitest"
import {
  createAuthClientLoader,
  createSessionSource,
} from "@/data/auth/client"

//the auth SDK loads on first use rather than with the page. what has to hold
//for that to be safe: every caller gets the one client, nobody races a client
//that is not there yet, and a load that fails can be tried again without
//touching anything this device holds.

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("createAuthClientLoader", () => {
  it("loads once, however many times it is asked", async () => {
    const load = vi.fn(async () => "client")
    const loadClient = createAuthClientLoader(load)

    expect(await loadClient()).toBe("client")
    expect(await loadClient()).toBe("client")
    expect(load).toHaveBeenCalledOnce()
  })

  it("shares one load between callers that arrive together", async () => {
    let finish: (client: string) => void = () => {}
    const load = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        }),
    )
    const loadClient = createAuthClientLoader(load)

    const first = loadClient()
    const second = loadClient()
    finish("client")

    expect(await first).toBe("client")
    expect(await second).toBe("client")
    expect(load).toHaveBeenCalledOnce()
  })

  it("tries again after a load that failed", async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("chunk failed to load"))
      .mockResolvedValueOnce("client")
    const loadClient = createAuthClientLoader(load)

    await expect(loadClient()).rejects.toThrow("chunk failed to load")
    expect(await loadClient()).toBe("client")
    expect(load).toHaveBeenCalledTimes(2)
  })
})

type Session = { user: string | null; isPending: boolean }

const PENDING: Session = { user: null, isPending: true }

function fakeSessionAtom(initial: Session) {
  let value = initial
  const listeners = new Set<(next: Session) => void>()
  return {
    listeners,
    get: () => value,
    listen(listener: (next: Session) => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    set(next: Session) {
      value = next
      for (const listener of listeners) listener(next)
    },
  }
}

function fakeTokenStore() {
  const listeners = new Set<() => void>()
  return {
    onTokenChange(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    write() {
      for (const listener of listeners) listener()
    },
  }
}

describe("createSessionSource", () => {
  it("is pending until the client has loaded, on the server too", () => {
    const source = createSessionSource({
      pending: PENDING,
      loadSession: () =>
        new Promise<ReturnType<typeof fakeSessionAtom>>(() => {}),
      onTokenChange: fakeTokenStore().onTokenChange,
    })

    source.subscribe(() => {})

    expect(source.getSnapshot()).toBe(PENDING)
    expect(source.getServerSnapshot()).toBe(PENDING)
  })

  it("follows the session once the client has loaded", async () => {
    const atom = fakeSessionAtom({ user: "ada", isPending: false })
    const source = createSessionSource({
      pending: PENDING,
      loadSession: async () => atom,
      onTokenChange: fakeTokenStore().onTokenChange,
    })
    const onChange = vi.fn()

    source.subscribe(onChange)
    await settle()
    expect(source.getSnapshot()).toEqual({ user: "ada", isPending: false })

    atom.set({ user: null, isPending: false })
    expect(source.getSnapshot()).toEqual({ user: null, isPending: false })
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it("listens to nothing when unsubscribed before the client has loaded", async () => {
    const atom = fakeSessionAtom({ user: "ada", isPending: false })
    const source = createSessionSource({
      pending: PENDING,
      loadSession: async () => atom,
      onTokenChange: fakeTokenStore().onTokenChange,
    })

    const unsubscribe = source.subscribe(() => {})
    unsubscribe()
    await settle()

    expect(atom.listeners.size).toBe(0)
    expect(source.getSnapshot()).toBe(PENDING)
  })

  it("stays pending after a failed load, and tries again on the next token write", async () => {
    const atom = fakeSessionAtom({ user: "ada", isPending: false })
    const tokens = fakeTokenStore()
    const loadSession = vi
      .fn<() => Promise<typeof atom>>()
      .mockRejectedValueOnce(new Error("chunk failed to load"))
      .mockResolvedValueOnce(atom)
    const source = createSessionSource({
      pending: PENDING,
      loadSession,
      onTokenChange: tokens.onTokenChange,
    })

    source.subscribe(() => {})
    await settle()
    expect(source.getSnapshot()).toBe(PENDING)

    tokens.write()
    await settle()
    expect(source.getSnapshot()).toEqual({ user: "ada", isPending: false })
    expect(loadSession).toHaveBeenCalledTimes(2)
  })
})
