import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { registerServiceWorkerLifecycle } from "#nativ/sw/sw.lifecycle"

type Listener = (event: unknown) => void

//a service worker global with just what the lifecycle helpers touch
function createScope() {
  const listeners = new Map<string, Listener[]>()
  return {
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}) },
    addEventListener(type: string, listener: Listener) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener])
    },
    dispatch(type: string, event: unknown) {
      for (const listener of listeners.get(type) ?? []) listener(event)
    },
    listenerCount(type: string) {
      return listeners.get(type)?.length ?? 0
    },
  }
}

let scope: ReturnType<typeof createScope>

beforeEach(() => {
  scope = createScope()
  vi.stubGlobal("self", scope)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("registerServiceWorkerLifecycle", () => {
  it("skips waiting only on a SKIP_WAITING message", () => {
    registerServiceWorkerLifecycle()

    scope.dispatch("message", { data: { type: "OTHER" } })
    scope.dispatch("message", { data: null })
    expect(scope.skipWaiting).not.toHaveBeenCalled()

    scope.dispatch("message", { data: { type: "SKIP_WAITING" } })
    expect(scope.skipWaiting).toHaveBeenCalledOnce()
  })

  it("claims clients on activate and holds the event until done", () => {
    registerServiceWorkerLifecycle()
    const waitUntil = vi.fn()

    scope.dispatch("activate", { waitUntil })

    expect(scope.clients.claim).toHaveBeenCalledOnce()
    expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise))
  })

  it("registers nothing when both behaviours are turned off", () => {
    registerServiceWorkerLifecycle({
      claimClients: false,
      skipWaitingOnMessage: false,
    })

    expect(scope.listenerCount("message")).toBe(0)
    expect(scope.listenerCount("activate")).toBe(0)
  })
})
