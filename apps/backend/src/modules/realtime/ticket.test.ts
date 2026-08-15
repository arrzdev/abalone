import { describe, expect, it, vi } from "vitest"
import { mintTicket, verifyTicket } from "@/modules/realtime/ticket"

//the ticket is the only thing standing between a url and a subscription, so
//what these cover is the two halves of that: a good ticket says exactly who and
//exactly where, and everything else says nothing at all.

const SECRET = "test-secret-at-least-16-characters"

/** Runs `read` as if the clock had already moved on. */
async function atFuture<Result>(
  msAhead: number,
  read: () => Promise<Result>,
): Promise<Result> {
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + msAhead)
  try {
    return await read()
  } finally {
    clock.mockRestore()
  }
}

describe("realtime tickets", () => {
  //---- the invariant ----------------
  //a ticket names its own channel, and that is the only place a channel ever
  //comes from. these are the guard on it.

  it("hands back the channel it was minted for", async () => {
    const { ticket } = await mintTicket(
      SECRET,
      "player-a",
      "user:player-a",
    )

    expect(await verifyTicket(SECRET, ticket)).toEqual({
      userId: "player-a",
      channel: "user:player-a",
    })
  })

  it("cannot be re-pointed at another channel", async () => {
    const mine = await mintTicket(SECRET, "player-a", "user:player-a")
    const theirs = await mintTicket(SECRET, "player-b", "user:player-b")

    const claim = await verifyTicket(SECRET, mine.ticket)

    //both are perfectly valid tickets; what makes them safe is that each one
    //answers with its own channel and there is nothing to override it with
    expect(claim?.channel).toBe("user:player-a")
    expect(claim?.channel).not.toBe("user:player-b")
    expect(await verifyTicket(SECRET, theirs.ticket)).toEqual({
      userId: "player-b",
      channel: "user:player-b",
    })
  })

  it("refuses a payload edited to name a different channel", async () => {
    const { ticket } = await mintTicket(
      SECRET,
      "player-a",
      "user:player-a",
    )
    const [, signature] = ticket.split(".")

    const forgedClaims = btoa(
      JSON.stringify({
        u: "player-a",
        c: "user:player-b",
        e: Date.now() + 30_000,
      }),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")

    expect(
      await verifyTicket(SECRET, `${forgedClaims}.${signature}`),
    ).toBeNull()
  })

  //---- the signature ----------------

  it("refuses a ticket signed with another secret", async () => {
    const { ticket } = await mintTicket(
      "a-different-secret-entirely",
      "player-a",
      "user:player-a",
    )

    expect(await verifyTicket(SECRET, ticket)).toBeNull()
  })

  it("refuses a ticket whose signature was edited", async () => {
    const { ticket } = await mintTicket(
      SECRET,
      "player-a",
      "user:player-a",
    )
    const [payload, signature] = ticket.split(".")
    const flipped = signature?.startsWith("A")
      ? `B${signature.slice(1)}`
      : `A${signature?.slice(1)}`

    expect(await verifyTicket(SECRET, `${payload}.${flipped}`)).toBeNull()
  })

  it("refuses anything that is not a ticket", async () => {
    for (const junk of ["", ".", "nonsense", "a.b.c", "onlyonepart"]) {
      expect(await verifyTicket(SECRET, junk)).toBeNull()
    }
  })

  //---- the clock ----------------

  it("expires, so a leaked url is worth half a minute", async () => {
    const { ticket, expiresAt } = await mintTicket(
      SECRET,
      "player-a",
      "user:player-a",
    )

    expect(expiresAt).toBeGreaterThan(Date.now())
    expect(
      await atFuture(29_000, () => verifyTicket(SECRET, ticket)),
    ).not.toBeNull()
    expect(
      await atFuture(31_000, () => verifyTicket(SECRET, ticket)),
    ).toBeNull()
  })
})
