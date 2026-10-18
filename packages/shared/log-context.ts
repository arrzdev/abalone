import { AsyncLocalStorage } from "node:async_hooks"
import type { LogContext } from "#shared/logging"
import { setLogContextReader } from "#shared/logging"

//server only (node:async_hooks, nodejs_compat): importing this module makes every
//Logger line carry the fields of the withLogContext() call it runs in
const logContext = new AsyncLocalStorage<LogContext>()
setLogContextReader(() => logContext.getStore())

//run fn with fields added to every log line it writes, across awaits
export function withLogContext<T>(context: LogContext, fn: () => T): T {
  return logContext.run({ ...logContext.getStore(), ...context }, fn)
}

//any caller can send x-request-id and it is echoed in logs, a header and error bodies
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/

//a caller's id (a service binding, a retry) wins, then the edge's cf-ray, then a new one
export function requestIdFrom(request: Request): string {
  const incoming = request.headers.get("x-request-id")
  if (incoming && SAFE_REQUEST_ID.test(incoming)) return incoming
  return request.headers.get("cf-ray") || crypto.randomUUID()
}
