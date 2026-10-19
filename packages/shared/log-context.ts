import { AsyncLocalStorage } from "node:async_hooks"
import type { LogContext } from "#shared/logging"
import { setLogContextReader } from "#shared/logging"

//what a unit of work collects for its single line (see withLogEvent below)
type EventBag = {
  fields: Record<string, unknown>
  timings: Record<string, number>
}

type Store = {
  context: LogContext
  event?: EventBag
}

//server only (node:async_hooks, nodejs_compat): importing this module makes every
//Logger line carry the fields of the withLogContext() call it runs in
const logContext = new AsyncLocalStorage<Store>()
setLogContextReader(() => logContext.getStore()?.context)

//run fn with fields added to every log line it writes, across awaits. it keeps
//the running event, so facts added inside still reach the unit of work's line
export function withLogContext<T>(context: LogContext, fn: () => T): T {
  const parent = logContext.getStore()
  return logContext.run(
    { context: { ...parent?.context, ...context }, event: parent?.event },
    fn,
  )
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
  return logContext.getStore()?.context.request_id
}

//---- wide event (logging standard §4) ----------------

//fields and timings collected during one unit of work, for its single line
export type LogEvent = Record<string, unknown> & {
  timings?: Record<string, number>
}

//opens a unit of work (request, queue message, cron tick, rpc call): context is
//added to every line like withLogContext, and addLogFields/addTiming inside fn
//write to a fresh event that logEventFields() reads back
export function withLogEvent<T>(context: LogContext, fn: () => T): T {
  const parent = logContext.getStore()
  return logContext.run(
    {
      context: { ...parent?.context, ...context },
      event: { fields: {}, timings: {} },
    },
    fn,
  )
}

//facts for the current unit of work's line; a no-op outside withLogEvent
export function addLogFields(fields: Record<string, unknown>): void {
  const event = logContext.getStore()?.event
  if (event) Object.assign(event.fields, fields)
}

//milliseconds spent on a named dependency; repeated calls add up
export function addTiming(name: string, ms: number): void {
  const timings = logContext.getStore()?.event?.timings
  if (timings) timings[name] = (timings[name] ?? 0) + ms
}

//what the current unit of work collected, timings included when any were added
export function logEventFields(): LogEvent {
  const event = logContext.getStore()?.event
  if (!event) return {}
  if (Object.keys(event.timings).length === 0) return { ...event.fields }
  return { ...event.fields, timings: { ...event.timings } }
}
