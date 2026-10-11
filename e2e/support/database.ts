import { execFileSync } from "node:child_process"
import path from "node:path"

// Direct writes to the e2e backend's local D1, for states a test cannot wait
// for. It is the same state directory `serve-backend.sh` starts the Worker on,
// so the running backend reads the change on its next query.

// Playwright runs from the repo root, where its config lives. The e2e files load
// as CommonJS, so `import.meta` is not available here.
const backendDir = path.resolve(process.cwd(), "apps/backend")

function execute(sql: string): void {
  execFileSync(
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
    { cwd: backendDir, stdio: "pipe" },
  )
}

/** Moves an invite link's expiry into the past, as if a week had gone by. */
export function expireInviteLink(linkId: string): void {
  // The id is a base64url token: checked here, because it goes into SQL text.
  if (!/^[A-Za-z0-9_-]{43}$/.test(linkId))
    throw new Error(`not an invite link id: ${linkId}`)
  execute(
    `UPDATE invite_links SET expires_at = ${Date.now() - 1000} WHERE id = '${linkId}'`,
  )
}
