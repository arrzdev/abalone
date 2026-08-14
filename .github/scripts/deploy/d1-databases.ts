// Prints the D1 database name(s) this app configures, one per line, read straight from
// wrangler's OWN config parser (`unstable_readConfig`) — never derived from the worker
// name. Exits non-zero (loud) if a d1_databases entry has no `database_name`, so a
// misconfigured database can never silently skip its migrations. Emits every configured
// database, so an app with two D1s migrates both.
//
// Run with cwd = the app directory, so `wrangler` resolves from the app's deps and
// `./wrangler.toml` is the config read.
//
// Reads the `production` env, the same one `app.sh` passes to every wrangler call.
// Reading the top level instead would return the dev database and migrate that.

import { unstable_readConfig } from "wrangler"

const DEPLOY_ENV = "production"

let config: ReturnType<typeof unstable_readConfig>
try {
  config = unstable_readConfig({ env: DEPLOY_ENV })
} catch (error) {
  console.error(
    `[d1] failed to read wrangler config: ${
      error instanceof Error ? error.message : String(error)
    }`,
  )
  process.exit(1)
}

const worker = config.name ?? "worker"
const names: string[] = []

for (const database of config.d1_databases ?? []) {
  if (!database.database_name) {
    console.error(
      `[d1] ${worker}: a d1_databases entry (binding "${database.binding}") ` +
        "has no database_name — set it in wrangler.toml",
    )
    process.exit(1)
  }
  // A scaffolded id that nobody replaced. Caught here, before the upload, because
  // downstream it becomes a confusing wrangler error mid-deploy — and because the
  // whole point of reading the env's own config is that it is the real database.
  if (/^REPLACE_WITH/i.test(database.database_id ?? "")) {
    console.error(
      `[d1] ${worker}: the ${DEPLOY_ENV} database_id for "${database.database_name}" ` +
        "is still a placeholder — create the database with `wrangler d1 create` " +
        "and paste its id into wrangler.toml",
    )
    process.exit(1)
  }
  names.push(database.database_name)
}

process.stdout.write(names.join("\n"))
