import { cloudflare } from "@cloudflare/vite-plugin"
import { nativ } from "@repo/nativ/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import { PORTS } from "./ports"

const { appPort, supervisorPort } = PORTS

export default defineConfig({
  envDir: "env",
  server: {
    host: "0.0.0.0",
    port: appPort,
  },
  preview: {
    host: "0.0.0.0",
    port: appPort,
  },
  resolve: {
    tsconfigPaths: true,
    dedupe: ["react", "react-dom"],
  },
  ssr: {
    noExternal: ["@repo/nativ", "@repo/shared"],
  },
  plugins: [
    cloudflare({
      viteEnvironment: { name: "ssr" },
      //the workerd inspector is a devtools channel only a dev run wants. a build
      //ends by prerendering through a preview server, which binds the port too —
      //so `pnpm build` dies with EADDRINUSE whenever this app's dev server is up,
      //which is most of the time. `scripts/dev.ts` sets the flag; nothing else does
      inspectorPort:
        process.env.DEV_INSPECTOR === "1" ? supervisorPort : false,
    }),
    //nativ owns route tree, entries, router, the web manifest, and
    //the service worker — all driven by nativ.config.ts, the single source of truth
    nativ(),
    tailwindcss(),
  ],
  worker: {
    //the minimax opponent is a module worker; vite's classic-worker default
    //would strip its imports
    format: "es",
  },
  build: {
    //the search tables make one chunk larger than vite's default warning
    chunkSizeWarningLimit: 900,
  },
})
