import type { RoutesInterface } from "@repo/backend/http/interface"
import tryCatch from "@repo/shared/try-catch"
import { hc } from "hono/client"
import { getBearerToken } from "@/data/auth/token"
import { env } from "@/env/registry"

//resolved once: in dev the backend shares the host but runs on its own port, so
//keep the configured port and take the hostname from wherever the page was
//loaded — that is what makes a phone on the LAN work without editing env. in
//production it is the configured url verbatim.
export const backendBaseUrl = (() => {
  const configured = env.VITE_BACKEND_URL

  if (import.meta.env.DEV && typeof window !== "undefined") {
    const { port } = new URL(configured)
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}${port ? `:${port}` : ""}`
  }

  return configured.trim().replace(/\/$/, "")
})()

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
