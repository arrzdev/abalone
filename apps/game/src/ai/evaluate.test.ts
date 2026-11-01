import { BOARD_SETUPS } from "@repo/abalone-engine/board-setups"
import {
  BLACK,
  positionFromNames,
  WHITE,
} from "@repo/abalone-engine/position"
import { describe, expect, it } from "vitest"
import type { ScoringWeights } from "@/ai/evaluate"
import { scorePosition } from "@/ai/evaluate"
import { profileFor, STRONGEST } from "@/ai/profiles"

//the evaluator reads a position through a set of weights. each case switches
//on one weight, so a number that moves can only have come from that one idea.

const NO_WEIGHTS: ScoringWeights = {
  capture: 0,
  centre: 0,
  cohesion: 0,
  edgePressure: 0,
  shovePotential: 0,
  chase: 0,
  charge: 0,
  recklessness: 0,
  loner: 0,
}

function only(weights: Partial<ScoringWeights>): ScoringWeights {
  return { ...NO_WEIGHTS, ...weights }
}

function score(
  black: string[],
  white: string[],
  weights: ScoringWeights,
  sideToMove: typeof BLACK | typeof WHITE = BLACK,
): number {
  return scorePosition(
    positionFromNames(black, white),
    sideToMove,
    weights,
  )
}

/**
 * Black holds the middle, and the three squares behind the rim marble at -2,4
 * (-1,3, 0,2, 1,1) form a queue pointing at it.
 */
const BLACK_CLUSTER = [
  "0,0",
  "0,1",
  "1,0",
  "1,-1",
  "0,-1",
  "-1,0",
  "-1,1",
  "0,2",
  "1,1",
  "-1,3",
]

