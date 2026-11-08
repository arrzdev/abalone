import { createEnvRegistry } from "@repo/env-validation/registry-factory"
import type { z } from "zod"
import type { envSchema } from "@/env/schema"

type ClientEnvKey = keyof z.infer<typeof envSchema>

//the keys the browser reads, written out so the schema stays a type here. a
//value import of the schema shipped zod (22 KB gz) to every page just to list
//these, ahead of hydration. `env/schema.ts` stays the source of truth:
//check:env validates against it at build time, and registry.test.ts fails
//when this list and the schema drift apart.
export const CLIENT_ENV_KEYS = [
  "VITE_BACKEND_URL",
  "VITE_CF_WEB_ANALYTICS_TOKEN",
] as const satisfies readonly ClientEnvKey[]

//a browser build has no setEnv step — vite has already inlined the values, so
//the registry hydrates itself at module scope from the declared keys only.
//
//`import.meta.env` MUST stay written out inline here. vite string-replaces the
//literal token; alias it to a local first and the replacement never fires, the
//registry ships empty, and every read is undefined.
function autoHydrateVite(): Record<string, unknown> {
  if (typeof import.meta.env === "undefined") return {}
  const hydrated: Record<string, unknown> = {}

  for (const key of CLIENT_ENV_KEYS) {
    if (key in import.meta.env) {
      hydrated[key] = import.meta.env[key as keyof ImportMetaEnv]
    }
  }
  return hydrated
}

export const envRegistry = createEnvRegistry({
  //the factory reads the schema for its type only (registry-factory.ts never
  //touches the value), so no zod schema has to exist in the browser
  schema: undefined as unknown as typeof envSchema,
  initialEnv: autoHydrateVite(),
  internals: {
    DEV: import.meta.env.DEV,
  },
})

export const env = envRegistry.env

export type Env = (typeof envRegistry)["env"]
