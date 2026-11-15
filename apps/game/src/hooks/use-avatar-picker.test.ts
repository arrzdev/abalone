import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ChangeEvent, ReactNode } from "react"
import { act, createElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { profileQueryKey } from "@/data/profile/queries"
import {
  ACCEPTED_IMAGES,
  useAvatarPicker,
} from "@/hooks/use-avatar-picker"
import { renderHook } from "@/test-support/render-hook"

const upload = vi.hoisted(() => ({
  run: null as null | ((picked: Blob) => Promise<unknown>),
}))

vi.mock("@/data/profile/mutations", () => ({
  uploadAvatarMutationOptions: {
    mutationFn: (picked: Blob) => upload.run?.(picked),
  },
}))

async function settle() {
  for (let round = 0; round < 4; round++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve))
    })
  }
}

function mount() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  const invalidate = vi.spyOn(queryClient, "invalidateQueries")
  const hook = renderHook(
    useAvatarPicker,
    ({ children }: { children: ReactNode }) =>
      createElement(
        QueryClientProvider,
        { client: queryClient },
        children,
      ),
  )
  return { hook, invalidate }
}

//the bits of a change event the handler reads: the files, and the input to clear
function changeEvent(files: File[] | null) {
  const target = { files, value: "C:\\fakepath\\me.png" }
  return {
    event: { target } as unknown as ChangeEvent<HTMLInputElement>,
    target,
  }
}

describe("useAvatarPicker", () => {
  beforeEach(() => {
    upload.run = async () => ({ username: "ana" })
  })

  it("accepts the three formats the picker offers", () => {
    expect(ACCEPTED_IMAGES).toBe("image/png,image/jpeg,image/webp")
  })

  it("opens the file dialog by clicking the caller's hidden input", () => {
    const { hook } = mount()
    const input = document.createElement("input")
    const click = vi.spyOn(input, "click")
    Object.assign(hook.current.inputRef, { current: input })

    hook.current.open()

    expect(click).toHaveBeenCalledTimes(1)
    hook.unmount()
  })

  it("does nothing when asked to open before the input exists", () => {
    const { hook } = mount()
    expect(() => hook.current.open()).not.toThrow()
    hook.unmount()
  })

  it("uploads the picked file, clears the input, then refreshes the profile", async () => {
    const file = new File(["x"], "me.png", { type: "image/png" })
    const uploaded = vi.fn(async (_picked: Blob) => ({ username: "ana" }))
    upload.run = uploaded
    const { hook, invalidate } = mount()
    const { event, target } = changeEvent([file])

    act(() => hook.current.handleChange(event))
    await settle()

    //cleared straight away so picking the same file twice still fires a change
    expect(target.value).toBe("")
    expect(uploaded).toHaveBeenCalledTimes(1)
    expect(uploaded.mock.calls[0]?.[0]).toBe(file)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: profileQueryKey })
    expect(hook.current.isUploading).toBe(false)
    expect(hook.current.hasFailed).toBe(false)
    hook.unmount()
  })

  it("ignores a dialog that was cancelled", async () => {
    const uploaded = vi.fn()
    upload.run = uploaded
    const { hook } = mount()

    for (const files of [[], null]) {
      const { event, target } = changeEvent(files)
      act(() => hook.current.handleChange(event))
      expect(target.value).toBe("")
    }
    await settle()

    expect(uploaded).not.toHaveBeenCalled()
    hook.unmount()
  })

  it("says it is uploading while the request is out", async () => {
    let finish: (value: unknown) => void = () => {}
    upload.run = () =>
      new Promise((resolve) => {
        finish = resolve
      })
    const { hook } = mount()

    act(() =>
      hook.current.handleChange(
        changeEvent([new File(["x"], "me.png")]).event,
      ),
    )
    await settle()
    expect(hook.current.isUploading).toBe(true)

    await act(async () => finish({}))
    await settle()
    expect(hook.current.isUploading).toBe(false)
    hook.unmount()
  })

  it("reports a failed upload and leaves the cached profile alone", async () => {
    upload.run = async () => {
      throw new Error("file_too_large")
    }
    const { hook, invalidate } = mount()

    act(() =>
      hook.current.handleChange(
        changeEvent([new File(["x"], "me.png")]).event,
      ),
    )
    await settle()

    expect(hook.current.hasFailed).toBe(true)
    expect(invalidate).not.toHaveBeenCalled()
    hook.unmount()
  })
})
