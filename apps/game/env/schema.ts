import { z } from "zod"

//everything a browser build reads has to be prefixed VITE_ and is baked into the
//bundle, so nothing here can ever be a secret.
export const envSchema = z.object({
  //where the api lives. offline play never touches it; accounts and online play
  //do. in dev the client swaps in the current hostname and keeps this port, so a
  //phone on the LAN reaches the backend without editing anything (see
  //src/data/backend-client.ts).
  VITE_BACKEND_URL: z.url(),
})
