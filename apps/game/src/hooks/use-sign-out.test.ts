import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { act, createElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useSignOut } from "@/hooks/use-sign-out"
import { renderHook } from "@/test-support/render-hook"

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}))
vi.mock("@/data/auth/mutations", () => ({ signOut: mocks.signOut }))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return createElement(QueryClientProvider, { client }, children)
}

//react-query settles on a microtask; flush it inside act
async function settle() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe("useSignOut", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("signs out, then goes home", async () => {
    mocks.signOut.mockResolvedValue(undefined)
    const hook = renderHook(useSignOut, wrapper)

    act(() => hook.current.mutate())
    await settle()

    expect(mocks.signOut).toHaveBeenCalledTimes(1)
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/" })
    hook.unmount()
  })

  //the device is already clean (signOut drops it whatever the server said), so
  //a failure is no reason to leave the player on a page about being signed in
  it("goes home even when signing out fails", async () => {
    mocks.signOut.mockRejectedValue(new Error("network_unreachable"))
    const hook = renderHook(useSignOut, wrapper)

    act(() => hook.current.mutate())
    await settle()

    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/" })
    hook.unmount()
  })
})
