import { newEndpoint } from "@repo/shared/http"
import { z } from "zod"
import { getDb } from "@/database/client"
import type { Env } from "@/env/registry"
import { ok } from "@/http/envelope"
import { rateLimit } from "@/http/middlewares/rate-limit"
import { valid } from "@/http/middlewares/valid"
import { NotesService } from "@/services/notes.service"

//---- schemas ----------------

const createNoteSchema = z.object({
  body: z.string().min(1).max(2_000),
})

const noteParamSchema = z.object({
  id: z.string().min(1),
})

//---- routes ----------------

//the example domain. thin on purpose: validate, call the service, answer the
//success path. a missing note is the service's `not_found` throw, rendered by
//the global catcher — never an `if` here.
export const notesRoutes = newEndpoint<Env>()
  .use("*", rateLimit("api"))

  //---- list ----------------

  .get("/", async (c) => {
    const notesService = new NotesService(getDb(c.env.DB))
    const notes = await notesService.getAll()
    return ok(c, { notes })
  })

  //---- create ----------------

  .post("/", valid("json", createNoteSchema), async (c) => {
    const { body } = c.req.valid("json")
    const notesService = new NotesService(getDb(c.env.DB))
    const note = await notesService.create(body)
    return ok(c, { note }, 201)
  })

  //---- get ----------------

  .get("/:id", valid("param", noteParamSchema), async (c) => {
    const { id } = c.req.valid("param")
    const notesService = new NotesService(getDb(c.env.DB))
    const note = await notesService.getById(id)
    return ok(c, { note })
  })
