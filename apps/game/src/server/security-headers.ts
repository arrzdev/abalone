/**
 * The header policy for every response the game sends. Worker responses (every
 * page) get it from `withSecurityHeaders` in `src/server.ts`; static files get
 * the same values from `public/_headers`, which Workers Static Assets applies
 * and which never reaches the Worker. A test keeps the two equal.
 *
 * HSTS without includeSubDomains or preload: other tudu.dev hosts are not all on
 * Workers. The CSP is report-only (console, no collector) until it runs clean.
 */

const CSP = [
  "default-src 'self'",
  //the Cloudflare Web Analytics beacon (`@/utils/web-analytics`)
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  //the backend and its realtime socket are on the page's own origin (/api);
  //the beacon reports to cloudflareinsights.com
  "connect-src 'self' https://cloudflareinsights.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ")

export const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy-Report-Only": CSP,
} as const

/** Build files under /assets/ carry a content hash in the name: never stale. */
export const CACHE_HASHED_ASSET = "public, max-age=31536000, immutable"
/** A page: browsers revalidate every time, a shared cache may keep it a minute. */
export const CACHE_PUBLIC_HTML =
  "public, max-age=0, s-maxage=60, must-revalidate"
/** A response that sets a cookie: no cache keeps it. */
export const CACHE_PRIVATE = "private, no-store"

/** The security headers on any response, and the cache policy on pages and cookie responses. */
export function withSecurityHeaders(response: Response): Response {
  //copy instead of mutating: a fetched or streamed response can carry immutable headers
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(SECURITY_HEADERS))
    headers.set(name, value)
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
