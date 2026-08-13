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
      inspectorPort: supervisorPort,
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
