import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

//mirror the app's own "@/" alias (tsconfig paths) so tests use the same
//specifier the source does instead of brittle relative paths (core-imports)
const rootDir = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/env\//, replacement: `${rootDir}env/` },
      { find: /^@\//, replacement: `${rootDir}src/` },
    ],
  },
  test: {
    //happy-dom because this app's data layer is written for a browser: the
    //backend client reads window.location to resolve its host, and the realtime
    //client wants a WebSocket global to exist. hook tests will want it too.
    environment: "happy-dom",
    //the env registry hydrates from import.meta.env at module scope, so the
    //declared keys have to be there or importing anything under src/data throws
    //before a single test runs. a literal, not a .env file — a suite that only
    //passes on a machine with local env is not a suite.
    env: {
      VITE_BACKEND_URL: "http://localhost:8181",
    },
  },
})
