import { describe, expect, it } from "vitest"
import type { Game } from "@/data/online/queries"
import { gameCardOf } from "@/utils/game-card"

const ME = "me"
const THEM = "them"

const CREATED = Date.UTC(2026, 9, 1, 12)
const MOVED = Date.UTC(2026, 9, 3, 9)

/** A game I hold black in, opened on the 1st, last moved on the 3rd. */
function game(overrides: Partial<Game> = {}): Game {
  return {
    id: "game-1",
    status: "active",
    setupType: "standard",
    black: { userId: ME, name: "Me", avatarUrl: null },
    white: {
      userId: THEM,
      name: "Rival",
      avatarUrl: "https://cdn/x.webp",
    },
    blackCells: [],
    whiteCells: [],
    blackScore: 0,
    whiteScore: 0,
    currentTurn: "black",
    moveCount: 4,
    winner: null,
    finishReason: null,
    createdAt: CREATED,
    updatedAt: MOVED,
    ...overrides,
  } as Game
}

//one card for every game on the hub. what it says comes from these few
//readings, so each state the card can be in is pinned here once, from both
//seats, rather than in markup.
describe("gameCardOf", () => {
  it("names the opponent by their one name and face", () => {
    expect(gameCardOf(game(), ME).opponent).toEqual({
      name: "Rival",
      avatarUrl: "https://cdn/x.webp",
    })
  })

  it("says it is my move when the turn is my seat's", () => {
    expect(gameCardOf(game({ currentTurn: "black" }), ME).turn).toBe(
      "mine",
    )
  })

  it("says it is their move when the turn is the other seat's", () => {
    expect(gameCardOf(game({ currentTurn: "white" }), ME).turn).toBe(
      "theirs",
    )
  })

  it("reads the turn from the white seat too", () => {
    const asWhite = game({
      black: { userId: THEM, name: "Rival", avatarUrl: null },
      white: { userId: ME, name: "Me", avatarUrl: null },
      currentTurn: "white",
    } as Partial<Game>)

    expect(gameCardOf(asWhite, ME).turn).toBe("mine")
    expect(gameCardOf(asWhite, ME).opponent.name).toBe("Rival")
  })

  it("puts my score first and says who leads", () => {
    const card = gameCardOf(game({ blackScore: 3, whiteScore: 1 }), ME)

    expect(card.score).toEqual({ mine: 3, theirs: 1, leader: "mine" })
  })

  it("calls a level score level", () => {
    const card = gameCardOf(game({ blackScore: 2, whiteScore: 2 }), ME)

    expect(card.score.leader).toBe("level")
  })

  it("says they lead when they have pushed more off", () => {
    const card = gameCardOf(game({ blackScore: 0, whiteScore: 2 }), ME)

    expect(card.score.leader).toBe("theirs")
  })

  it("carries when the game started and when the last move was", () => {
    const card = gameCardOf(game(), ME)

    expect(card.startedAt).toBe(CREATED)
    expect(card.lastMoveAt).toBe(MOVED)
  })

  it("has no last move before anyone has moved", () => {
    const card = gameCardOf(game({ moveCount: 0, updatedAt: CREATED }), ME)

    expect(card.lastMoveAt).toBeNull()
  })

  it("has no turn once the game is over, and says how it went for me", () => {
    const won = gameCardOf(
      game({ status: "finished", winner: "black" }),
      ME,
    )
    const lost = gameCardOf(
      game({ status: "finished", winner: "white" }),
      ME,
    )
    const drawn = gameCardOf(
      game({ status: "finished", winner: null }),
      ME,
    )

    expect(won.turn).toBe("over")
    expect(won.result).toBe("won")
    expect(lost.result).toBe("lost")
    expect(drawn.result).toBe("draw")
  })

  it("has no result while the game is on", () => {
    expect(gameCardOf(game(), ME).result).toBeNull()
  })
})
