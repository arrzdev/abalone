/** Avatars are square and small. One size, because there is one place they show. */
export const AVATAR_SIZE = 256

/**
 * Square a picture down to an avatar, in the browser.
 *
 * Doing it here rather than in the worker is what keeps an image library off the
 * server: whatever the player picked, what reaches R2 is a few kilobytes at a
 * known size. The crop is centred cover rather than a squash, so faces survive a
 * portrait photo.
 *
 * WebP is requested but not guaranteed. A browser that cannot encode it silently
 * hands back PNG, which is fine: the upload route sniffs the bytes rather than
 * trusting a declared type, and a 256px PNG is still far inside the size limit.
 */
export async function resizeToAvatar(source: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(source)

  const canvas = document.createElement("canvas")
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE
  const context = canvas.getContext("2d")
  if (!context) {
    bitmap.close()
    throw new Error("avatar_resize_failed")
  }

  //cover: scale so the SHORTER side fills the square, then centre the overflow
  const scale = Math.max(
    AVATAR_SIZE / bitmap.width,
    AVATAR_SIZE / bitmap.height,
  )
  const width = bitmap.width * scale
  const height = bitmap.height * scale
  context.drawImage(
    bitmap,
    (AVATAR_SIZE - width) / 2,
    (AVATAR_SIZE - height) / 2,
    width,
    height,
  )
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.85)
  })
  if (!blob) throw new Error("avatar_resize_failed")
  return blob
}
