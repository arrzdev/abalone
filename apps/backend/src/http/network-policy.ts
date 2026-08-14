import { env } from "@/env/registry"
import { parseOriginList } from "@/env/schema"
import { isPrivateOrigin } from "@/utils/is-private-origin"

//parsed once per raw value rather than per request: this is read inside the
//CORS callback and on every better-auth call, and a worker isolate serves many
//requests with the same secrets. keyed on the raw string so a changed value
//(tests calling setEnv, a new deploy's isolate) re-parses on its own.
let cachedRaw: string | null = null
let cachedOrigins: string[] = []

/**
 * Every origin the web app is served from.
 *
 * More than one because the game answers on more than one domain, which is a
 * fact about how it is published rather than about the app — so it is config,
 * comma-separated, and this is the only place that knows it is a list.
 */
export function frontendOrigins(): string[] {
  const raw = env.FRONTEND_URLS
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedOrigins = parseOriginList(raw ?? "")
  }
  return cachedOrigins
}

//whether the network policy runs in "dev" mode — CORS reflecting and better-auth
//trusting localhost/LAN origins — derived from the configured frontend origins,
//NOT a build/process flag. a deployed worker can't reliably read NODE_ENV/CI at
//module load (secrets arrive per-request, and process.env.CI is simply absent in
//production, which made the old `process.env.CI !== "true"` evaluate to dev), so
//"is this a dev environment" is decided by the one signal that IS present and
//trustworthy: are the configured frontend origins themselves localhost/LAN. a
//production https frontend yields false, so private origins are never reflected
//or trusted in prod.
//
//`every`, not `some`: a production list that picked up a stray localhost entry
//would otherwise switch dev mode on in production. an empty list is not dev
//either — with nothing configured there is nothing to be in dev about, and
//failing closed is the whole point of deriving this from config.
export function allowsPrivateOrigins(): boolean {
  const origins = frontendOrigins()
  return origins.length > 0 && origins.every(isPrivateOrigin)
}
