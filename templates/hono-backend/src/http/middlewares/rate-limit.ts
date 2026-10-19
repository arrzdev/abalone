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
//isolate in a location; the rest are counted per isolate below. give one to a
//preset a guess is tried through (sign-in, token redeem), and to the public
//health probe.
const RATE_LIMITS: Record<
  string,
  { max: number; binding?: keyof RateLimitBindings }
> = {
  //ordinary request/response endpoints
  api: { max: 120 },
  //the public health probe. a monitor asks once a minute or so; sixty is that
  //with room for a few retries, and every hit past it would be a D1 query made
  //on someone else's behalf.
  health: { max: 60, binding: "HEALTH_RATE_LIMITER" },
}

type RateLimitBindings = Pick<CloudflareBindings, "HEALTH_RATE_LIMITER">

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
