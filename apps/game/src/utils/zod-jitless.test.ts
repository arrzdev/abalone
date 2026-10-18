import { describe, expect, it } from "vitest"
import { z } from "zod"
import "@/utils/zod-jitless"

describe("zod-jitless", () => {
  it("turns off zod's eval-compiled parsers", () => {
    expect(z.config().jitless).toBe(true)
  })
})
