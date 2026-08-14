import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { ChangeEvent } from "react"
import { useCallback, useRef } from "react"
import { uploadAvatarMutationOptions } from "@/data/profile/mutations"
import { profileQueryKey } from "@/data/profile/queries"

/** What the picker offers. Everything is re-encoded to WebP before it is sent. */
export const ACCEPTED_IMAGES = "image/png,image/jpeg,image/webp"

/**
 * "Change picture", from the file dialog to the refreshed profile.
 *
 * Two places ask for it — the profile page and the account menu in the header —
 * and both need the same hidden input, so the input is rendered by the caller
 * (it has to live in the DOM) and everything around it lives here.
 */
export function useAvatarPicker() {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = useMutation({
    ...uploadAvatarMutationOptions,
    //refetch rather than write the new profile straight into the cache: the
    //query function is the one place that keeps the offline snapshot current,
    //and one extra GET is cheaper than a second writer of it
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: profileQueryKey }),
  })

  const open = useCallback(() => inputRef.current?.click(), [])

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const picked = event.target.files?.[0]
      //cleared straight away so picking the same file twice still fires a change
      event.target.value = ""
      if (!picked) return
      upload.mutate(picked)
    },
    [upload],
  )

  return {
    /** Attach to the hidden `<input type="file">` the caller renders. */
    inputRef,
    /** Attach to that input's `onChange`. */
    handleChange,
    /** Opens the file dialog. */
    open,
    isUploading: upload.isPending,
    hasFailed: upload.isError,
  }
}
