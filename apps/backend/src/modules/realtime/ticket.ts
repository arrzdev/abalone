import tryCatch from "@repo/shared/try-catch"

/**
 * A ticket is the browser's only way to authenticate a WebSocket.
 *
 * `new WebSocket(url)` takes a url and a subprotocol list and nothing else —
 * there is no header to hang a bearer token off, and this app's sessions are
 * bearer tokens rather than cookies on purpose (see `auth.service.ts`). Worse,
 * a browser cannot read the status or body of a *failed* handshake, so an
 * `error()` envelope returned from an upgrade would be invisible. Both problems
 * go away by doing the authorization over ordinary http and handing back
 * something the socket can redeem.
 *
 * The ticket is signed, not stored: the claims travel inside it and the
 * signature is what makes them true. No table, no migration, no read on the
 * socket path — which matters, because a phone reconnects a lot.
 *
 * THE CHANNEL LIVES IN THE SIGNED CLAIMS. `verifyTicket` returns the channel it
 * was minted for, and the subscribe route subscribes to *that* — never to a
 * channel the request names. There is no code path by which a client chooses
 * its own channel, so a ticket is worth exactly one channel for thirty seconds.
 * Any change that reads a channel off the request is a security regression.
 */

/** How long a minted ticket stays redeemable. */
const TICKET_TTL_MS = 30_000

/** Short keys because the whole thing rides in a url. */
type TicketClaims = {
  /** who it was minted for */
  u: string
  /** the channel it is redeemable against, and the only one */
  c: string
  /** expiry, epoch milliseconds */
  e: number
}

/** A minted ticket, and when it stops working. */
export type Ticket = {
  ticket: string
  expiresAt: number
}

/** What a good ticket proves. */
export type TicketClaim = {
  userId: string
  channel: string
}

//---- encoding ----------------
//base64url rather than base64: the ticket is a query parameter, and `+` and `/`
//would need escaping on every hop that touches the url.

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function toBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function fromBase64Url(value: string): Uint8Array | null {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=")

  const [binary, decodeError] = tryCatch(() => atob(padded))
  //anything unparseable is just a bad ticket, which is not an app failure
  if (decodeError) return null

  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

//---- signing key ----------------
//cached per secret, per isolate, for the same reason the better-auth instance
//is: importKey on every mint and every reconnect is work with one answer.

const keyCache = new Map<string, Promise<CryptoKey>>()

function signingKey(secret: string): Promise<CryptoKey> {
  const cached = keyCache.get(secret)
  if (cached) return cached

  const key = crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )
  keyCache.set(secret, key)
  return key
}

//---- mint ----------------

/** Signs a ticket letting one player subscribe to one channel, briefly. */
export async function mintTicket(
  secret: string,
  userId: string,
  channel: string,
): Promise<Ticket> {
  const expiresAt = Date.now() + TICKET_TTL_MS
  const claims: TicketClaims = { u: userId, c: channel, e: expiresAt }
  const payload = toBase64Url(encoder.encode(JSON.stringify(claims)))

  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(secret),
    encoder.encode(payload),
  )

  return {
    ticket: `${payload}.${toBase64Url(new Uint8Array(signature))}`,
    expiresAt,
  }
}

//---- verify ----------------

/**
 * What a ticket proves, or null if it proves nothing.
 *
 * Never throws: a forged, expired or truncated ticket is an ordinary answer
 * here, and the caller decides what to say about it.
 */
export async function verifyTicket(
  secret: string,
  ticket: string,
): Promise<TicketClaim | null> {
  const [payload, signature, ...rest] = ticket.split(".")
  if (!payload || !signature || rest.length > 0) return null

  const signatureBytes = fromBase64Url(signature)
  if (!signatureBytes) return null

  //crypto.subtle.verify rather than comparing the signature as a string: it is
  //constant-time, and it is already the primitive for this
  const key = await signingKey(secret)
  const [isSigned, verifyError] = await tryCatch(() =>
    crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(payload),
    ),
  )
  if (verifyError || !isSigned) return null

  const claimBytes = fromBase64Url(payload)
  if (!claimBytes) return null

  const [claims, parseError] = tryCatch(
    () => JSON.parse(decoder.decode(claimBytes)) as TicketClaims,
  )
  if (parseError) return null

  //the signature says the bytes are ours; it does not say they are the shape we
  //last wrote, and a ticket signed by an older build could be neither
  if (
    typeof claims?.u !== "string" ||
    typeof claims?.c !== "string" ||
    typeof claims?.e !== "number"
  ) {
    return null
  }
  if (claims.e <= Date.now()) return null

  return { userId: claims.u, channel: claims.c }
}
