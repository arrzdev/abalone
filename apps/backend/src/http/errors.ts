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
