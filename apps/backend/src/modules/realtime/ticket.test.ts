import { describe, expect, it, vi } from "vitest"
import {
  mintTicket,
  ticketFromProtocols,
  verifyTicket,
} from "@/modules/realtime/ticket"

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

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

/**
 * A ticket with any payload at all, signed the way the server signs: with the
 * key derived from the secret. It gets past the signature check, so what it
 * reaches is the reading of the payload behind it.
 */
async function signedTicket(payload: string): Promise<string> {
  const encoder = new TextEncoder()
  const rootKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const derived = await crypto.subtle.sign(
    "HMAC",
    rootKey,
    encoder.encode("realtime-ticket/v1"),
  )
  const key = await crypto.subtle.importKey(
    "raw",
    derived,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  )
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`
}

const payloadOf = (text: string) =>
  toBase64Url(new TextEncoder().encode(text))

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

  it("refuses a ticket signed with the raw auth secret", async () => {
    //the key is derived from the secret, so a ticket that something else
    //signed with the secret itself is not a ticket
    const { ticket } = await mintTicket(
      SECRET,
      "player-a",
      "user:player-a",
    )
    const [payload] = ticket.split(".")
    const rawKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    )
    const rawSignature = await crypto.subtle.sign(
      "HMAC",
      rawKey,
      new TextEncoder().encode(payload),
    )
    const encoded = btoa(
      String.fromCharCode(...new Uint8Array(rawSignature)),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")

    expect(await verifyTicket(SECRET, `${payload}.${encoded}`)).toBeNull()
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

  it("refuses a signature that is not base64url", async () => {
    const { ticket } = await mintTicket(
      SECRET,
      "player-a",
      "user:player-a",
    )
    const [payload] = ticket.split(".")

    expect(await verifyTicket(SECRET, `${payload}.not*base64`)).toBeNull()
  })

  it("refuses a signed payload that is not base64url", async () => {
    expect(
      await verifyTicket(SECRET, await signedTicket("not*base64")),
    ).toBeNull()
  })

  it("refuses a signed payload that is not JSON", async () => {
    expect(
      await verifyTicket(
        SECRET,
        await signedTicket(payloadOf("not json")),
      ),
    ).toBeNull()
  })

  it("refuses a signed payload in a shape this build never wrote", async () => {
    const stale = payloadOf(JSON.stringify({ userId: "player-a", e: 1 }))

    expect(
      await verifyTicket(SECRET, await signedTicket(stale)),
    ).toBeNull()
  })

  it("reads a payload signed with the derived key", async () => {
    //the guard on the helper above: a well-formed payload it signs is accepted,
    //so the refusals before this are about the payload and not the signature
    const claims = payloadOf(
      JSON.stringify({
        u: "player-a",
        c: "user:player-a",
        e: Date.now() + 60_000,
      }),
    )

    expect(await verifyTicket(SECRET, await signedTicket(claims))).toEqual(
      {
        userId: "player-a",
        channel: "user:player-a",
      },
    )
  })

  it("refuses anything that is not a ticket", async () => {
    for (const junk of ["", ".", "nonsense", "a.b.c", "onlyonepart"]) {
      expect(await verifyTicket(SECRET, junk)).toBeNull()
    }
  })

  //---- the transport ----------------

  it("reads the ticket out of the offered subprotocols", () => {
    expect(ticketFromProtocols("ticket, abc.def")).toBe("abc.def")
    expect(ticketFromProtocols("ticket,abc.def")).toBe("abc.def")
  })

  it("reads nothing out of any other subprotocol list", () => {
    for (const header of [
      undefined,
      "",
      "ticket",
      "abc.def",
      "abc.def, ticket",
      "chat, abc.def",
      "ticket, abc.def, extra",
    ]) {
      expect(ticketFromProtocols(header)).toBeNull()
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
