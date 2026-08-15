import { env } from "cloudflare:workers"
import { beforeAll, describe, expect, it } from "vitest"
import worker from "@/entrypoint"
import { envRegistry } from "@/env/registry"
import { MAX_AVATAR_BYTES } from "@/services/profile.service"
import { newExecutionContext } from "@/test-support/execution-context"

type ProfileEnvelope = {
  status: string
  error_code?: string
  data?: {
    profile: {
      username: string | null
      displayUsername: string | null
      avatarUrl: string | null
    }
  }
}

//the sniffer reads magic bytes, not pixels, so these are the smallest inputs
//that are honestly of each type. a "png" here is a real png header followed by
//nothing, which is exactly the thing the sniffer is asked about.
function pngBytes(padding: number): Uint8Array {
  const bytes = new Uint8Array(8 + padding)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return bytes
}

function webpBytes(): Uint8Array {
  const bytes = new Uint8Array(16)
  bytes.set([0x52, 0x49, 0x46, 0x46], 0)
  bytes.set([0x57, 0x45, 0x42, 0x50], 8)
  return bytes
}

describe("profile routes", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  function fetchWorker(request: Request) {
    return worker.fetch(request, env as never, newExecutionContext())
  }

  //sign a fresh player up and keep the bearer token the client would keep
  async function signUpAndGetToken(username: string): Promise<string> {
    const response = await fetchWorker(
      new Request("http://example.com/api/v1/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://example.com",
          "x-test-bypass": "true",
        },
        body: JSON.stringify({
          username,
          name: username,
          email: `${username}@users.abalone.invalid`,
          password: "correct-horse",
        }),
      }),
    )
    return response.headers.get("set-auth-token") ?? ""
  }

  async function getProfile(token: string) {
    const response = await fetchWorker(
      new Request("http://example.com/api/v1/profile/me", {
        headers: {
          authorization: `Bearer ${token}`,
          "x-test-bypass": "true",
        },
      }),
    )
    return { response, body: (await response.json()) as ProfileEnvelope }
  }

  async function uploadAvatar(token: string, bytes: Uint8Array) {
    const form = new FormData()
    form.set("avatar", new Blob([bytes]), "avatar.bin")

    const response = await fetchWorker(
      new Request("http://example.com/api/v1/profile/me/avatar", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "x-test-bypass": "true",
        },
        body: form,
      }),
    )
    return { response, body: (await response.json()) as ProfileEnvelope }
  }

  //---- the gate ----------------

  it("refuses a guest", async () => {
    const { response, body } = await getProfile("")

    expect(response.status).toBe(401)
    expect(body).toEqual({ status: "error", error_code: "unauthorized" })
  })

  it("refuses a token that means nothing", async () => {
    const { response } = await getProfile("not-a-real-token")

    expect(response.status).toBe(401)
  })

  //---- reading ----------------

  it("returns the permanent username and no picture yet", async () => {
    const token = await signUpAndGetToken("reader")
    const { response, body } = await getProfile(token)

    expect(response.status).toBe(200)
    expect(body.data?.profile).toEqual({
      username: "reader",
      displayUsername: "reader",
      avatarUrl: null,
    })
  })

  //---- uploading ----------------

  it("stores the picture under the hash of its bytes", async () => {
    const token = await signUpAndGetToken("uploader")
    const { response, body } = await uploadAvatar(token, webpBytes())

    expect(response.status).toBe(200)

    const avatarUrl = body.data?.profile.avatarUrl ?? ""
    const key = avatarUrl.replace("https://cdn.example.com/", "")
    expect(key).toMatch(/^avatars\/[0-9a-f]{64}\.webp$/)

    const stored = await env.AVATARS.get(key)
    expect(stored?.httpMetadata?.cacheControl).toBe(
      "public, max-age=31536000, immutable",
    )
    expect(stored?.httpMetadata?.contentType).toBe("image/webp")
  })

  it("gives the same bytes the same url twice", async () => {
    const token = await signUpAndGetToken("repeater")
    const first = await uploadAvatar(token, pngBytes(16))
    const second = await uploadAvatar(token, pngBytes(16))

    expect(second.body.data?.profile.avatarUrl).toBe(
      first.body.data?.profile.avatarUrl,
    )
  })

  it("rejects a file over the size limit", async () => {
    const token = await signUpAndGetToken("oversized")
    const { response, body } = await uploadAvatar(
      token,
      pngBytes(MAX_AVATAR_BYTES),
    )

    expect(response.status).toBe(413)
    expect(body.error_code).toBe("file_too_large")
  })

  it("rejects bytes that are not an image, whatever they claim", async () => {
    const token = await signUpAndGetToken("liar")
    const { response, body } = await uploadAvatar(
      token,
      new TextEncoder().encode("MZ this is an executable"),
    )

    expect(response.status).toBe(415)
    expect(body.error_code).toBe("unsupported_media_type")
  })

  //---- the dev-only read path ----------------

  it("hides the dev avatar route from a public frontend", async () => {
    const response = await fetchWorker(
      new Request("http://example.com/api/v1/avatars/anything.webp", {
        headers: { "x-test-bypass": "true" },
      }),
    )

    //FRONTEND_URLS is all public origins here, so allowsPrivateOrigins() is false
    //and the passthrough answers as if it did not exist
    expect(response.status).toBe(404)
  })

  it("rejects a body that is not a multipart upload", async () => {
    const token = await signUpAndGetToken("malformed")
    const response = await fetchWorker(
      new Request("http://example.com/api/v1/profile/me/avatar", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-test-bypass": "true",
        },
        body: JSON.stringify({ avatar: "nope" }),
      }),
    )

    expect(response.status).toBe(400)
  })
})
