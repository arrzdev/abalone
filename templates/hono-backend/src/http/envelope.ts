import { createApiEnvelope } from "@repo/shared/http"
import { addLogFields } from "@repo/shared/log-context"
import { ERROR_CODES } from "@/http/errors"

const envelope = createApiEnvelope(ERROR_CODES)

//ok() + error() response builders bound to this app's codes.
//routes, middleware, and the global catcher import them from here.
export const { ok } = envelope

//every error response puts its error_code on the request line, wherever it was
//answered: a route, a guard, the not-found handler or the global catcher
export const error: typeof envelope.error = (c, error_code) => {
  addLogFields({ error_code })
  return envelope.error(c, error_code)
}
