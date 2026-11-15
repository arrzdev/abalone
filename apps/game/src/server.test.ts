// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { documentLanguage } from "@/routing/page-languages"

//the game Worker's entry. the framework's handler and the Workers `env` are
//stood in; everything this file adds in front of the handler is the real code:
//the locale redirects, `<html lang>`, the invite card, the request id and the
//security headers. `HTMLRewriter` only exists in workerd, so a fake records
//what it was told to set. the node environment, not happy-dom: its `Request`
//drops the `cookie` header, as a browser's would, and a Worker receives it.

const worker = vi.hoisted(() => ({
  handler: { fetch: vi.fn<(request: Request) => Promise<Response>>() },
  bindings: {} as { BACKEND?: { fetch: ReturnType<typeof vi.fn> } },
}))

vi.mock("cloudflare:workers", () => ({ env: worker.bindings }))
vi.mock("@tanstack/react-start/server-entry", () => ({
  default: worker.handler,
  createServerEntry: (entry: unknown) => entry,
}))

const { default: entry } = (await import("@/server")) as unknown as {
  default: { fetch: (request: Request) => Promise<Response> }
}

const LINK_ID = "Zq3_x-9bT2mK7vR1wY4nP8sL0cF6hJ5dA2eG9uB3oXk"
const SHELL = `<html><head><title>Abalone</title></head><body></body></html>`

function html(body = SHELL, headers: Record<string, string> = {}) {
  return new Response(body, {
    headers: { "content-type": "text/html; charset=utf-8", ...headers },
  })
}

function get(path: string, headers: Record<string, string> = {}) {
  return entry.fetch(
    new Request(`https://abalone.tudu.dev${path}`, { headers }),
  )
}

let languageSet: string[]

