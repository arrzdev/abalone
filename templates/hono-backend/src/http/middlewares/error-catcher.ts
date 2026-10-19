import { Logger } from "@repo/shared/logging"
import type { Context } from "hono"
import { error } from "@/http/envelope"
import { CustomError, ERROR_CODES } from "@/http/errors"
import { endpointPattern } from "@/http/utils/endpoint-pattern"

const log = new Logger("error-catcher")

//global catcher: log unexpected failures once, reply with the mapped error code.
//domain CustomErrors bubble here by design and are not logged. the crash line gets
//the request_id from the log context; the body repeats it so a player's report can
//be traced to the line.
export function errorCatcher(caught: unknown, c: Context) {
  if (caught instanceof CustomError) return error(c, caught.errorCode)

  const errorCode = "internal_server_error"
  const trace =
    caught instanceof Error
      ? {
          name: caught.name,
          message: caught.message,
          stack: caught.stack,
          ...(caught.cause !== undefined ? { cause: caught.cause } : {}),
        }
      : { type: typeof caught, value: caught }

  //the stack lives only in trace (one copy). route is the matched pattern: the
  //raw path would put resource and user ids in the log
  log.error("api_unhandled_exception", {
    error_code: errorCode,
    method: c.req.method,
    route: endpointPattern(c),
    trace,
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
