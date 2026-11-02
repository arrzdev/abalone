import { describe, expect, it } from "vitest"
import type { Game } from "@/data/online/queries"
import { recentOpponentsOf } from "@/utils/recent-opponents"

const ME = "me"

/** A game I hold black in against `name`, last touched at `updatedAt`. */
function gameAgainst(
  name: string,
  updatedAt: number,
  overrides: Partial<Game> = {},
): Game {
  return {
    id: `game-${name}-${updatedAt}`,
    status: "finished",
    black: { userId: ME, name: "Me", avatarUrl: null },
    white: {
      userId: `user-${name.toLowerCase()}`,
      name,
      avatarUrl: `https://cdn/${name}.webp`,
    },
    updatedAt,
    ...overrides,
  } as Game
}

describe("recentOpponentsOf", () => {
  it("is empty for a player with no games", () => {
    expect(recentOpponentsOf([], ME)).toEqual([])
  })

  it("lists the other seat, whichever seat I hold, most recent first", () => {
    const asWhite = gameAgainst("Ana", 300, {
      black: { userId: "user-ana", name: "Ana", avatarUrl: null },
      white: { userId: ME, name: "Me", avatarUrl: null },
    })
    const games = [
      gameAgainst("Rui", 100),
      asWhite,
      gameAgainst("Bia", 200),
    ]

    expect(
      recentOpponentsOf(games, ME).map((entry) => entry.name),
    ).toEqual(["Ana", "Bia", "Rui"])
  })

  it("carries the picture and when they last played", () => {
    expect(recentOpponentsOf([gameAgainst("Rui", 100)], ME)).toEqual([
      {
        name: "Rui",
        avatarUrl: "https://cdn/Rui.webp",
        lastPlayedAt: 100,
      },
    ])
  })

  it("names each opponent once, at their most recent game, ignoring case", () => {
    const games = [
      gameAgainst("Rui", 100),
      gameAgainst("rui", 400),
      gameAgainst("Bia", 200),
    ]

    expect(recentOpponentsOf(games, ME)).toEqual([
      {
        name: "rui",
        avatarUrl: "https://cdn/rui.webp",
        lastPlayedAt: 400,
      },
      {
        name: "Bia",
        avatarUrl: "https://cdn/Bia.webp",
        lastPlayedAt: 200,
      },
    ])
  })

  it("never lists me, even against myself", () => {
    const solo = gameAgainst("Me", 500, {
      white: { userId: ME, name: "Me", avatarUrl: null },
    })

    expect(recentOpponentsOf([solo], ME)).toEqual([])
  })

  it("stops at four, so the rest are reached by typing", () => {
    const games = ["A", "B", "C", "D", "E", "F"].map((name, index) =>
      gameAgainst(name, index),
    )

    expect(
      recentOpponentsOf(games, ME).map((entry) => entry.name),
    ).toEqual(["F", "E", "D", "C"])
  })

  it("takes games from both lists in one go, newest across them", () => {
    const active = [gameAgainst("Ana", 900, { status: "active" })]
    const finished = [gameAgainst("Rui", 100), gameAgainst("Bia", 500)]

    expect(
      recentOpponentsOf([...finished, ...active], ME).map(
        (entry) => entry.name,
      ),
    ).toEqual(["Ana", "Bia", "Rui"])
  })
})
