import { z } from "zod"

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
  //the web app's origin — the CORS allowlist, and the one signal the network
  //policy reads to decide whether this is a dev environment (see
  //src/http/network-policy.ts). required: auth trusts it as an origin, so a
  //missing value would silently mean "trust nothing" and every sign-in fails.
  FRONTEND_URL: z.url(),

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
