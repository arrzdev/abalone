import type { AppPorts } from "@repo/dev/ports"

// appPort = dev server; supervisorPort = wrangler/cloudflare inspector.
export const PORTS = {
  appPort: 7171,
  supervisorPort: 9220,
} satisfies AppPorts
