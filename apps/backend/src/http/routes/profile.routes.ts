import { newEndpoint } from "@repo/shared/http"
import tryCatch from "@repo/shared/try-catch"
import { getDb } from "@/database/client"
import type { Env } from "@/env/registry"
import { ok } from "@/http/envelope"
import { CustomError } from "@/http/errors"
import type { AuthedVariables } from "@/http/middlewares/auth"
import { requireAuth } from "@/http/middlewares/auth"
import { rateLimit } from "@/http/middlewares/rate-limit"
import { ProfileService } from "@/services/profile.service"

//the field name the upload form posts under
const AVATAR_FIELD = "avatar"

//multipart is not a zod shape, so the file comes out of the request here rather
//than through `valid()`. a body that is not multipart at all makes formData()
//throw, which would otherwise surface as a 500 instead of a bad request.
async function readUploadedAvatar(request: Request): Promise<Uint8Array> {
  const [form, formError] = await tryCatch(() => request.formData())
  if (formError) throw new CustomError("invalid_input", formError)

  //why the cast: @cloudflare/workers-types declares FormData.get as returning
  //`string | null`, but the runtime hands back a File for a file part. Blob is
  //the honest supertype, and it is what arrayBuffer() comes from. a plain string
  //here means the client posted something that is not a picture.
  const file = form?.get(AVATAR_FIELD) as Blob | string | null | undefined
  if (!file || typeof file === "string")
    throw new CustomError("invalid_input")

  const [buffer, readError] = await tryCatch(() => file.arrayBuffer())
  if (readError || !buffer)
    throw new CustomError("invalid_input", readError ?? undefined)
  return new Uint8Array(buffer)
}

export const profileRoutes = newEndpoint<Env, AuthedVariables>()
  //rate-limit BEFORE auth so a flood is shed before paying a session lookup
  .use("*", rateLimit("api"))
  .use("*", requireAuth())

  //---- read own profile ----------------

  .get("/me", async (c) => {
    const profileService = new ProfileService(
      getDb(c.env.DB),
      c.env.AVATARS,
    )
    const profile = await profileService.get(c.get("user").id)
    return ok(c, { profile })
  })

  //---- change picture ----------------

  .post("/me/avatar", rateLimit("upload"), async (c) => {
    const bytes = await readUploadedAvatar(c.req.raw)
    const profileService = new ProfileService(
      getDb(c.env.DB),
      c.env.AVATARS,
    )
    const profile = await profileService.setAvatar(c.get("user").id, bytes)
    return ok(c, { profile })
  })
