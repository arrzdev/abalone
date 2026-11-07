import { describe, expect, it } from "vitest"
import type { NativAppConfig } from "#nativ/config/app-config.ts"
import { renderRootGen } from "#nativ/vite/stamp.ts"

function configWithRouter(
  router: Partial<NativAppConfig["router"]>,
): NativAppConfig {
  return {
    name: "Test",
    styles: "./src/styles/main.css",
    themeColor: { light: "#fff" },
    router: {
      generatedRouteTree: "./routing/routeTree.gen.ts",
      routesDirectory: "./routing",
      ...router,
    },
  } as NativAppConfig
}

describe("renderRootGen styles", () => {
  it("links the stylesheet by url when inlining is off", () => {
    const source = renderRootGen(configWithRouter({}))
    expect(source).toContain(
      'import appStyles from "@/styles/main.css?url"',
    )
    expect(source).toContain("stylesEntryPoint: appStyles")
  })

  it("imports the stylesheet for Start to inline when inlineCss is on", () => {
    const source = renderRootGen(configWithRouter({ inlineCss: true }))
    expect(source).toContain('import "@/styles/main.css"')
    expect(source).not.toContain("?url")
    expect(source).not.toContain("stylesEntryPoint")
  })
})
