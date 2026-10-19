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

//the request_id of the running context, to hand on to a durable object over rpc
export function currentRequestId(): string | undefined {
  return logContext.getStore()?.request_id
}

//---- wide event (logging standard §4) ----------------
//TODO(logging-standard): implemented by the build task, tests in
//apps/backend/src/utils/log-event.test.ts

//fields and timings collected during one unit of work, for its single line
export type LogEvent = Record<string, unknown> & {
  timings?: Record<string, number>
}

//opens a unit of work (request, queue message, cron tick, rpc call): context is
//added to every line like withLogContext, and addLogFields/addTiming inside fn
//write to a fresh event that logEventFields() reads back
export function withLogEvent<T>(_context: LogContext, _fn: () => T): T {
  throw new Error("not implemented: withLogEvent")
}

//facts for the current unit of work's line; a no-op outside withLogEvent
export function addLogFields(_fields: Record<string, unknown>): void {
  throw new Error("not implemented: addLogFields")
}

//milliseconds spent on a named dependency; repeated calls add up
export function addTiming(_name: string, _ms: number): void {
  throw new Error("not implemented: addTiming")
}

//what the current unit of work collected, timings included when any were added
export function logEventFields(): LogEvent {
  throw new Error("not implemented: logEventFields")
}
