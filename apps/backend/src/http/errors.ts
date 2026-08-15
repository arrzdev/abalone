import type { ContentfulStatusCode } from "hono/utils/http-status"

//---- codes ----------------

type ErrorCodeEntry = readonly [
  message: string,
  status: ContentfulStatusCode,
]

//maps backend error_code strings to [user-facing message, HTTP status].
//adding a code is an api contract change — read the map before inventing one,
//and reuse an existing code where it already says what happened.
export const ERROR_CODES = {
  invalid_input: ["Invalid input. Check the data and try again.", 400],
  internal_server_error: [
    "An unexpected error occurred. Please try again.",
    500,
  ],
  endpoint_not_found: ["The requested endpoint does not exist.", 404],
  rate_limit_exceeded: ["Too many requests. Please try again later.", 429],
  not_found: ["That resource was not found.", 404],
  unauthorized: [
    "You need to be signed in to do that. Sign in and try again.",
    401,
  ],
  file_too_large: ["That file is too large. Pick a smaller image.", 413],
  unsupported_media_type: [
    "That file type is not supported. Use a PNG, JPEG, or WebP image.",
    415,
  ],

  //---- online play ----------------
  //there is deliberately no `forbidden` here. a game or an invite you are not
  //party to answers `not_found`, the same as one that never existed — a 403
  //would confirm the row is real to somebody with no business knowing it.
  player_not_found: [
    "No player with that username. Check the spelling and try again.",
    404,
  ],
  invite_self: ["You cannot invite yourself. Pick another player.", 400],
  invite_exists: [
    "You already have an invite out to that player. Cancel it to send a new one.",
    409,
  ],
  game_not_active: ["That game has already finished.", 409],
  not_your_turn: [
    "It is not your turn yet. Wait for your opponent to move.",
    409,
  ],
  illegal_move: [
    "That move is not legal. The board has been put back.",
    400,
  ],
  move_conflict: [
    "The game moved on while you were playing. The board has been refreshed.",
    409,
  ],
} as const satisfies Record<string, ErrorCodeEntry>

export type ErrorCode = keyof typeof ERROR_CODES

//---- domain error ----------------

//thrown by services/middleware; the global handler maps errorCode to a response.
export class CustomError extends Error {
  override readonly name = "CustomError"

  constructor(
    public readonly errorCode: ErrorCode,
    cause?: Error,
  ) {
    super(errorCode, cause !== undefined ? { cause } : undefined)
  }
}
