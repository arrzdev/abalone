// Writes <app>/env/.env from the app's env schema, the GitHub vars bag passed
// in via GH_VARS (`toJSON(vars)`) and the secrets the deploy step lists one by
// one as SECRET_<KEY> (`toJSON(secrets)` gets public-repo runs flagged).
//
// The schema is the allowlist: only keys declared in `envSchema.shape` are
// written, so unrelated vars never land in .env. A secret wins over a var of
// the same name (matches `secrets.X || vars.X`).
//
// The deploy marker is derived from the branch, not stored: when the schema
// declares DEPLOYENV (runtime) or VITE_DEPLOYENV (baked into a client bundle),
// it is set to TARGET (production | staging) unless the bag already has it.
//
// Values must be single-line. A newline would break the .env parse and upload a
// truncated secret with no error, so the script fails instead (key name only).
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

  const bag: Record<string, unknown> = parseBag(process.env.GH_VARS)

  const { envSchema } = (await import(
    pathToFileURL(join(appDir, "env", "schema.ts")).href
  )) as { envSchema: { shape: Record<string, unknown> } }

  for (const key of Object.keys(envSchema.shape)) {
    const secret = process.env[`SECRET_${key}`]
    if (secret) bag[key] = secret
  }

  const target = process.env.TARGET
  for (const key of ["DEPLOYENV", "VITE_DEPLOYENV"]) {
    if (target && key in envSchema.shape && !bag[key]) bag[key] = target
  }

  const present = Object.keys(envSchema.shape).filter((key) => {
    const value = bag[key]
    return value !== undefined && value !== null && value !== ""
  })
  const multiline = present.filter((key) =>
    /[\r\n]/.test(String(bag[key])),
  )
  if (multiline.length > 0) {
    console.error(
      `[env] ${basename(appDir)}: multi-line value for ${multiline.join(", ")}; .env values must be single-line`,
    )
    process.exit(1)
  }
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
