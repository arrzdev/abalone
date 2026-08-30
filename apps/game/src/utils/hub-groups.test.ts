import { describe, expect, it } from "vitest"
import type { Game, Invite } from "@/data/online/queries"
import { hubGroupsOf } from "@/utils/hub-groups"

const ME = "me"

//the split reads three fields off a game and none off an invite, so the stubs
//carry those and nothing else. building the whole rpc shape here would test the
//contract rather than the splitting.
type GameStub = Pick<Game, "currentTurn" | "updatedAt"> & {
  id: string
  black: { userId: string }
}

function asGames(stubs: GameStub[]) {
  return stubs as unknown as Game[]
}

function asInvites(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `invite-${index}`,
  })) as unknown as Invite[]
}

/** A game I am black in, waiting on whoever's turn it says. */
function game(
  id: string,
  currentTurn: "black" | "white",
  updatedAt: number,
): GameStub {
  return { id, currentTurn, updatedAt, black: { userId: ME } }
}

/** The same, from the other seat, so "my turn" is not just "black to move". */
function asWhite(
  id: string,
  currentTurn: "black" | "white",
  updatedAt: number,
): GameStub {
  return { id, currentTurn, updatedAt, black: { userId: "them" } }
}

describe("hubGroupsOf", () => {
  it("splits on whose turn it is, from either seat", () => {
    const groups = hubGroupsOf(
      asGames([
        game("a", "black", 1),
        game("b", "white", 2),
        asWhite("c", "white", 3),
        asWhite("d", "black", 4),
      ]),
      [],
      ME,
    )

    expect(groups.yourMove.map((g) => g.id)).toEqual(["a", "c"])
    expect(groups.theirMove.map((g) => g.id)).toEqual(["b", "d"])
  })

  //the point of the sort: the game you opened a minute ago is the one you have
  //already thought about, and the one from Tuesday is the one somebody is still
  //waiting on.
  it("puts the longest wait first", () => {
    const groups = hubGroupsOf(
      asGames([
        game("recent", "black", 900),
        game("oldest", "black", 100),
        game("middle", "black", 500),
      ]),
      [],
      ME,
    )

    expect(groups.yourMove.map((g) => g.id)).toEqual([
      "oldest",
      "middle",
      "recent",
    ])
  })

  it("leaves the games it cannot act on in server order", () => {
    const groups = hubGroupsOf(
      asGames([game("second", "white", 100), game("first", "white", 900)]),
      [],
      ME,
    )

    expect(groups.theirMove.map((g) => g.id)).toEqual(["second", "first"])
  })

  it("leads with a move you owe, over an answer you owe", () => {
    const groups = hubGroupsOf(
      asGames([game("a", "black", 1)]),
      asInvites(3),
      ME,
    )

    expect(groups.lead).toBe("games")
    //nothing is in the lead block, so the panel keeps all three
    expect(groups.panelInvites).toHaveLength(3)
  })

  it("leads with the invites when there is no move to make", () => {
    const groups = hubGroupsOf(
      asGames([game("a", "white", 1)]),
      asInvites(2),
      ME,
    )

    expect(groups.lead).toBe("invites")
    //the lead block is showing them, and a panel repeating them underneath
    //would be the same two rows twice
    expect(groups.panelInvites).toEqual([])
  })

  it("leads with nothing when nothing needs an answer", () => {
    const groups = hubGroupsOf(asGames([game("a", "white", 1)]), [], ME)

    expect(groups.lead).toBe("none")
  })

  it("leads with nothing on an empty account", () => {
    const groups = hubGroupsOf([], [], ME)

    expect(groups).toEqual({
      yourMove: [],
      theirMove: [],
      panelInvites: [],
      lead: "none",
    })
  })
})
