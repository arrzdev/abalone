import { z } from "zod"

/**
 * Split a comma-separated env value into origins, dropping anything that is not
 * an absolute URL.
 *
 * Origins rather than the strings as written: `https://x.dev/game` and
 * `https://x.dev` are the same origin to a browser, and an allowlist compared
 * against the `Origin` header has to be in the header's own terms. Dropping
 * junk rather than throwing keeps a malformed entry from taking the whole list
 * down with it — `check:env` is where a bad value is meant to be caught, and
 * the empty list this yields is what the schema below refuses.
 *
 * It lives here, beside the declaration, so nothing outside `env/` has to know
 * the value is a list. `check-env.ts` imports this module on its own.
 */
export function parseOriginList(raw: string): string[] {
  const origins: string[] = []
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim()
    if (!trimmed) continue
    try {
      origins.push(new URL(trimmed).origin)
    } catch {
      //not a URL — the schema's refine turns an all-junk value into a failure
    }
  }
  return origins
}

export type CloudflareBindings = {
  DB: D1Database
  //avatar objects, written by the profile service and read by the public CDN
  //domain attached to this bucket (AVATAR_PUBLIC_URL)
  AVATARS: R2Bucket
}

//runtime env: `wrangler dev` loads it from `env/.env` (--env-file); deploy
//uploads the same file as Worker secrets. validated by check:env and read at
//runtime via the env registry proxy.
export const envSchema = z.object({
  //every origin the web app is served from, comma-separated — the CORS
  //allowlist, better-auth's trusted origins, and the one signal the network
  //policy reads to decide whether this is a dev environment (see
  //src/http/network-policy.ts). required: auth trusts these as origins, so a
  //missing value would silently mean "trust nothing" and every sign-in fails.
  //
  //a string, not a parsed array: the env registry hands consumers the raw
  //value and only uses this schema for typing, so a `.transform()` here would
  //promise an array that never arrives at runtime. `frontendOrigins()` in
  //network-policy.ts is the one place it is split.
  FRONTEND_URLS: z
    .string()
    .refine(
      (raw) => parseOriginList(raw).length > 0,
      "must be one or more absolute URLs separated by commas",
    ),

  //signing key for sessions and tokens. rotating it invalidates every session.
  BETTER_AUTH_SECRET: z.string().min(16),

  //this api's own public origin. better-auth builds absolute urls from it, so
  //it is the deployed hostname, never the frontend's.
  BETTER_AUTH_URL: z.url(),

  //where avatar objects are readable from, with no trailing slash. production
  //is the bucket's own custom domain; local dev points at the worker's dev-only
  //passthrough route, because wrangler emulates the R2 binding but not public
  //bucket access.
  AVATAR_PUBLIC_URL: z.url(),
})
