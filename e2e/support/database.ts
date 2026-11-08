import { execFile } from "node:child_process"
import path from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import { promisify } from "node:util"

// Direct writes to the e2e backend's local D1, for states a test cannot wait
// for. It is the same state directory `serve-backend.sh` starts the Worker on,
// so the running backend reads the change on its next query.

// Playwright runs from the repo root, where its config lives. The e2e files load
// as CommonJS, so `import.meta` is not available here.
const backendDir = path.resolve(process.cwd(), "apps/backend")

const run = promisify(execFile)

// The backend Worker holds the same SQLite file, so a write that lands while it
// is mid-transaction gets SQLITE_BUSY. That is a wait, not a failure: try again.
const BUSY = /SQLITE_BUSY|database is locked/
const ATTEMPTS = 8
const BACKOFF_MS = 250

async function execute(sql: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await runCommand(sql)
      return
    } catch (error) {
      const stderr = String((error as { stderr?: unknown }).stderr ?? "")
      if (!BUSY.test(stderr) || attempt === ATTEMPTS) throw error
      await sleep(BACKOFF_MS * attempt)
    }
  }
}

async function runCommand(sql: string): Promise<void> {
  await run(
    "pnpm",
    [
      "exec",
      "wrangler",
      "d1",
      "execute",
      "abalone-backend-db-dev",
      "--local",
      "--persist-to",
      ".wrangler/e2e",
      "--command",
      sql,
    ],
    { cwd: backendDir },
  )
}

/** Moves an invite link's expiry into the past, as if a week had gone by. */
export async function expireInviteLink(linkId: string): Promise<void> {
  // The id is a base64url token: checked here, because it goes into SQL text.
  if (!/^[A-Za-z0-9_-]{43}$/.test(linkId))
    throw new Error(`not an invite link id: ${linkId}`)
  await execute(
    `UPDATE invite_links SET expires_at = ${Date.now() - 1000} WHERE id = '${linkId}'`,
  )
}
