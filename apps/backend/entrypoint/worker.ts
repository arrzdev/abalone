import type { CloudflareBindings } from "@/env/registry"
import { envRegistry } from "@/env/registry"
import { api } from "@/http/api"

//a durable object class has to be exported from the worker's main module for
//wrangler to find it, so the realtime channel is re-exported here rather than
//reached for where it is used
export { PubSub } from "@/modules/realtime/pubsub.do"

export default {
  async fetch(
    request: Request,
    env: CloudflareBindings & Record<string, unknown>,
    ctx: ExecutionContext,
  ): Promise<Response> {
    envRegistry.setEnv(env)
    return await api.fetch(request, env, ctx)
  },
}
