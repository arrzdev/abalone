import { runDev } from "@repo/dev/run-dev"
import { PORTS } from "@/ports"

runDev({
  ports: Object.values(PORTS),
  //fatal env gate, same as the other apps — the game declares nothing today,
  //so this passes trivially and starts failing the moment it declares one.
  preflight: [{ command: "tsx", args: ["env/check-env.ts"] }],
  command: "vite",
  args: ["dev"],
})
