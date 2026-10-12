import type { InferResponseType } from "hono/client"
import type { api } from "@/data/backend-client"
import { apiError } from "@/data/backend-client"
import type { PublicInviteLink } from "@/data/online/queries"

/** What the public read of an invite link answers, success or refusal. */
export type InviteLinkResponse = InferResponseType<
  (typeof api.api.v1)["invite-links"][":id"]["$get"]
>

/**
 * What the invite page is told about a link, from what the server answered.
 *
 * A link the server never issued, or a paste cut short (a malformed token is
 * refused before it is looked up), is broken: the page says the link does not
 * work, never that it ran out. Any other refusal is a failure to read, and
 * throws so the page can offer to try again.
 */
export function inviteLinkFromResponse(
  body: InviteLinkResponse,
): PublicInviteLink {
  if (body.status === "success") return body.data

  const isBroken =
    body.error_code === "not_found" || body.error_code === "invalid_input"
  if (isBroken) return { inviterName: null, state: "broken" }
  throw apiError(body.error_code)
}
