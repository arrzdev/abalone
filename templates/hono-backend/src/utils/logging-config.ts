import { configureLogging } from "@repo/shared/logging"

//a binding is a string when set; an empty one counts as missing
function text(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined
}

//called where an isolate first sees its env (the worker's fetch, a durable
//object's constructor): the level threshold and the fields every line carries.
//LOG_LEVEL comes from the env file, DEPLOY_ENV from wrangler.toml, BUILD_SHA from
//the deploy's --var
export function configureLoggingFrom(env: Record<string, unknown>): void {
  configureLogging({
    level: text(env.LOG_LEVEL),
    service: "hono-backend",
    env: text(env.DEPLOY_ENV) ?? "local",
    build_sha: text(env.BUILD_SHA) ?? "local",
  })
}
