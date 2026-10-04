import type { RoutesInterface } from "@repo/backend/http/interface"
import tryCatch from "@repo/shared/try-catch"
import { hc } from "hono/client"
import { endSession } from "@/data/auth/session-end"
import { getBearerToken } from "@/data/auth/token"
import { env } from "@/env/registry"

const PRERENDER_ORIGIN = "http://localhost"

/**
 * The origin every api call goes to, without a trailing slash.
 *
 * In production the api is served under /api on whichever domain the game was
 * loaded from, so it is the page's own origin and calls stay same-origin. In dev
 * the backend runs on its own port, so keep the configured port and take the
 * hostname from the page — that is what makes a phone on the LAN work without
 * editing env. With no page (the build's prerender) there is no origin to take,
 * and nothing is called, but better-auth's client still insists on an absolute
 * url when it is built, so it gets a placeholder that is never fetched.
 */
export function resolveBackendBaseUrl(options: {
  isDev: boolean
  configured: string | undefined
  location: Pick<Location, "origin" | "protocol" | "hostname"> | undefined
}): string {
  const location = options.location
  if (!location) return PRERENDER_ORIGIN
  if (!options.isDev || !options.configured) return location.origin

  const { port } = new URL(options.configured)
  return `${location.protocol}//${location.hostname}${port ? `:${port}` : ""}`
}

export const backendBaseUrl = resolveBackendBaseUrl({
  isDev: import.meta.env.DEV,
  configured: env.VITE_BACKEND_URL,
  location: typeof window === "undefined" ? undefined : window.location,
})

//auto-inject the session bearer token on every RPC call, so no call site ever
//attaches an Authorization header by hand
export const api = hc<RoutesInterface>(backendBaseUrl, {
  headers(): Record<string, string> {
    const token = getBearerToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  },
})

/**
 * Multipart POST, the one thing the RPC client cannot type.
 *
 * Hono's client builds its body from the route's declared validators, and an
 * avatar upload has none to declare, so this is the sanctioned way past it. It
 * still goes through the same base url and the same bearer token, which is the
 * reason it lives here rather than as a bare `fetch` at the call site.
 */
export function postFormData(
  path: string,
  form: FormData,
  signal?: AbortSignal,
): Promise<Response> {
  const token = getBearerToken()
  return fetch(`${backendBaseUrl}${path}`, {
    method: "POST",
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  })
}

//only for fetch/client throws — envelope handling stays in queryFn / mutationFn
export async function withClientRequest<T>(
  run: () => Promise<T>,
): Promise<T> {
  const [data, error] = await tryCatch(run)
  if (!error) return data
  if (error.name === "AbortError") throw error
  throw new Error("network_unreachable", { cause: error })
}

/**
 * The failure an api answer describes, and the one place a dead session is
 * noticed.
 *
 * Every read and write in `data/` throws this rather than a bare `Error`, so
 * `unauthorized` — the server saying this token buys nothing — ends the session
 * on the way past instead of arriving as a sentence on a screen the player can
 * no longer load. The code still crosses into the message, which is what the
 * screens translate.
 */
export function apiError(errorCode: string): Error {
  if (errorCode === "unauthorized") endSession()
  return new Error(errorCode)
}
