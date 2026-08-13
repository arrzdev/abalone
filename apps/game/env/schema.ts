import { z } from "zod"

//the game runs entirely in the browser against no service of ours, so it
//declares nothing. the schema stays because it is the allowlist the deploy
//writes env/.env from — the first variable this app ever needs goes here.
export const envSchema = z.object({})
