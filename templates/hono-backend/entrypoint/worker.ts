import type { CloudflareBindings } from "@/env/registry"
import { envRegistry } from "@/env/registry"
import { api } from "@/http/api"
import { configureLoggingFrom } from "@/utils/logging-config"

//a worker gets its bindings per request, not at module load, so the env
//registry is seeded here before anything reads it
export default {
  async fetch(
    request: Request,
    env: CloudflareBindings & Record<string, unknown>,
    ctx: ExecutionContext,
  ): Promise<Response> {
    envRegistry.setEnv(env)
    configureLoggingFrom(env)
    return await api.fetch(request, env, ctx)
  },
}
