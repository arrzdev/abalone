import type { Context, Next } from "hono"
import type { CloudflareBindings } from "@/env/registry"
import { env } from "@/env/registry"
import { error } from "@/http/envelope"
import { CustomError, RetryLaterError } from "@/http/errors"

const RATE_LIMIT_WINDOW_MS = 60_000

//one preset per traffic shape, not per route: a chatty sync surface and a
//sign-in form want different ceilings, two read endpoints don't. add a key
//when a domain's shape genuinely differs from `api`.
//`bindings` name Workers Rate Limiting bindings in wrangler.toml. a preset
//with them is counted by cloudflare, shared across every isolate in a
//location, and passes only when every one of its bindings does; the rest are
//counted per isolate below, `max` per 60 s. only the presets a guess is tried
//through have bindings, and the public health probe.
//failed sign-ins have a tier of their own (recordAuthFailure below), and one
//account has its own lockout in D1 (services/auth-lockout.service.ts).
const RATE_LIMITS: Record<
  string,
  { max: number; bindings?: (keyof RateLimitBindings)[] }
> = {
  //ordinary request/response endpoints
  api: { max: 120 },
  //every better-auth POST: sign-in, sign-up, sign-out. a password guess is the
  //one request worth making a million of, so two tiers count it:
  //AUTH_BURST_RATE_LIMITER 5 per ip per 10 s (against a script) and
  //AUTH_SUSTAINED_RATE_LIMITER 20 per ip per 60 s (roomy for a household or a
  //school behind one NAT). better-auth's own limiter is off
  //(services/auth.service.ts). `max` is the sustained ceiling, for a bare app.
  auth: {
    max: 20,
    bindings: ["AUTH_BURST_RATE_LIMITER", "AUTH_SUSTAINED_RATE_LIMITER"],
  },
  //avatar uploads. each one is a hash plus an R2 write of up to half a megabyte,
  //and a player changes their picture a handful of times ever.
  upload: { max: 10 },
  //minting a realtime ticket and redeeming it. its own shape because a device
  //on a flaky network reconnects, and every reconnect is two requests it did
  //not choose to make. roomier than a form, tighter than `api`, because a
  //client that needs sixty connections a minute is not connecting.
  realtime: { max: 60 },
  //anonymous game events. a game sends two, so thirty a minute is a device
  //starting a new game every four seconds, which nobody playing does.
  events: { max: 30 },
  //making an invite link and accepting one. a player sends a few links a day,
  //and the accept is the door a guessed token would be tried through.
  "invite-link": { max: 20, bindings: ["INVITE_LINK_RATE_LIMITER"] },
  //the public health probe. a monitor asks once a minute or so; sixty is that
  //with room for a few retries, and every hit past it would be a D1 query and
  //an R2 read made on someone else's behalf.
  health: { max: 60, bindings: ["HEALTH_RATE_LIMITER"] },
}

type RateLimitBindings = Pick<
  CloudflareBindings,
  | "AUTH_BURST_RATE_LIMITER"
  | "AUTH_SUSTAINED_RATE_LIMITER"
  | "AUTH_FAILURE_RATE_LIMITER"
  | "INVITE_LINK_RATE_LIMITER"
  | "HEALTH_RATE_LIMITER"
>

//a 429 says when to come back: the longest period of any tier
const RETRY_AFTER_SECONDS = 60

//best-effort limiter: per-isolate on cloudflare workers, not shared across
//isolates, so callers must not assume global enforcement
const buckets = new Map<string, number[]>()

export function resetRateLimitBuckets(): void {
  buckets.clear()
}

function pruneExpired(
  list: number[],
  now: number,
  windowMs: number,
): number[] {
  const cutoff = now - windowMs
  const cutoffIndex = list.findIndex((timestamp) => timestamp > cutoff)
  return cutoffIndex === -1 ? [] : list.slice(cutoffIndex)
}

//an ipv6 client usually holds a whole /64 and can rotate through it, so a
//full address would hand out a fresh count per request. count per /64.
export function ipKey(ip: string): string {
  if (!ip.includes(":")) return ip
  const [head, tail = ""] = ip.toLowerCase().split("::")
  const headGroups = head ? head.split(":") : []
  const tailGroups = tail ? tail.split(":") : []
  const missing = Math.max(0, 8 - headGroups.length - tailGroups.length)
  const groups = ip.includes("::")
    ? [...headGroups, ...Array(missing).fill("0"), ...tailGroups]
    : headGroups
  return `${groups
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`
}

