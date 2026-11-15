import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { writeToken } from "@/data/auth/token"
import { backendBaseUrl } from "@/data/backend-client"
import { uploadAvatarMutationOptions } from "@/data/profile/mutations"
import { stubMemoryStorage } from "@/test-support/memory-storage"
import { runMutation } from "@/test-support/run-query"
import { jsonResponse } from "@/test-support/stub-fetch"
import { resizeToAvatar } from "@/utils/image-resize"

//the resize needs a canvas, which is a browser job; here it is a stand-in and
//what is checked is what the upload does with its result.
vi.mock("@/utils/image-resize", () => ({
  resizeToAvatar: vi.fn(),
}))

const profile = {
  username: "ada",
  displayUsername: "Ada",
  avatarUrl: "https://cdn.example.test/ada.webp",
}

//the upload is multipart, so the stub keeps the raw init instead of json
function stubUpload(response: Response) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init: RequestInit) => {
      calls.push({ url: String(input), init })
      return response
    },
  )
  return calls
}

describe("uploadAvatarMutationOptions", () => {
  beforeEach(() => {
    stubMemoryStorage()
    vi.mocked(resizeToAvatar).mockResolvedValue(
      new Blob(["webp-bytes"], { type: "image/webp" }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("resizes the picked file, then posts it as the avatar form field", async () => {
    writeToken("tok")
    const calls = stubUpload(
      jsonResponse(200, { status: "success", data: { profile } }),
    )
    const picked = new Blob(["raw"], { type: "image/png" })

    const result = await runMutation(uploadAvatarMutationOptions, picked)

    expect(result).toEqual(profile)
    expect(resizeToAvatar).toHaveBeenCalledWith(picked)

    expect(calls).toHaveLength(1)
    const [call] = calls
    expect(call?.url).toBe(`${backendBaseUrl}/api/v1/profile/me/avatar`)
    expect(call?.init.method).toBe("POST")
    expect(new Headers(call?.init.headers).get("authorization")).toBe(
      "Bearer tok",
    )

    const form = call?.init.body as FormData
    //the filename the source passes is not asserted: happy-dom's FormData does
    //not carry it over, so it would only test the environment
    const sent = form.get("avatar") as Blob
    expect(await sent.text()).toBe("webp-bytes")
  })

  it("throws the api's code when the upload is refused", async () => {
    stubUpload(
      jsonResponse(413, { status: "error", error_code: "file_too_large" }),
    )

    await expect(
      runMutation(uploadAvatarMutationOptions, new Blob(["raw"])),
    ).rejects.toThrow("file_too_large")
  })

  it("does not send anything when the resize fails", async () => {
    vi.mocked(resizeToAvatar).mockRejectedValue(new Error("decode failed"))
    const calls = stubUpload(jsonResponse(200, {}))

    await expect(
      runMutation(uploadAvatarMutationOptions, new Blob(["raw"])),
    ).rejects.toThrow("decode failed")
    expect(calls).toHaveLength(0)
  })

  it("surfaces network_unreachable when the request never lands", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("failed to fetch")
    })

    await expect(
      runMutation(uploadAvatarMutationOptions, new Blob(["raw"])),
    ).rejects.toThrow("network_unreachable")
  })
})
