import { describe, expect, it } from "vitest"
import { index, rootRoute, route } from "#nativ/routes/nativ-routes"

describe("rootRoute", () => {
  it("wires the generated root file when given only children", () => {
    const tree = rootRoute([index("pages/home.tsx")])

    expect(tree).toEqual({
      type: "root",
      file: "layouts/__root.gen.tsx",
      children: [{ type: "index", file: "pages/home.tsx" }],
    })
  })

  it("wires the generated root file when given nothing", () => {
    expect(rootRoute()).toEqual({
      type: "root",
      file: "layouts/__root.gen.tsx",
      children: undefined,
    })
  })

  it("keeps an explicit root file so an app can eject", () => {
    const tree = rootRoute("layouts/_root.tsx", [
      route("/settings", "pages/settings.tsx"),
    ])

    expect(tree.file).toBe("layouts/_root.tsx")
    expect(tree.children).toEqual([
      { type: "route", path: "/settings", file: "pages/settings.tsx" },
    ])
  })
})
