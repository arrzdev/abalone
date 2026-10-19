import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers"
import { defineConfig } from "vitest/config"

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    //mirrors tsconfig.json `paths`. the first match wins, so every longer
    //prefix comes before the bare `@`
    alias: [
      {
        find: "@/entrypoint",
        replacement: path.resolve(rootDir, "entrypoint/worker.ts"),
      },
      { find: "@/env", replacement: path.resolve(rootDir, "env") },
      {
        find: "@repo/env-validation",
        replacement: path.resolve(rootDir, "shared/env-validation"),
      },
      {
        find: "@repo/shared",
        replacement: path.resolve(rootDir, "shared"),
      },
      {
        find: "#env-validation/src",
        replacement: path.resolve(rootDir, "shared/env-validation"),
      },
      { find: "#shared", replacement: path.resolve(rootDir, "shared") },
      { find: "@", replacement: path.resolve(rootDir, "src") },
    ],
  },
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(
        path.join(rootDir, "src/database/migrations"),
      )

      return {
        //the top-level (dev) block: local D1 and local rate limiters, so the
        //suite needs no network and no Cloudflare account
        wrangler: { configPath: path.join(rootDir, "wrangler.toml") },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            RATE_LIMIT_ALLOW_TEST_BYPASS: "true",
            //public origins on purpose: neither is private, so
            //allowsPrivateOrigins() is false and the tests exercise the
            //production network policy rather than the dev one. two of them
            //because a single-entry list would never exercise the split.
            FRONTEND_URLS: "http://example.com,http://second.example.com",
          },
        },
      }
    }),
  ],
  test: {
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/test-support/apply-migrations.ts"],
  },
})
