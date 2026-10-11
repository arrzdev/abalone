import { describe, expect, it } from "vitest"
import { finishResultOf } from "@/utils/game-events"

describe("finishResultOf", () => {
  //against a bot, the result is the human's: they are the one we count
  it.each([
    ["black", "black", "win"],
    ["black", "white", "loss"],
    ["white", "white", "win"],
    ["white", "black", "loss"],
    ["black", null, "draw"],
  ] as const)(
    "a bot game played as %s and won by %s is a %s",
    (playerColor, winner, result) => {
      expect(finishResultOf({ mode: "ai", playerColor, winner })).toBe(
        result,
      )
    },
  )

  //pass and play has two humans at one device, so the result is the colour
  it.each([
    ["black", "black"],
    ["white", "white"],
    [null, "draw"],
  ] as const)("a pass and play game won by %s is %s", (winner, result) => {
    expect(
      finishResultOf({ mode: "local", playerColor: "black", winner }),
    ).toBe(result)
  })
})
