import { newEndpoint } from "@repo/shared/http"
import { getDb } from "@/database/client"
import type { Env } from "@/env/registry"
import { CustomError } from "@/http/errors"
import { rateLimit } from "@/http/middlewares/rate-limit"
import { allowsPrivateOrigins } from "@/http/network-policy"
import { ProfileService } from "@/services/profile.service"

//---- dev-only avatar passthrough ----------------
//in production the browser fetches an avatar straight from the bucket's public
//custom domain and this worker never sees the request. wrangler emulates the R2
//*binding* locally but not public bucket access (workers-sdk#3687), so without
//this route every <img> would break in dev — and pointing the dev binding at the
//real bucket instead would put an internet connection between a local `pnpm dev`
//and its own avatars, which is the opposite of what local means.
//
//it is gated on the same config-derived dev signal the cors plugin uses, never a
//process or build flag: against an https frontend allowsPrivateOrigins() is
//false and this route answers as if it did not exist.

export const devAvatarRoutes = newEndpoint<Env>()
  .use("*", rateLimit("api"))

  .get("/:key{.+}", async (c) => {
    if (!allowsPrivateOrigins()) throw new CustomError("not_found")

    const profileService = new ProfileService(
      getDb(c.env.DB),
      c.env.AVATARS,
    )
    const object = await profileService.readAvatar(
      `avatars/${c.req.param("key")}`,
    )

    //serve the headers the object itself carries, so what is exercised in dev is
    //the caching behaviour that ships
    return new Response(object.body, {
      headers: {
        "content-type":
          object.httpMetadata?.contentType ?? "application/octet-stream",
        "cache-control": object.httpMetadata?.cacheControl ?? "no-store",
        etag: object.httpEtag,
      },
    })
  })
