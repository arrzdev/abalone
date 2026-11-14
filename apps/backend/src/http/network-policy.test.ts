import { env } from "cloudflare:workers"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { envRegistry } from "@/env/registry"
import {
  allowsPrivateOrigins,
  frontendOrigins,
  isAllowedFrontendOrigin,
} from "@/http/network-policy"

//the suite's own FRONTEND_URLS is two public origins (vitest.config.ts), which
//is production. the dev cases swap the value in and put it back afterwards.
describe("network policy", () => {
  beforeAll(() => {
    envRegistry.setEnv(env as unknown as Record<string, unknown>)
  })

  afterEach(() => {
    envRegistry.setEnv({ FRONTEND_URLS: env.FRONTEND_URLS })
  })

  function configure(frontendUrls: string) {
    envRegistry.setEnv({ FRONTEND_URLS: frontendUrls })
  }

  describe("frontendOrigins", () => {
    it("lists every configured origin", () => {
      expect(frontendOrigins()).toEqual([
        "http://example.com",
        "http://second.example.com",
      ])
    })

    it("keeps only the origin of each entry and skips junk", () => {
      configure(
        " https://abalone.example/play/ ,, not a url,https://b.example:8443/x",
      )

      expect(frontendOrigins()).toEqual([
        "https://abalone.example",
        "https://b.example:8443",
      ])
    })

    it("picks up a changed value", () => {
      configure("https://first.example")
      expect(frontendOrigins()).toEqual(["https://first.example"])

      configure("https://second.example")
      expect(frontendOrigins()).toEqual(["https://second.example"])
    })
  })

  describe("allowsPrivateOrigins", () => {
    it("is off for a public frontend", () => {
      expect(allowsPrivateOrigins()).toBe(false)
    })

    it("is on when every frontend origin is private", () => {
      configure("http://localhost:6161,http://192.168.1.20:6161")

      expect(allowsPrivateOrigins()).toBe(true)
    })

    //a stray localhost in a production list must not switch dev mode on
    it("is off when a public origin sits next to a private one", () => {
      configure("https://abalone.example,http://localhost:6161")

      expect(allowsPrivateOrigins()).toBe(false)
    })

    it("is off when nothing usable is configured", () => {
      configure("not a url")

      expect(allowsPrivateOrigins()).toBe(false)
    })
  })

  describe("isAllowedFrontendOrigin", () => {
    it("allows each configured origin", () => {
      expect(isAllowedFrontendOrigin("http://example.com")).toBe(true)
      expect(isAllowedFrontendOrigin("http://second.example.com")).toBe(
        true,
      )
    })

    it.each([
      "http://attacker.example.net",
      //same host, other scheme or port: a different origin
      "https://example.com",
      "http://example.com:8080",
      "http://sub.example.com",
      //an origin header never carries a path, and one that does is not ours
      "http://example.com/",
      "",
      "null",
    ])("refuses %j against a public frontend", (origin) => {
      expect(isAllowedFrontendOrigin(origin)).toBe(false)
    })

    it.each([
      "http://localhost:6161",
      "http://10.0.0.5:6161",
      "http://[::1]:6161",
    ])(
      "refuses the private origin %s against a public frontend",
      (origin) => {
        expect(isAllowedFrontendOrigin(origin)).toBe(false)
      },
    )

    it("allows any private origin when the frontend itself is private", () => {
      configure("http://localhost:6161")

      expect(isAllowedFrontendOrigin("http://localhost:6161")).toBe(true)
      expect(isAllowedFrontendOrigin("http://192.168.1.20:7171")).toBe(
        true,
      )
    })

    it("still refuses a public origin when the frontend is private", () => {
      configure("http://localhost:6161")

      expect(isAllowedFrontendOrigin("https://attacker.example.net")).toBe(
        false,
      )
    })

    it("refuses IPv6 and 127.0.0.1 loopback even in dev mode", () => {
      configure("http://localhost:6161")

      expect(isAllowedFrontendOrigin("http://[::1]:6161")).toBe(false)
      expect(isAllowedFrontendOrigin("http://127.0.0.1:6161")).toBe(false)
    })
  })
})
