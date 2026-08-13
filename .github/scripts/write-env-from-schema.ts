// Writes <app>/env/.env from the app's env schema and the GitHub
// secrets/vars bag passed in via GH_SECRETS / GH_VARS (each `toJSON(...)`).
//
// The schema is the allowlist: only keys declared in `envSchema.shape` are
// written, so the rest of the bag (GITHUB_TOKEN, unrelated vars) never lands
// in .env. A secret wins over a var of the same name (matches `secrets.X || vars.X`).
//
// Usage: tsx .github/scripts/write-env-from-schema.ts <app-dir>

import { writeFileSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

function parseBag(json: string | undefined): Record<string, unknown> {
  return JSON.parse(json ?? "{}") as Record<string, unknown>
}

async function main(): Promise<void> {
  const appDir = resolve(process.argv[2] ?? "")
  if (!appDir) {
    console.error("usage: write-env-from-schema.ts <app-dir>")
    process.exit(1)
  }

  const bag: Record<string, unknown> = {
    ...parseBag(process.env.GH_VARS),
    ...parseBag(process.env.GH_SECRETS),
  }

  const { envSchema } = (await import(
    pathToFileURL(join(appDir, "env", "schema.ts")).href
  )) as { envSchema: { shape: Record<string, unknown> } }

  const present = Object.keys(envSchema.shape).filter((key) => {
    const value = bag[key]
    return value !== undefined && value !== null && value !== ""
  })
  const lines = present.map((key) => `${key}=${String(bag[key])}`)

  writeFileSync(
    join(appDir, "env", ".env"),
    lines.length > 0 ? `${lines.join("\n")}\n` : "",
  )
  console.log(
    `[env] ${basename(appDir)}: ${present.join(", ") || "(none)"}`,
  )
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
