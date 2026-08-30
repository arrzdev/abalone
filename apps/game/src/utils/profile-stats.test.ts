import { describe, expect, it } from "vitest"
import type { Game } from "@/data/online/queries"
import { profileStatsOf } from "@/utils/profile-stats"

const ME = "me"

//the stats read three fields off a game, and building the whole rpc shape here
//would test the contract rather than the counting
type GameStub = Pick<Game, "winner"> & {
  black: { userId: string }
}

function asGames(stubs: GameStub[]) {
  return stubs as unknown as Game[]
}

/** A finished game I played as black, won or lost. */
function black(winner: "black" | "white" | null) {
  return { winner, black: { userId: ME } } as GameStub
}

/** The same, from the other seat, so "won" is not just "black won". */
function white(winner: "black" | "white" | null) {
  return { winner, black: { userId: "them" } } as GameStub
}

describe("profileStatsOf", () => {
  it("counts nothing out of nothing", () => {
    expect(profileStatsOf([], [], ME)).toEqual({
      played: 0,
      won: 0,
      playing: 0,
      bestStreak: 0,
    })
  })

  it("counts a win from either seat", () => {
    const stats = profileStatsOf(
      asGames([black("black"), white("white")]),
      [],
      ME,
    )
    expect(stats.played).toBe(2)
    expect(stats.won).toBe(2)
  })

  it("counts a draw as played and not won", () => {
    const stats = profileStatsOf(asGames([black(null)]), [], ME)
    expect(stats.played).toBe(1)
    expect(stats.won).toBe(0)
    expect(stats.bestStreak).toBe(0)
  })

  it("counts games in progress separately from played", () => {
    const stats = profileStatsOf(
      asGames([black("black")]),
      asGames([white(null), black(null)]),
      ME,
    )
    expect(stats.played).toBe(1)
    expect(stats.playing).toBe(2)
  })

  it("never wins a game it lost", () => {
    const stats = profileStatsOf(
      asGames([black("white"), white("black")]),
      [],
      ME,
    )
    expect(stats.won).toBe(0)
    expect(stats.bestStreak).toBe(0)
  })

  //the list arrives newest first, so the best run is not the last one. three in
  //a row happened first, and a streak counted from the front would report one.
  it("finds the best run rather than the current one", () => {
    const stats = profileStatsOf(
      asGames([
        black("black"),
        black("white"),
        black("black"),
        black("black"),
        black("black"),
      ]),
      [],
      ME,
    )
    expect(stats.won).toBe(4)
    expect(stats.bestStreak).toBe(3)
  })

  it("counts an unbroken run as the whole list", () => {
    const stats = profileStatsOf(
      asGames([black("black"), white("white")]),
      [],
      ME,
    )
    expect(stats.bestStreak).toBe(2)
  })
})
