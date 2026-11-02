import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

//mirror the package's "#nativ/*" subpath import (package.json "imports") so tests can
//use the same self-alias the source does instead of brittle relative paths
const srcDir = fileURLToPath(new URL("./src", import.meta.url))

//happy-dom gives the hook a document to mount into (Testing Library's
//renderHook); the engine itself only touches the synthetic events it's handed
export default defineConfig({
  resolve: {
    alias: { "#nativ": srcDir },
  },
  test: {
    environment: "happy-dom",
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      //service-worker-shell imports a virtual module only the nativ vite
      //plugin resolves, so coverage cannot load it outside an app build
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
        "src/shell/service-worker-shell.ts",
      ],
      reporter: ["text", "json-summary"],
      //today's totals rounded down: most of the shell is DOM and gesture code
      //that the e2e suite covers, so this floor only stops it slipping. the CI
      //gate runs this script instead of the plain test one
      thresholds: {
        lines: 14,
        branches: 14,
        functions: 14,
        statements: 14,
      },
    },
  },
})