describe("the game Worker", () => {
  beforeEach(() => {
    worker.handler.fetch.mockReset()
    worker.handler.fetch.mockImplementation(async () => html())
    worker.bindings.BACKEND = undefined
    languageSet = []
    vi.stubGlobal(
      "HTMLRewriter",
      class {
        on(
          _selector: string,
          handlers: { element: (e: unknown) => void },
        ) {
          handlers.element({
            setAttribute: (_name: string, value: string) =>
              languageSet.push(value),
          })
          return this
        }
        transform(response: Response) {
          return response
        }
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe("every response", () => {
    it("carries the request id and the security headers", async () => {
      const response = await get("/rules")

      expect(response.headers.get("x-request-id")).toEqual(
        expect.any(String),
      )
      expect(response.headers.get("x-content-type-options")).toBe(
        "nosniff",
      )
      expect(response.headers.get("content-security-policy")).toContain(
        "default-src 'self'",
      )
    })

    it("lets the dev backend's origin into the policy, from its configured port", async () => {
      const response = await get("/rules")

      //the test env sets VITE_BACKEND_URL to localhost:8181
      expect(response.headers.get("content-security-policy")).toContain(
        "https://abalone.tudu.dev:8181",
      )
    })
  })

  describe("requests that are not page reads", () => {
    it("goes straight to the framework", async () => {
      const request = new Request("https://abalone.tudu.dev/rules", {
        method: "POST",
        headers: { "accept-language": "pt" },
      })

      const response = await entry.fetch(request)

      expect(response.status).toBe(200)
      expect(worker.handler.fetch).toHaveBeenCalledWith(request)
    })
  })

  describe("the visitor's language", () => {
    it("redirects an unprefixed page to the language they asked for", async () => {
      const response = await get("/rules?x=1", {
        "accept-language": "pt-BR",
      })

      expect(response.status).toBe(302)
      expect(response.headers.get("location")).toBe("/pt/rules?x=1")
      expect(response.headers.get("vary")).toBe("Accept-Language, Cookie")
      expect(worker.handler.fetch).not.toHaveBeenCalled()
    })

    it("prefers the saved cookie to the browser's language", async () => {
      const response = await get("/rules", {
        "accept-language": "pt",
        cookie: "abalone_language=de",
      })

      expect(response.headers.get("location")).toBe("/de/rules")
    })

    it("moves /en/... to the unprefixed path for everybody", async () => {
      const response = await get("/en/rules")

      expect(response.status).toBe(301)
      expect(response.headers.get("location")).toBe("/rules")
    })

    it("serves english pages, marked as depending on the visitor", async () => {
      const response = await get("/rules")

      expect(response.status).toBe(200)
      expect(response.headers.get("vary")).toBe("Accept-Language, Cookie")
      expect(languageSet).toEqual([])
    })

    it("serves a prefixed page with the language its URL is in", async () => {
      const response = await get("/pt/rules", { "accept-language": "ja" })

      expect(response.status).toBe(200)
      expect(languageSet).toEqual([documentLanguage("/rules", "pt")])
    })

    //english is what the shell already says, so there is nothing to rewrite
    it("leaves <html lang> alone for a page that has no translation into the prefix", async () => {
      const response = await get("/de/how-to-play")

      expect(response.status).toBe(200)
      expect(languageSet).toEqual([])
    })

    it("leaves the api and files alone", async () => {
      const api = await get("/api/v1/hello", { "accept-language": "pt" })
      const file = await get("/sitemap.xml", { "accept-language": "pt" })

      expect(api.status).toBe(200)
      expect(file.status).toBe(200)
      expect(worker.handler.fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe("an invite link", () => {
    function backendAnswers(body: unknown) {
      const fetch = vi.fn(async () => Response.json(body))
      worker.bindings.BACKEND = { fetch }
      return fetch
    }

    it("names the sender in the card while the link is open", async () => {
      const fetch = backendAnswers({
        status: "success",
        data: { inviterName: "Kasparov", state: "open" },
      })

      const response = await get(`/invite/${LINK_ID}`)
      const page = await response.text()

      expect(page).toContain(
        "<title>Kasparov invited you to a game of Abalone</title>",
      )
      expect(response.headers.get("cache-control")).toBe(
        "private, no-store",
      )
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it("asks the backend on the visitor's behalf, with the request id", async () => {
      const fetch = backendAnswers({ status: "error" })

      const response = await get(`/invite/${LINK_ID}`, {
        "cf-connecting-ip": "203.0.113.9",
      })

      const [url, init] = fetch.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ]
      expect(url).toBe(
        `https://abalone.tudu.dev/api/v1/invite-links/${LINK_ID}`,
      )
      const headers = new Headers(init.headers)
      expect(headers.get("cf-connecting-ip")).toBe("203.0.113.9")
      expect(headers.get("x-request-id")).toBe(
        response.headers.get("x-request-id"),
      )
    })

    it("names nobody for a link the backend does not know", async () => {
      backendAnswers({ status: "error" })

      const page = await (await get(`/invite/${LINK_ID}`)).text()

      expect(page).toContain("<title>Invite · Abalone</title>")
    })

    it("names nobody when the backend cannot be reached", async () => {
      worker.bindings.BACKEND = {
        fetch: vi.fn(async () => {
          throw new Error("unreachable")
        }),
      }

      const page = await (await get(`/invite/${LINK_ID}`)).text()

      expect(page).toContain("<title>Invite · Abalone</title>")
    })

    it("reads the link at VITE_BACKEND_URL when there is no binding", async () => {
      const fetch = vi.fn(async (_url: string) =>
        Response.json({
          status: "success",
          data: { inviterName: "Ada", state: "open" },
        }),
      )
      vi.stubGlobal("fetch", fetch)

      const page = await (await get(`/invite/${LINK_ID}`)).text()

      expect(fetch.mock.calls[0]?.[0]).toBe(
        `http://localhost:8181/api/v1/invite-links/${LINK_ID}`,
      )
      expect(page).toContain("Ada invited you")
    })

    it("serves the plain shell with no backend at all", async () => {
      vi.stubGlobal("fetch", vi.fn())
      const page = await (await get(`/invite/${LINK_ID}`)).text()

      expect(page).toContain("Invite · Abalone")
    })

    it("does the same under a language prefix", async () => {
      backendAnswers({
        status: "success",
        data: { inviterName: "Kasparov", state: "open" },
      })

      const page = await (await get(`/pt/invite/${LINK_ID}`)).text()

      expect(page).toContain("Kasparov invited you")
    })

    it("is not read for a path that is not a 43-character token", async () => {
      const fetch = backendAnswers({ status: "error" })

      await get("/invite/short")

      expect(fetch).not.toHaveBeenCalled()
      expect(worker.handler.fetch).toHaveBeenCalledTimes(1)
    })

    it("is not read for a HEAD request", async () => {
      const fetch = backendAnswers({ status: "error" })

      await entry.fetch(
        new Request(`https://abalone.tudu.dev/invite/${LINK_ID}`, {
          method: "HEAD",
        }),
      )

      expect(fetch).not.toHaveBeenCalled()
    })
  })
})
