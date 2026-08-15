import type { ErrorCode } from "@repo/backend/http/errors"

/**
 * Every answer the api can give, as a key in the `errors` namespace.
 *
 * The backend carries an English sentence for each code, and that sentence is
 * the api's own answer — right for anything reading the api, wrong for a player
 * reading this app in Portuguese. So the code crosses the wire and the
 * translation happens here.
 *
 * The `satisfies` is the point of the map: a code added on the server is a type
 * error in this file until it has a key, so a new failure can never reach a
 * player as a bare `not_your_turn`.
 */
export const API_ERROR_KEYS = {
  invalid_input: "errors:api_invalid_input",
  internal_server_error: "errors:api_internal_server_error",
  endpoint_not_found: "errors:api_endpoint_not_found",
  rate_limit_exceeded: "errors:api_rate_limit_exceeded",
  not_found: "errors:api_not_found",
  unauthorized: "errors:api_unauthorized",
  file_too_large: "errors:api_file_too_large",
  unsupported_media_type: "errors:api_unsupported_media_type",
  player_not_found: "errors:api_player_not_found",
  invite_self: "errors:api_invite_self",
  invite_exists: "errors:api_invite_exists",
  game_not_active: "errors:api_game_not_active",
  not_your_turn: "errors:api_not_your_turn",
  illegal_move: "errors:api_illegal_move",
  move_conflict: "errors:api_move_conflict",
} as const satisfies Record<ErrorCode, string>

/** The key for whatever the request threw, whether or not the api answered. */
export function apiErrorKey(error: unknown): string {
  const message = error instanceof Error ? error.message : ""

  //the sentinel `withClientRequest` throws when the request never landed. it is
  //not a code the api can return, so it is not in the map above.
  if (message === "network_unreachable")
    return "errors:network_unreachable"

  return message in API_ERROR_KEYS
    ? API_ERROR_KEYS[message as ErrorCode]
    : "errors:unknown"
}
