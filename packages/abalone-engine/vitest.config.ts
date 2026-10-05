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
  },
})
