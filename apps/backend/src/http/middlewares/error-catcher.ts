import { addLogFields } from "@repo/shared/log-context"
import type { Context } from "hono"
import { error } from "@/http/envelope"
import { CustomError, ERROR_CODES, RetryLaterError } from "@/http/errors"

const DEFAULT_RETRY_AFTER_SECONDS = 60

//global catcher: reply with the mapped error code, and write no line of its own.
//the request log writes the one line per request; this adds the error_code (through
//error()) and, for an unexpected failure, the error itself to it. the body repeats
//the request_id so a user's report can be traced to that line.
export function errorCatcher(caught: unknown, c: Context) {
  if (caught instanceof CustomError) {
    //every 429 says when to come back; a lockout knows exactly when
    if (caught instanceof RetryLaterError)
      c.header("Retry-After", String(caught.retryAfterSeconds))
    else if (ERROR_CODES[caught.errorCode][1] === 429)
      c.header("Retry-After", String(DEFAULT_RETRY_AFTER_SECONDS))
    return error(c, caught.errorCode)
  }

  const errorCode = "internal_server_error"
  addLogFields({
    error_code: errorCode,
    error:
      caught instanceof Error
        ? {
            name: caught.name,
            message: caught.message,
            stack: caught.stack,
            cause: caught.cause,
          }
        : { name: typeof caught, message: String(caught) },
  })

  return c.json(
    {
      status: "error",
      error_code: errorCode,
      request_id: c.get("requestId"),
    },
    ERROR_CODES[errorCode][1],
  )
}
