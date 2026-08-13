import type { AppPorts } from "@repo/dev/ports"

// appPort = dev server; supervisorPort = wrangler/cloudflare inspector.
export const PORTS = {
  appPort: 8181,
  supervisorPort: 9218,
} satisfies AppPorts
