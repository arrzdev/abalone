import { describe, expect, it } from "vitest"
import type { Game } from "@/data/online/queries"
import { countHeadToHead } from "@/hooks/use-head-to-head"

//a game as this counter reads one: two ids and a winner. everything else on a
//`Game` — the position, the setup, the clock — is beside the point here, and
//spelling all of it out per row would bury the one thing each row is testing.
function played(
  blackId: string,
  whiteId: string,
  winner: "black" | "white" | null,
): Game {
  return {
    black: { userId: blackId },
    white: { userId: whiteId },
    winner,
  } as unknown as Game
}

const ANA = "ana"
const RUI = "rui"
const STRANGER = "someone-else"

describe("countHeadToHead", () => {
  it("finds nothing between two people who have not met", () => {
    expect(countHeadToHead([], ANA, RUI)).toEqual({
      played: 0,
      blackWins: 0,
      whiteWins: 0,
    })
  })

  it("ignores games either of them played against somebody else", () => {
    const record = countHeadToHead(
      [played(ANA, STRANGER, "black"), played(STRANGER, RUI, "white")],
      ANA,
      RUI,
    )
    expect(record.played).toBe(0)
  })

  //the one this exists for: sides change from game to game, so a count kept by
  //seat rather than by person hands half of each player's wins to the other
  it("credits a win to the player, not to the colour they held", () => {
    const record = countHeadToHead(
      [
        //ana won this one as black
        played(ANA, RUI, "black"),
        //and this one as white
        played(RUI, ANA, "white"),
      ],
      ANA,
      RUI,
    )
    expect(record).toEqual({ played: 2, blackWins: 2, whiteWins: 0 })
  })

  it("reads the record from the seats of the game being played now", () => {
    const history = [played(ANA, RUI, "black"), played(ANA, RUI, "black")]

    //ana is black in this game, so both wins are on the left
    expect(countHeadToHead(history, ANA, RUI)).toMatchObject({
      blackWins: 2,
      whiteWins: 0,
    })
    //and on the right in the next one, where they have swapped
    expect(countHeadToHead(history, RUI, ANA)).toMatchObject({
      blackWins: 0,
      whiteWins: 2,
    })
  })

  it("counts a draw as played and won by neither", () => {
    expect(countHeadToHead([played(ANA, RUI, null)], ANA, RUI)).toEqual({
      played: 1,
      blackWins: 0,
      whiteWins: 0,
    })
  })
})
