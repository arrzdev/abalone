// biome-ignore-all lint/suspicious/noExplicitAny: spread args forwarded to console, any applies

export type Level = "debug" | "info" | "warn" | "error"

//set once per isolate at the entrypoint (worker fetch, durable object
//constructor): the level threshold and the fields every line carries
export type LoggingConfig = {
  //LOG_LEVEL; anything but debug|info|warn|error means info
  level?: string
  service?: string
  env?: string
  build_sha?: string
}

//lower numbers are chattier; a line is written when its level reaches the threshold
const LEVEL_RANK: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

function isLevel(value: unknown): value is Level {
  return typeof value === "string" && Object.hasOwn(LEVEL_RANK, value)
}

let threshold = LEVEL_RANK.info
let serviceFields: Omit<LoggingConfig, "level"> = {}

//module state, so call it with the isolate's env before the first line. env is
//constant per isolate, so a second call with the same env changes nothing
export function configureLogging(config: LoggingConfig): void {
  threshold = LEVEL_RANK[isLevel(config.level) ? config.level : "info"]
  serviceFields = {
    service: config.service,
    env: config.env,
    build_sha: config.build_sha,
  }
}

//fields every line written inside withLogContext() carries (request_id, …)
export type LogContext = Record<string, string>

//the request context comes from @repo/shared/log-context, which the server
//installs. this file stays browser-safe: the game's client code logs too
let readLogContext: () => LogContext | undefined = () => undefined

export function setLogContextReader(reader: () => LogContext | undefined) {
  readLogContext = reader
}

//credentials and personal data never reach the log store, at any depth (logging
//standard §6). keys match after lowercasing and dropping - and _, and only whole
//keys match: token_count and passed stay
const REDACTED_KEYS = new Set([
  "authorization",
  "cookie",
  "setcookie",
  "password",
  "pass",
  "secret",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "apikey",
  "keyhash",
  "session",
  "sessionid",
  "card",
  "cardnumber",
  "cvc",
  "iban",
  "phone",
  "body",
  "rawbody",
])

//credentials that end up inside free text: an error message, a stack, a note
const SECRET_PATTERN =
  /Bearer\s+\S+|eyJ[\w-]+\.[\w-]+\.[\w-]+|(?:sk|rk)_(?:live|test)_\w+|whsec_\w+/g

const EMAIL_ADDRESS = /^([^@\s])[^@\s]*@([^@\s]+)$/

function normalizedKey(key: string): string {
  return key.toLowerCase().replace(/[-_]/g, "")
}

//first letter and domain: enough to tell two users apart, not to contact one
function maskedEmail(value: unknown): string {
  const match =
    typeof value === "string" ? EMAIL_ADDRESS.exec(value) : null
  if (!match) return "[redacted]"
  return `${match[1]}***@${match[2]}`
}

//Errors stringify to {} by default; this keeps them at any depth, as plain
//objects so their message, stack and cause go through the same redaction
function replacer(key: string, value: unknown): unknown {
  const normalized = normalizedKey(key)
  if (REDACTED_KEYS.has(normalized)) return "[redacted]"
  if (normalized.endsWith("email")) return maskedEmail(value)
  if (typeof value === "string")
    return value.replace(SECRET_PATTERN, "[redacted]")
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
    if (LEVEL_RANK[level] < threshold) return
    //service fields sit with the head: a call field never overwrites them either
    const head = {
      level,
      context: this.context,
      message,
      time: new Date().toISOString(),
      ...serviceFields,
    }
    const fields =
      args.length === 1 && isPlainObject(args[0])
        ? args[0]
        : args.length > 0
          ? { args }
          : {}
    //context and head last: a field never overwrites level, message, time,
    //service or request_id
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

  debug(message: string, ...args: any[]) {
    this.write("debug", message, args)
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
