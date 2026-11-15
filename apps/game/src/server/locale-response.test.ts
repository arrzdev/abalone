import { describe, expect, it } from "vitest"
import {
  redirectResponse,
  withDocumentLanguage,
  withVaryOnVisitor,
} from "@/server/locale-response"

//`withDocumentLanguage` rewrites the page with Cloudflare's HTMLRewriter, which
//exists in the Workers runtime and nowhere else. only its early returns, the
//ones that hand the response back untouched, are reachable here.

function page(contentType: string | null): Response {
  return new Response("<html></html>", {
    headers: contentType ? { "content-type": contentType } : {},
  })
}

describe("redirectResponse", () => {
  it("moves to the location with the status it was given", () => {
    const response = redirectResponse({
      location: "/pt/rules",
      status: 302,
    })

    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe("/pt/rules")
    expect(response.body).toBeNull()
  })

  it("says the answer depends on the visitor", () => {
    const response = redirectResponse({ location: "/rules", status: 301 })

    expect(response.headers.get("vary")).toBe("Accept-Language, Cookie")
  })
})

describe("withVaryOnVisitor", () => {
  it("adds the visitor's headers to a page", async () => {
    const response = withVaryOnVisitor(page("text/html; charset=utf-8"))

    expect(response.headers.get("vary")).toBe("Accept-Language, Cookie")
    expect(await response.text()).toBe("<html></html>")
  })

  it("keeps a Vary the page already had", () => {
    const original = new Response("", {
      headers: { "content-type": "text/html", vary: "Accept-Encoding" },
    })

    const vary = withVaryOnVisitor(original).headers.get("vary")

    expect(vary).toContain("Accept-Encoding")
    expect(vary).toContain("Accept-Language")
    expect(vary).toContain("Cookie")
  })

  it("leaves anything that is not html alone", () => {
    const json = page("application/json")
    expect(withVaryOnVisitor(json)).toBe(json)

    const untyped = page(null)
    expect(withVaryOnVisitor(untyped)).toBe(untyped)
    expect(untyped.headers.get("vary")).toBeNull()
  })
})

describe("withDocumentLanguage", () => {
  it("leaves an english page alone: it is what the shell already says", () => {
    const html = page("text/html")
    expect(withDocumentLanguage(html, "en")).toBe(html)
  })

  it("leaves anything that is not html alone", () => {
    const json = page("application/json")
    expect(withDocumentLanguage(json, "pt")).toBe(json)
  })
})
