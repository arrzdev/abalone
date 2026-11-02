import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

//mirror the package's "#abalone-engine/*" subpath import (package.json
//"imports") so tests use the same self-alias the source does instead of
//brittle relative paths
const srcDir = fileURLToPath(new URL("./src", import.meta.url))

//node, because the engine is pure: no DOM, no I/O, just boards in and out
export default defineConfig({
  resolve: {
    alias: { "#abalone-engine": srcDir },
  },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      reporter: ["text", "json-summary"],
      //today's numbers rounded down: the engine holds every rule of the game,
      //so a change that ships an untested branch here fails the CI gate, which
      //runs this script instead of the plain test one
      thresholds: {
        lines: 99,
        branches: 98,
        functions: 100,
        statements: 99,
      },
    },
  },
})
