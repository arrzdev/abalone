import type { Context, Next } from "hono"
import type { CloudflareBindings } from "@/env/registry"
import { env } from "@/env/registry"
import { error } from "@/http/envelope"
import { CustomError } from "@/http/errors"

const RATE_LIMIT_WINDOW_MS = 60_000

//one preset per traffic shape, not per route: a chatty sync surface and a
//sign-in form want different ceilings, two read endpoints don't. add a key
//when a domain's shape genuinely differs from `api`.
//`binding` names a Workers Rate Limiting binding in wrangler.toml whose `limit`
//equals `max`. a preset with one is counted by cloudflare, shared across every
//isolate in a location; the rest are counted per isolate below. only the
//presets a guess is tried through have one, and the public health probe.
const RATE_LIMITS: Record<
  string,
  { max: number; binding?: keyof RateLimitBindings }
> = {
  //ordinary request/response endpoints
  api: { max: 120 },
  //sign-in/up/out and get-session. tighter than `api` because a password guess
  //is the one request worth making a million of, and this surface is the whole
  //better-auth handler behind one wildcard.
  auth: { max: 60, binding: "AUTH_RATE_LIMITER" },
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
  "invite-link": { max: 20, binding: "INVITE_LINK_RATE_LIMITER" },
  //the public health probe. a monitor asks once a minute or so; sixty is that
  //with room for a few retries, and every hit past it would be a D1 query and
  //an R2 read made on someone else's behalf.
  health: { max: 60, binding: "HEALTH_RATE_LIMITER" },
}

type RateLimitBindings = Pick<
  CloudflareBindings,
  "AUTH_RATE_LIMITER" | "INVITE_LINK_RATE_LIMITER" | "HEALTH_RATE_LIMITER"
>

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

function getClientIp(c: Context): string {
  return (
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  )
}

export function rateLimit(code: string) {
  const preset = RATE_LIMITS[code]
  if (!preset) throw new CustomError("internal_server_error")

  const options = {
    max: preset.max,
    windowMs: RATE_LIMIT_WINDOW_MS,
    key: code,
  }

  return async (c: Context, next: Next) => {
    const allowBypass =
      (env as { RATE_LIMIT_ALLOW_TEST_BYPASS?: string })
        .RATE_LIMIT_ALLOW_TEST_BYPASS === "true" &&
      c.req.header("x-test-bypass") === "true"
    if (allowBypass) return next()

    const ip = getClientIp(c)
    const bucketKey = `${ip}:${options.key}`

    //a bare Hono app in a test has no bindings, so a preset with one still
    //falls back to the per-isolate count there
    const binding = preset.binding
      ? (c.env as RateLimitBindings | undefined)?.[preset.binding]
      : undefined
    if (binding) {
      const outcome = await binding.limit({ key: bucketKey })
      if (!outcome.success) return error(c, "rate_limit_exceeded")
      return next()
    }

    const now = Date.now()
    const pruned = pruneExpired(
      buckets.get(bucketKey) ?? [],
      now,
      options.windowMs,
    )

    if (pruned.length >= options.max)
      return error(c, "rate_limit_exceeded")

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
