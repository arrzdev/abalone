import { createEnvRegistry } from "@repo/env-validation/registry-factory"
import type { z } from "zod"
import { envSchema } from "@/env/schema"

//a browser build has no setEnv step — vite has already inlined the values, so
//the registry hydrates itself at module scope from the declared keys only.
//
//`import.meta.env` MUST stay written out inline here. vite string-replaces the
//literal token; alias it to a local first and the replacement never fires, the
//registry ships empty, and every read is undefined.
function autoHydrateVite(
  schema: z.ZodObject<z.ZodRawShape>,
): Record<string, unknown> {
  if (typeof import.meta.env === "undefined") return {}
  const hydrated: Record<string, unknown> = {}

  for (const key of Object.keys(schema.shape)) {
    if (key in import.meta.env) {
      hydrated[key] = import.meta.env[key as keyof ImportMetaEnv]
    }
  }
  return hydrated
}

export const envRegistry = createEnvRegistry({
  schema: envSchema,
  initialEnv: autoHydrateVite(envSchema),
  internals: {
    DEV: import.meta.env.DEV,
  },
})

export const env = envRegistry.env

export type Env = (typeof envRegistry)["env"]