function getClientIp(c: Context): string {
  return ipKey(
    c.req.header("cf-connecting-ip") ??
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown",
  )
}

//x-test-bypass is sent by the test and e2e suites, whose requests all come
//from one address. it does nothing unless RATE_LIMIT_ALLOW_TEST_BYPASS is
//"true", which only the test workers set; no deployed env has it
function bypassed(c: Context): boolean {
  return (
    (env as { RATE_LIMIT_ALLOW_TEST_BYPASS?: string })
      .RATE_LIMIT_ALLOW_TEST_BYPASS === "true" &&
    c.req.header("x-test-bypass") === "true"
  )
}

function bindingsOf(c: Context): Partial<RateLimitBindings> {
  return (c.env as Partial<RateLimitBindings> | undefined) ?? {}
}

function rateLimited(c: Context) {
  c.header("Retry-After", String(RETRY_AFTER_SECONDS))
  return error(c, "rate_limit_exceeded")
}

export function rateLimit(code: string) {
  const preset = RATE_LIMITS[code]
  if (!preset) throw new CustomError("internal_server_error")

  return async (c: Context, next: Next) => {
    if (bypassed(c)) return next()

    const bucketKey = `${getClientIp(c)}:${code}`

    //a bare Hono app in a test has no bindings, so a preset with them still
    //falls back to the per-isolate count there
    const available = bindingsOf(c)
    const limiters = (preset.bindings ?? []).flatMap((name) => {
      const limiter = available[name]
      return limiter ? [limiter] : []
    })
    if (preset.bindings && limiters.length === preset.bindings.length) {
      const outcomes = await Promise.all(
        limiters.map((limiter) => limiter.limit({ key: bucketKey })),
      )
      if (outcomes.some((outcome) => !outcome.success))
        return rateLimited(c)
      return next()
    }

    const now = Date.now()
    const pruned = pruneExpired(
      buckets.get(bucketKey) ?? [],
      now,
      RATE_LIMIT_WINDOW_MS,
    )

    if (pruned.length >= preset.max) return rateLimited(c)

    //record this hit and persist the in-window timestamps. the bucket MUST be
    //written on every allowed request — including the first, when `pruned` is
    //empty — or the window never accumulates and the limit is unreachable.
    //stale keys prune to a single fresh hit on their owner's next request and
    //otherwise linger only until the isolate recycles (per-isolate best-effort).
    pruned.push(now)
    buckets.set(bucketKey, pruned)
    await next()
  }
}

//---- failed sign-ins per ip ----------------

//the lockout stops many ips guessing one account; this stops one ip guessing
//many accounts: AUTH_FAILURE_RATE_LIMITER, 10 failed sign-ins per ip per
//60 s, then a 10-minute cooldown. the binding cannot be read without
//counting, so going over drops a marker in the colo's cache, and sign-in
//checks the marker before it hashes anything. per colo, like the binding.
const AUTH_FAILURE_COOLDOWN_SECONDS = 600

function authFailureMarker(c: Context): Request {
  return new Request(
    `https://auth-failure-cap.internal/${encodeURIComponent(getClientIp(c))}`,
  )
}

/** Refuses an ip that failed too many sign-ins lately; call before hashing. */
export async function assertAuthFailureNotCapped(
  c: Context,
): Promise<void> {
  if (bypassed(c)) return
  const marker = await caches.default.match(authFailureMarker(c))
  if (!marker) return
  throw new RetryLaterError(
    "rate_limit_exceeded",
    AUTH_FAILURE_COOLDOWN_SECONDS,
  )
}

/** Counts a failed sign-in against the caller's ip. */
export async function recordAuthFailure(c: Context): Promise<void> {
  if (bypassed(c)) return
  const limiter = bindingsOf(c).AUTH_FAILURE_RATE_LIMITER
  if (!limiter) return
  const { success } = await limiter.limit({
    key: `${getClientIp(c)}:auth-failure`,
  })
  if (success) return
  await caches.default.put(
    authFailureMarker(c),
    new Response(null, {
      headers: {
        "Cache-Control": `max-age=${AUTH_FAILURE_COOLDOWN_SECONDS}`,
      },
    }),
  )
}
