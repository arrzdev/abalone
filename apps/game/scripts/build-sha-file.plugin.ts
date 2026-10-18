import { execSync } from "node:child_process"
import type { Plugin } from "vite"

/**
 * Writes `/version.json` into the client assets: the commit this build is from,
 * so a drift check can read exactly what the game Worker serves. The deploy
 * sets BUILD_SHA (.github/scripts/deploy/app.sh); in CI without it the commit
 * is GITHUB_SHA, and locally it is HEAD.
 */
export function buildShaFile(): Plugin {
  return {
    name: "abalone:build-sha-file",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",
    generateBundle() {
      const sha =
        process.env.BUILD_SHA ||
        process.env.GITHUB_SHA ||
        execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim()
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: `${JSON.stringify({ sha })}\n`,
      })
    },
  }
}
