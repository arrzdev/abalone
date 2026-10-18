// biome-ignore-all lint/suspicious/noExplicitAny: spread args forwarded to console, any applies

type Level = "info" | "warn" | "error"

//fields every line written inside withLogContext() carries (request_id, …)
export type LogContext = Record<string, string>

//the request context comes from @repo/shared/log-context, which the server
//installs. this file stays browser-safe: the game's client code logs too
let readLogContext: () => LogContext | undefined = () => undefined

export function setLogContextReader(reader: () => LogContext | undefined) {
  readLogContext = reader
}

//credentials never reach the log store, at any depth
const REDACTED_KEYS = new Set(["authorization", "cookie", "set-cookie"])

//Errors stringify to {} by default; this keeps them at any depth
function replacer(key: string, value: unknown): unknown {
  if (REDACTED_KEYS.has(key.toLowerCase())) return "[redacted]"
  if (value instanceof Error)
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      cause: value.cause,
    }
  return value
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

//one JSON object per line so Workers Logs indexes level/context/message as fields.
//a single plain-object argument becomes top-level fields; anything else goes in args.
export class Logger {
  constructor(private context: string) {}

  private write(level: Level, message: string, args: any[]) {
    const head = { level, context: this.context, message }
    const fields =
      args.length === 1 && isPlainObject(args[0])
        ? args[0]
        : args.length > 0
          ? { args }
          : {}
    //context and head last: a field never overwrites level, message or request_id
    const entry = { ...fields, ...readLogContext(), ...head }
    const line = (() => {
      try {
        return JSON.stringify(entry, replacer)
      } catch {
        return JSON.stringify({
          ...readLogContext(),
          ...head,
          args: "[unserializable]",
        })
      }
    })()
    if (level === "error") console.error(line)
    else if (level === "warn") console.warn(line)
    else console.log(line)
  }

  info(message: string, ...args: any[]) {
    this.write("info", message, args)
  }

  warn(message: string, ...args: any[]) {
    this.write("warn", message, args)
  }

  error(message: string, ...args: any[]) {
    this.write("error", message, args)
  }
}
