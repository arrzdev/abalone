import { runDev } from "@repo/dev/run-dev"
import { PORTS } from "@/ports"

runDev({
  ports: Object.values(PORTS),
  // fatal env gate: the same `check:env` the `pnpm dev` prefix used to run,
  // folded in so `tsx scripts/dev.ts` alone validates env before starting.
  preflight: [{ command: "tsx", args: ["env/check-env.ts"] }],
  command: "vite",
  args: ["dev"],
})
