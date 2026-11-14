/**
 * The header policy for every response the game sends. Worker responses (every
 * page) get it from `withSecurityHeaders` in `src/server.ts`; static files get
 * the same values from `public/_headers`, which Workers Static Assets applies
 * and which never reaches the Worker. A test keeps the two equal.
 *
 * HSTS without includeSubDomains or preload: other tudu.dev hosts are not all on
 * Workers. The CSP is enforced; there is no report endpoint.
 */

//the policy for a page. `devBackend` is the backend's own origin, only for a dev
//or e2e run, where it sits on another port than the page; production serves
//the api under /api on the page's origin and passes nothing
function buildPolicy(devBackend: readonly string[]): string {
  return [
    "default-src 'self'",
    //'unsafe-inline': TanStack Start's server render writes inline scripts into
    //every page (the router's dehydrated state and its boot code), and they
    //carry no nonce. No 'unsafe-eval': nothing the game runs needs it
    //(e2e/no-eval.spec.ts). The Cloudflare Web Analytics beacon is the one
    //third-party script (`@/utils/web-analytics`)
    "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline'",
    //avatars are served by the backend, so a dev or e2e one needs it here too
    [
      "img-src 'self' data: https:",
      ...devBackend.filter((source) => !source.startsWith("ws")),
    ].join(" "),
    "font-src 'self' data:",
    //the backend and its realtime socket are on the page's own origin (/api);
    //the beacon reports to cloudflareinsights.com
    [
      "connect-src 'self' https://cloudflareinsights.com",
      ...devBackend,
    ].join(" "),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ")
}

const CSP = buildPolicy([])

export const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": CSP,
} as const

/**
 * Where a dev or e2e backend answers for a page at `pageUrl`: the configured
 * port on the page's own hostname, as the client builds it
 * (`resolveBackendBaseUrl`), over http and the websocket scheme. Empty in
 * production, where `VITE_BACKEND_URL` is not set.
 */
export function devBackendSources(
  pageUrl: URL,
  configured: string | undefined,
): string[] {
  if (!configured) return []
  const { port } = new URL(configured)
  const host = `${pageUrl.hostname}${port ? `:${port}` : ""}`
  const socket = pageUrl.protocol === "https:" ? "wss" : "ws"
  return [`${pageUrl.protocol}//${host}`, `${socket}://${host}`]
}

/** Build files under /assets/ carry a content hash in the name: never stale. */
export const CACHE_HASHED_ASSET = "public, max-age=31536000, immutable"

/**
 * The fonts, icons, images and sounds under `public/`. They keep their names, so
 * unlike a hashed build asset they cannot be cached forever.
 */
export const CACHE_STATIC_FILE =
  "public, max-age=604800, stale-while-revalidate=86400"

/** A page: browsers revalidate every time, a shared cache may keep it a minute. */
export const CACHE_PUBLIC_HTML =
  "public, max-age=0, s-maxage=60, must-revalidate"
/** A response that sets a cookie: no cache keeps it. */
export const CACHE_PRIVATE = "private, no-store"

/** The security headers on any response, and the cache policy on pages and cookie responses. */
export function withSecurityHeaders(
  response: Response,
  devBackend: readonly string[] = [],
): Response {
  //copy instead of mutating: a fetched or streamed response can carry immutable headers
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(SECURITY_HEADERS))
    headers.set(name, value)
  if (devBackend.length > 0)
    headers.set("Content-Security-Policy", buildPolicy(devBackend))
  //a page that already forbids caching (the invite card) stays uncached
  if (
    response.headers.has("Set-Cookie") ||
    response.headers.get("Cache-Control")?.includes("no-store")
  )
    headers.set("Cache-Control", CACHE_PRIVATE)
  else if (response.headers.get("Content-Type")?.includes("text/html"))
    headers.set("Cache-Control", CACHE_PUBLIC_HTML)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
