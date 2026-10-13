import { describe, expect, it } from "vitest"
import { playerName } from "@/utils/player-summary"

describe("playerName", () => {
  it("is the handle as its owner typed it", () => {
    expect(
      playerName({
        displayUsername: "Shouter",
        username: "shouter",
        accountName: "Sam",
      }),
    ).toBe("Shouter")
  })

  it("is the stored handle when no display form exists", () => {
    expect(
      playerName({
        displayUsername: null,
        username: "shouter",
        accountName: "Sam",
      }),
    ).toBe("shouter")
  })

  it("is the account name for an account that never picked a handle", () => {
    expect(
      playerName({
        displayUsername: null,
        username: null,
        accountName: "Sam",
      }),
    ).toBe("Sam")
  })
})
