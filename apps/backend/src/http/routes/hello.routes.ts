import { newEndpoint } from "@repo/shared/http"
import { z } from "zod"
import type { Env } from "@/env/registry"
import { ok } from "@/http/envelope"
import { rateLimit } from "@/http/middlewares/rate-limit"
import { valid } from "@/http/middlewares/valid"
import { HelloService } from "@/services/hello.service"

const greetQuerySchema = z.object({
  name: z.string().min(1).max(40).optional(),
})

//the example endpoint, and the whole route contract in one file: rate limit on
//the chain, `valid` in the same tuple as the handler, a service doing the work,
//`ok` on the way out — and no try/catch, because a service throw is the global
//catcher's job. copy this file to start a real domain.
export const helloRoutes = newEndpoint<Env>()
  .use("*", rateLimit("api"))

  //---- greet ----------------

  .get("/", valid("query", greetQuerySchema), (c) => {
    const query = c.req.valid("query")
    const helloService = new HelloService()
    const message = helloService.greet(query.name ?? "world")
    return ok(c, { message })
  })
