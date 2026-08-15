import { env } from "@/env/registry"

//the frontend never learns where avatars are hosted — it is handed a finished
//url, or null for a player who never uploaded one. shared kernel rather than a
//method, because both the profile and the online domains hand out pictures.
export function avatarUrl(avatarKey: string | null): string | null {
  if (!avatarKey) return null
  return `${env.AVATAR_PUBLIC_URL}/${avatarKey}`
}
