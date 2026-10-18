/**
 * The game Worker's entry: TanStack Start's handler, with one path in front of
 * it.
 *
 * An invite link pasted into a chat app is read by a machine that never runs
 * the page, so the card naming the sender has to be in the HTML this Worker
 * returns. Every other request goes to Start untouched. Design:
 * `docs/invite-links.md`, "The link preview". Every response leaves with the
 * security and cache headers (`@/server/security-headers`), an `x-request-id`,
 * and one `request` log line (`@/server/request-log`).
 */

import { env as bindings } from "cloudflare:workers"
import handler, {
  createServerEntry,
} from "@tanstack/react-start/server-entry"
import { env } from "@/env/registry"
import type { InviteLinkSummary } from "@/server/invite-page"
import {
  inviteLinkIdFromPath,
  serveInvitePage,
} from "@/server/invite-page"
import { withRequestLog } from "@/server/request-log"
import { withSecurityHeaders } from "@/server/security-headers"
import { SITE_ORIGIN } from "@/utils/site"

//past this the card goes generic: a chat app waits a few seconds for the whole
//page, and the backend is one D1 query away
const READ_TIMEOUT_MS = 1500

type GameBindings = {
  //production only: the backend Worker. a plain fetch to the site's own /api
  //skips Worker routes, so a binding is the one way to reach it from here
  BACKEND?: Fetcher
}

export default createServerEntry({
  async fetch(request) {
    return withRequestLog(request, async (requestId) =>
      withSecurityHeaders(await respond(request, requestId)),
    )
  },
})

async function respond(
  request: Request,
  requestId: string,
): Promise<Response> {
  const linkId =
    request.method === "GET"
      ? inviteLinkIdFromPath(new URL(request.url).pathname)
      : null
  if (!linkId) return handler.fetch(request)

  return serveInvitePage({
    linkId,
    shell: await handler.fetch(request),
    readLink: (id) => readInviteLink(id, request, requestId),
  })
}

/**
 * The backend's public read, `GET /api/v1/invite-links/:id`, on the visitor's
 * behalf: their address goes along, so the rate limit counts them rather than
 * this Worker. So does the request id, so both Workers' lines share it.
 */
async function readInviteLink(
  linkId: string,
  visitor: Request,
  requestId: string,
): Promise<InviteLinkSummary | null> {
  const path = `/api/v1/invite-links/${encodeURIComponent(linkId)}`
  const headers = new Headers({
    accept: "application/json",
    "x-request-id": requestId,
  })
  const visitorIp = visitor.headers.get("cf-connecting-ip")
  if (visitorIp) headers.set("cf-connecting-ip", visitorIp)
  const init = { headers, signal: AbortSignal.timeout(READ_TIMEOUT_MS) }

  const backend = (bindings as GameBindings).BACKEND
  const response = await readFrom(backend, path, init)
  if (!response) return null

  const body: { status: string; data?: InviteLinkSummary } =
    await response.json()
  if (body.status !== "success" || !body.data) return null
  return body.data
}

/** The binding in production, `VITE_BACKEND_URL` in dev and e2e. */
function readFrom(
  backend: Fetcher | undefined,
  path: string,
  init: RequestInit,
): Promise<Response> | null {
  if (backend) return backend.fetch(`${SITE_ORIGIN}${path}`, init)
  if (env.VITE_BACKEND_URL)
    return fetch(`${env.VITE_BACKEND_URL}${path}`, init)
  return null
}
