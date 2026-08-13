// appPort = dev server, and that is the whole list. The game is a static
// bundle with no wrangler runtime to attach an inspector to, so it has no
// supervisor port — which is why this is not typed `satisfies AppPorts`:
// @repo/dev's shape describes the two Worker apps, and requires one.
export const PORTS = {
  appPort: 6161,
}
