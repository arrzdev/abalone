import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { PORTS } from "./ports"

const { appPort } = PORTS

export default defineConfig({
  envDir: "env",
  //relative, so a build works under a subpath. index.html and
  //public/site.webmanifest link relatively for the same reason — a leading
  //slash anywhere in either would quietly undo this.
  base: "./",
  server: {
    host: "0.0.0.0",
    port: appPort,
  },
  preview: {
    host: "0.0.0.0",
    port: appPort,
  },
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    //the minimax worker is emitted as a separate chunk by vite's worker handling
    chunkSizeWarningLimit: 900,
  },
  worker: {
    format: "es",
  },
})
