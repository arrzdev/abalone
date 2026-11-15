import { vi } from "vitest"

//the api client calls `fetch(url, init)`; this stands in for it and writes down
//what went out, so a data-layer test can assert the url, the method, the
//headers and the json body without a network. undone by `vi.unstubAllGlobals()`.

export type SentRequest = {
  url: string
  method: string
  headers: Headers
  /** The json body, or undefined when the request carried none. */
  json: unknown
}

export type FetchStub = {
  /** Every request made, in order. */
  sent: SentRequest[]
  /** The most recent request. */
  last: () => SentRequest
}

/** An api answer: `body` as json under `status`. */
export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

/** Answers every request with `respond`, or throws what it throws. */
export function stubFetch(
  respond: (request: SentRequest) => Response | Promise<Response>,
): FetchStub {
  const sent: SentRequest[] = []

  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body
      const request: SentRequest = {
        url: String(input),
        method: init?.method ?? "GET",
        headers: new Headers(init?.headers),
        json: typeof body === "string" ? JSON.parse(body) : undefined,
      }
      sent.push(request)
      return respond(request)
    },
  )

  return {
    sent,
    last: () => {
      const request = sent.at(-1)
      if (!request) throw new Error("no request was made")
      return request
    },
  }
}