describe("scorePosition", () => {
  it("scores zero for any weights when the position is symmetrical", () => {
    const { black, white } = BOARD_SETUPS.standard
    const names = (marbles: [number, number][]) =>
      marbles.map(([r, q]) => `${r},${q}`)

    expect(
      score(names(black), names(white), profileFor(STRONGEST)),
    ).toBeCloseTo(0, 10)
  })

  it("gives the opposite score when the colours and the mover are swapped", () => {
    const black = ["0,0", "1,0", "-2,1", "3,-3"]
    const white = ["0,1", "-1,2", "4,-2", "-3,0"]
    const weights = profileFor(STRONGEST)

    const asBlack = score(black, white, weights, BLACK)
    const swapped = score(white, black, weights, WHITE)

    expect(asBlack).not.toBe(0)
    expect(swapped).toBeCloseTo(-asBlack, 10)
  })

  it("scores zero when every weight is zero and nobody has lost", () => {
    expect(score(["0,0"], ["0,1"], NO_WEIGHTS)).toBe(0)
  })

  it("counts each captured marble as one point for the side that took it", () => {
    const fewerWhite = score(
      ["0,0", "1,0", "2,0"],
      ["0,1", "0,2"],
      only({ capture: 1 }),
    )
    const fewerBlack = score(
      ["0,0", "1,0"],
      ["0,1", "0,2", "0,3"],
      only({ capture: 1 }),
    )

    expect(fewerWhite).toBe(1)
    expect(fewerBlack).toBe(-1)
  })

  it("scales a term by its weight", () => {
    const once = score(["0,0"], ["0,4"], only({ centre: 1 }))
    const twice = score(["0,0"], ["0,4"], only({ centre: 2 }))

    expect(once).toBeGreaterThan(0)
    expect(twice).toBeCloseTo(once * 2, 10)
  })

  it("is decided once a side is down to its survivors", () => {
    //eight marbles left is six lost, which is the game
    const survivors = [
      "-4,0",
      "-4,1",
      "-4,2",
      "-4,3",
      "-3,0",
      "-3,1",
      "-3,2",
      "-3,3",
    ]
    const ahead = [
      "4,0",
      "4,-1",
      "4,-2",
      "4,-3",
      "3,0",
      "3,-1",
      "3,-2",
      "3,-3",
      "0,0",
    ]
    const weights = only({ capture: 1 })

    expect(score(ahead, survivors, weights)).toBeGreaterThan(100)
    expect(score(survivors, ahead, weights)).toBeLessThan(-100)
  })

  describe("the centre", () => {
    it("favours the side holding the middle", () => {
      const weights = only({ centre: 1 })

      expect(score(["0,0"], ["0,4"], weights)).toBeCloseTo(4 / 36, 10)
      expect(score(["0,4"], ["0,0"], weights)).toBeCloseTo(-4 / 36, 10)
    })

    it("values a ring-one square less than the middle and more than the rim", () => {
      const weights = only({ centre: 1 })
      const middle = score(["0,0"], ["0,4"], weights)
      const ringOne = score(["0,1"], ["0,4"], weights)
      const ringTwo = score(["0,2"], ["0,4"], weights)

      expect(middle).toBeGreaterThan(ringOne)
      expect(ringOne).toBeGreaterThan(ringTwo)
      expect(ringTwo).toBeGreaterThan(0)
    })
  })

  describe("cohesion", () => {
    it("favours marbles that stand together", () => {
      const weights = only({ cohesion: 1 })
      const together = ["0,0", "0,1"]
      const apart = ["-4,0", "4,-4"]

      expect(score(together, apart, weights)).toBeGreaterThan(0)
      expect(score(apart, together, weights)).toBeLessThan(0)
    })

    it("has nothing to say about a lone marble", () => {
      expect(score(["0,0"], ["4,-4"], only({ cohesion: 1 }))).toBe(0)
    })
  })

  describe("loners", () => {
    it("counts marbles with no neighbour, and a positive weight wants more of them", () => {
      const weights = only({ loner: 1 })
      const scattered = ["-3,0", "3,0"]
      const paired = ["0,0", "0,1"]

      expect(score(scattered, paired, weights)).toBeCloseTo(2 / 14, 10)
      expect(score(paired, scattered, weights)).toBeCloseTo(-2 / 14, 10)
    })
  })

  describe("recklessness", () => {
    it("rates a marble on the rim as exposed and one in the middle as safe", () => {
      const weights = only({ recklessness: 1 })

      expect(score(["0,4"], ["0,0"], weights)).toBeCloseTo(2 / 28, 10)
      expect(score(["0,0"], ["0,4"], weights)).toBeCloseTo(-2 / 28, 10)
    })

    it("ignores marbles that are more than two rings in", () => {
      expect(score(["0,2"], ["0,0"], only({ recklessness: 1 }))).toBe(0)
    })
  })

  describe("charge", () => {
    it("measures how far each side has driven towards the other's end", () => {
      const weights = only({ charge: 1 })

      //black opens on the bottom rows, so row -4 is as far as it can go; white
      //on that same row has not moved from home
      expect(score(["-4,0"], ["-4,1"], weights)).toBe(1)
      expect(score(["4,0"], ["4,-1"], weights)).toBe(-1)
    })
  })

  describe("chase", () => {
    it("rewards the side whose marbles stay closer to the other's", () => {
      const weights = only({ chase: 1 })
      const hunter = ["0,0"]
      const nearAndFar = ["0,1", "0,-4"]

      expect(score(hunter, nearAndFar, weights)).toBeGreaterThan(0)
    })

    it("is zero when a side has nobody to chase", () => {
      expect(score(["0,0"], [], only({ chase: 1 }))).toBe(0)
    })
  })

  describe("attacking terms", () => {
    const rimMarble = ["-2,4"]

    it("reward pressing a marble on the rim once the mover holds the middle", () => {
      const weights = only({ edgePressure: 1 })

      expect(
        score(BLACK_CLUSTER, rimMarble, weights, BLACK),
      ).toBeGreaterThan(0)
    })

    it("stay switched off for a mover who does not hold the middle", () => {
      const weights = only({ edgePressure: 1, shovePotential: 1 })

      //the same board, but it is the side with nothing in the middle to move
      expect(score(BLACK_CLUSTER, rimMarble, weights, WHITE)).toBe(0)
    })

    it("reward a queue lined up behind a marble on the rim", () => {
      const weights = only({ shovePotential: 1 })
      const queued = score(BLACK_CLUSTER, rimMarble, weights, BLACK)
      const gapped = score(
        BLACK_CLUSTER.filter((cell) => cell !== "-1,3"),
        rimMarble,
        weights,
        BLACK,
      )

      expect(queued).toBeGreaterThan(0)
      expect(gapped).toBeLessThan(queued)
    })

    it("count a longer queue for more than the same marbles scattered", () => {
      const weights = only({ shovePotential: 1 })
      const threeDeep = score(BLACK_CLUSTER, rimMarble, weights, BLACK)
      const oneBehind = score(
        BLACK_CLUSTER.filter((cell) => !["0,2", "1,1"].includes(cell)),
        rimMarble,
        weights,
        BLACK,
      )

      expect(threeDeep).toBeGreaterThan(oneBehind)
    })

    it("trade some of the centre's weight away as the lead grows", () => {
      const weights = only({ centre: 1 })
      const small = score(["0,0"], ["0,4"], weights, BLACK)
      const large = score(BLACK_CLUSTER, rimMarble, weights, BLACK)
      const largeUnmoved = score(BLACK_CLUSTER, rimMarble, weights, WHITE)

      expect(small).toBeGreaterThan(0)
      //the mover holding the middle discounts it, a mover who does not keeps it
      expect(large).toBeLessThan(largeUnmoved)
    })
  })
})
