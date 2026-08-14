import { z } from "zod"

export type CloudflareBindings = {
  DB: D1Database
}

//runtime env: `wrangler dev` loads it from `env/.env` (--env-file); deploy
//uploads the same file as Worker secrets. validated by check:env and read at
//runtime via the env registry proxy.
export const envSchema = z.object({
  //the web app's origin — the CORS allowlist, and the one signal the network
  //policy reads to decide whether this is a dev environment (see
  //src/http/network-policy.ts).
  FRONTEND_URL: z.url().optional(),
})
