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
