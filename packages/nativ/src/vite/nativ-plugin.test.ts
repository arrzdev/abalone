import { describe, expect, it } from "vitest"
import type { NativAppConfig } from "#nativ/config/app-config.ts"
import { deriveStartOptions } from "#nativ/vite/nativ-plugin.ts"

function configWithRouter(
  router: Partial<NativAppConfig["router"]>,
): NativAppConfig {
  return {
    router: {
      generatedRouteTree: "./routing/routeTree.gen.ts",
      routesDirectory: "./routing",
      ...router,
    },
  } as NativAppConfig
}

describe("deriveStartOptions", () => {
  it("leaves the stylesheet linked when the app does not ask for inlining", () => {
    const options = deriveStartOptions(configWithRouter({}), false, false)
    expect(options).not.toHaveProperty("server.build")
  })

  it("passes inlineCss: true to Start's server build", () => {
    const options = deriveStartOptions(
      configWithRouter({ inlineCss: true }),
      false,
      false,
    )
    expect(options.server?.build?.inlineCss).toBe(true)
  })

  it("passes inlineCss: false through as an explicit off", () => {
    const options = deriveStartOptions(
      configWithRouter({ inlineCss: false }),
      false,
      false,
    )
    expect(options.server?.build?.inlineCss).toBe(false)
  })

  it("keeps the server entry next to the build option", () => {
    const options = deriveStartOptions(
      configWithRouter({ inlineCss: true, serverEntry: "./server.ts" }),
      false,
      false,
    )
    expect(options.server).toEqual({
      entry: "./server.ts",
      build: { inlineCss: true },
    })
  })
})
