import { z } from "zod"

//everything a browser build reads has to be prefixed VITE_ and is baked into the
//bundle, so nothing here can ever be a secret.
export const envSchema = z.object({
  //where the api lives in dev, read for its port only: the client swaps in the
  //current hostname, so a phone on the LAN reaches the backend without editing
  //anything. a production build ignores it and calls /api on its own origin
  //(see src/data/backend-client.ts), which is why it is optional.
  VITE_BACKEND_URL: z.url().optional(),
})
