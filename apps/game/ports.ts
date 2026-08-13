import type { AppPorts } from "@repo/dev/ports"

// appPort = dev server; supervisorPort = wrangler/cloudflare inspector.
export const PORTS = {
  appPort: 6161,
  supervisorPort: 9221,
} satisfies AppPorts
