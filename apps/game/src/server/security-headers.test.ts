//node, not happy-dom: happy-dom drops Set-Cookie from a Response, as a browser does
// @vitest-environment node
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  CACHE_HASHED_ASSET,
  CACHE_PRIVATE,
  CACHE_PUBLIC_HTML,
  SECURITY_HEADERS,
  withSecurityHeaders,
} from "@/server/security-headers"

function serve(
  init: { contentType?: string; headers?: Record<string, string> } = {},
) {
  const response = new Response("<html></html>", {
    status: 200,
    headers: {
      "Content-Type": init.contentType ?? "text/html; charset=utf-8",
      ...init.headers,
    },
  })
  return withSecurityHeaders(response).headers
}

//the `_headers` rules by path pattern: { "/*": { header: value } }
function parseHeadersFile(path: string) {
  const rules: Record<string, Record<string, string>> = {}
  let current: Record<string, string> | undefined
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue
    if (!/^\s/.test(line)) {
      current = {}
      rules[line.trim()] = current
      continue
    }
    const [name, ...value] = line.trim().split(":")
    if (current) current[name.trim()] = value.join(":").trim()
  }
  return rules
}

describe("withSecurityHeaders", () => {
  it("sends the security headers on every Worker response", () => {
    for (const headers of [
      serve(),
      serve({ contentType: "text/plain" }),
    ]) {
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        expect(headers.get(name)).toBe(value)
      }
    }
  })

  it("pins the header policy", () => {
    expect(SECURITY_HEADERS["Strict-Transport-Security"]).toBe(
      "max-age=31536000",
    )
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff")
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin",
    )
    const csp = SECURITY_HEADERS["Content-Security-Policy-Report-Only"]
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    //the analytics beacon is the only third-party script
    expect(csp).toContain("https://static.cloudflareinsights.com")
  })

  it("lets a public page be cached briefly by a shared cache", () => {
    expect(serve().get("Cache-Control")).toBe(CACHE_PUBLIC_HTML)
    expect(CACHE_PUBLIC_HTML).toBe(
      "public, max-age=0, s-maxage=60, must-revalidate",
    )
  })

  it("never lets a shared cache keep a cookie", () => {
    expect(
      serve({ headers: { "Set-Cookie": "a=b" } }).get("Cache-Control"),
    ).toBe(CACHE_PRIVATE)
    expect(
      serve({
        contentType: "application/json",
        headers: { "Set-Cookie": "a=b", "Cache-Control": "public" },
      }).get("Cache-Control"),
    ).toBe(CACHE_PRIVATE)
    expect(CACHE_PRIVATE).toBe("private, no-store")
  })

  //the invite card names its sender until the link is used (invite-page.ts)
  it("keeps a page that already forbids caching uncached", () => {
    expect(
      serve({ headers: { "Cache-Control": "private, no-store" } }).get(
        "Cache-Control",
      ),
    ).toBe(CACHE_PRIVATE)
    expect(
      serve({ headers: { "Cache-Control": "no-store" } }).get(
        "Cache-Control",
      ),
    ).toBe(CACHE_PRIVATE)
  })

  it("leaves the cache policy of other responses alone", () => {
    expect(
      serve({
        contentType: "text/plain",
        headers: { "Cache-Control": "public, max-age=3600" },
      }).get("Cache-Control"),
    ).toBe("public, max-age=3600")
  })
})

describe("public/_headers", () => {
  const rules = parseHeadersFile(`${process.cwd()}/public/_headers`)

  it("sends the same security headers on every static asset", () => {
    expect(rules["/*"]).toEqual(SECURITY_HEADERS)
  })

  it("caches hashed build assets forever", () => {
    expect(rules["/assets/*"]).toEqual({
      "Cache-Control": CACHE_HASHED_ASSET,
    })
    expect(CACHE_HASHED_ASSET).toBe("public, max-age=31536000, immutable")
  })
})
