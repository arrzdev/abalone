import { createFileRoute, redirect } from "@tanstack/react-router"

/** The finished list is online games only, so it lives under the hub now. */
export const Route = createFileRoute("/games")({
  beforeLoad: () => {
    throw redirect({
      to: "/online/history",
      search: { page: 1 },
      replace: true,
    })
  },
})
