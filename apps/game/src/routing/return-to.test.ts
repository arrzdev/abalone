import { describe, expect, it } from "vitest"
import { parseReturnTo, returnToOptions } from "@/routing/return-to"

const GAME_ID = "3f1a8c02-4b7d-4e91-9a2c-7d5e6f0b1c34"

describe("parseReturnTo", () => {
  it("accepts every fixed destination", () => {
    expect(parseReturnTo("/")).toBe("/")
    expect(parseReturnTo("/online")).toBe("/online")
    expect(parseReturnTo("/invite")).toBe("/invite")
    expect(parseReturnTo("/online/history")).toBe("/online/history")
  })

  it("accepts a game by its id", () => {
    expect(parseReturnTo(`/online/${GAME_ID}`)).toBe(`/online/${GAME_ID}`)
  })

  //the whole reason this is a token set and not a path check: `?redirect=` is
  //written by whoever sends the link, so anything not on the list is dropped
  //rather than followed.
  it("refuses anything else", () => {
    expect(parseReturnTo("/online/../../evil")).toBeUndefined()
    expect(parseReturnTo("https://example.com")).toBeUndefined()
    expect(parseReturnTo("/online/not-an-id")).toBeUndefined()
    expect(parseReturnTo("/games")).toBeUndefined()
    expect(parseReturnTo(undefined)).toBeUndefined()
    expect(parseReturnTo(42)).toBeUndefined()
  })
})

describe("returnToOptions", () => {
  it("resolves a game to its parameterised route", () => {
    expect(returnToOptions(`/online/${GAME_ID}`)).toEqual({
      to: "/online/$gameId",
      params: { gameId: GAME_ID },
    })
  })

  //the composer is an overlay rather than a route, so "go there" is the hub
  //plus a search parameter
  it("resolves the composer to the hub with it open", () => {
    expect(returnToOptions("/invite")).toEqual({
      to: "/online",
      search: { invite: "new" },
    })
  })

  it("pages the history from its first page", () => {
    expect(returnToOptions("/online/history")).toEqual({
      to: "/online/history",
      search: { page: 1 },
    })
  })
})
