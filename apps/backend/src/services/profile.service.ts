import tryCatch from "@repo/shared/try-catch"
import { eq } from "drizzle-orm"
import { user } from "@/database/auth.schema"
import type { Db } from "@/database/client"
import { profiles } from "@/database/schema"
import { CustomError } from "@/http/errors"
import { avatarUrl } from "@/utils/avatar-url"

/** A player as the app shows them: a permanent handle and a picture. */
export type Profile = {
  username: string | null
  displayUsername: string | null
  //absolute and immutable, or null when they never uploaded one
  avatarUrl: string | null
}

//---- upload limits ----------------

/** 512 KB. The client resizes to 256×256 WebP first, so this is generous. */
export const MAX_AVATAR_BYTES = 512 * 1024

//the declared Content-Type is a claim, not evidence — a renamed .exe arrives as
//image/webp for free. sniff the bytes instead, and take the extension from what
//we found rather than from what was declared.
const IMAGE_SIGNATURES = [
  {
    extension: "png",
    contentType: "image/png",
    magic: [0x89, 0x50, 0x4e, 0x47],
  },
  {
    extension: "jpg",
    contentType: "image/jpeg",
    magic: [0xff, 0xd8, 0xff],
  },
] as const

//one year, and `immutable` so a browser never even revalidates. safe because the
//key is the hash of the bytes: the same key can only ever mean the same image.
const AVATAR_CACHE_CONTROL = "public, max-age=31536000, immutable"

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  if (bytes.length < magic.length) return false
  return magic.every((byte, index) => bytes[index] === byte)
}

//webp needs two probes: "RIFF" at 0 and "WEBP" at 8, with the file length
//between them, so it does not fit the flat prefix table above.
function isWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  const riff = [0x52, 0x49, 0x46, 0x46]
  const webp = [0x57, 0x45, 0x42, 0x50]
  return (
    startsWith(bytes, riff) &&
    webp.every((byte, index) => bytes[8 + index] === byte)
  )
}

function sniffImage(
  bytes: Uint8Array,
): { extension: string; contentType: string } | null {
  if (isWebp(bytes))
    return { extension: "webp", contentType: "image/webp" }
  const match = IMAGE_SIGNATURES.find((signature) =>
    startsWith(bytes, signature.magic),
  )
  if (!match) return null
  return { extension: match.extension, contentType: match.contentType }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

//---- service ----------------

export class ProfileService {
  constructor(
    private db: Db,
    private bucket: R2Bucket,
  ) {}

  /** The signed-in player's own profile. */
  async get(userId: string): Promise<Profile> {
    const [row, readError] = await tryCatch(() =>
      this.db
        .select({
          username: user.username,
          displayUsername: user.displayUsername,
          avatarKey: profiles.avatarKey,
        })
        .from(user)
        .leftJoin(profiles, eq(profiles.userId, user.id))
        .where(eq(user.id, userId))
        .get(),
    )
    if (readError)
      throw new CustomError("internal_server_error", readError)
    if (!row) throw new CustomError("not_found")

    return {
      username: row.username,
      displayUsername: row.displayUsername,
      avatarUrl: avatarUrl(row.avatarKey),
    }
  }

  /**
   * Store a new picture and point the profile at it.
   *
   * The key is the SHA-256 of the bytes, so the URL is immutable by
   * construction and two players who upload the same image share one object.
   * That sharing is also why the previous object is **not** deleted: the key
   * says nothing about who uploaded it, so a delete could pull the picture out
   * from under someone else. Orphaned objects are the cheap side of that trade.
   */
  async setAvatar(userId: string, bytes: Uint8Array): Promise<Profile> {
    if (bytes.byteLength > MAX_AVATAR_BYTES)
      throw new CustomError("file_too_large")

    const image = sniffImage(bytes)
    if (!image) throw new CustomError("unsupported_media_type")

    const digest = await sha256Hex(bytes)
    const key = `avatars/${digest}.${image.extension}`

    const [, uploadError] = await tryCatch(() =>
      this.bucket.put(key, bytes, {
        httpMetadata: {
          contentType: image.contentType,
          //written onto the object so R2 serves it on the public domain with no
          //worker in the read path
          cacheControl: AVATAR_CACHE_CONTROL,
        },
      }),
    )
    if (uploadError)
      throw new CustomError("internal_server_error", uploadError)

    const [, writeError] = await tryCatch(() =>
      this.db
        .update(profiles)
        .set({ avatarKey: key, updatedAt: new Date() })
        .where(eq(profiles.userId, userId)),
    )
    if (writeError)
      throw new CustomError("internal_server_error", writeError)

    return this.get(userId)
  }

  /**
   * Stream an avatar object back.
   *
   * Only the dev-only passthrough route uses this: in production the browser
   * fetches the object straight from the bucket's public domain and this worker
   * is never on the read path.
   */
  async readAvatar(key: string): Promise<R2ObjectBody> {
    const [object, readError] = await tryCatch(() => this.bucket.get(key))
    if (readError)
      throw new CustomError("internal_server_error", readError)
    if (!object) throw new CustomError("not_found")
    return object
  }
}
