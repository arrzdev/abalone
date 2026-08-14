import { mutationOptions } from "@tanstack/react-query"
import { postFormData, withClientRequest } from "@/data/backend-client"
import type { Profile } from "@/data/profile/queries"
import { resizeToAvatar } from "@/utils/image-resize"

const AVATAR_PATH = "/api/v1/profile/me/avatar"

//the upload is multipart, which the RPC contract cannot describe, so this is the
//one response shape the app spells out by hand instead of inferring
type ProfileEnvelope =
  | { status: "success"; data: { profile: Profile } }
  | { status: "error"; error_code: string }

/**
 * Change the player's picture.
 *
 * The resize happens first and on the client, so what crosses the network is
 * already a 256px square. Attach invalidation at the call site.
 */
export const uploadAvatarMutationOptions = mutationOptions({
  mutationFn: async (picked: Blob): Promise<Profile> => {
    const resized = await resizeToAvatar(picked)

    const form = new FormData()
    form.set("avatar", resized, "avatar.webp")

    const response = await withClientRequest(() =>
      postFormData(AVATAR_PATH, form),
    )
    const body = (await response.json()) as ProfileEnvelope
    if (body.status !== "success") throw new Error(body.error_code)
    return body.data.profile
  },
})
