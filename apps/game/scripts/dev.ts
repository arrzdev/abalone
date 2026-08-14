import { runDev } from "@repo/dev/run-dev"
import { PORTS } from "@/ports"

//only a dev run gets the workerd inspector. vite.config reads this rather than
//its own `command`, because the prerender step at the end of a build starts a
//preview server — which re-resolves the config as `serve` and would bind the
//port right back. runDev spawns with the inherited env, so setting it here is
//enough.
process.env.DEV_INSPECTOR = "1"

runDev({
  ports: Object.values(PORTS),
  //fatal env gate, same as the other apps — the game declares nothing today,
  //so this passes trivially and starts failing the moment it declares one.
  preflight: [{ command: "tsx", args: ["env/check-env.ts"] }],
  command: "vite",
  args: ["dev"],
})
