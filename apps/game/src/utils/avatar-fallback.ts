/**
 * What an avatar shows when there is no picture: the initials of the name, on a
 * colour that is the same every time for the same name.
 *
 * Every background in the palette holds white text at the AA ratio for body
 * text (4.5:1), so a 12px initial on a 28px avatar is as legible as a 40px one
 * on an 84px avatar. `avatar-fallback.test.ts` fails if a colour is added that
 * does not.
 */
export const AVATAR_FALLBACK_TEXT_COLOR = "#ffffff"

export const AVATAR_FALLBACK_COLORS = [
  "#b91c1c",
  "#c2410c",
  "#8a5a00",
  "#15803d",
  "#0f766e",
  "#0369a1",
  "#4f46e5",
  "#a21caf",
  "#be185d",
] as const

//a name is split into words at whitespace and at the separators a username
//uses to stand in for it, so `ana_silva` reads as two words like `Ana Silva`
const WORD_SEPARATORS = /[\s_.-]+/

const graphemes = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
})

function firstLetter(word: string): string {
  const [first] = graphemes.segment(word)
  return first?.segment ?? ""
}

/**
 * Up to two letters: the first of the first word and the first of the last.
 * One word gives one letter, nothing gives nothing.
 */
export function getInitials(name: string | null | undefined): string {
  const words = (name ?? "").split(WORD_SEPARATORS).filter(Boolean)
  const first = words[0]
  const last = words.length > 1 ? words[words.length - 1] : undefined
  if (!first) return ""

  const letters = last
    ? firstLetter(first) + firstLetter(last)
    : firstLetter(first)
  return letters.toLocaleUpperCase()
}

//FNV-1a: a few lines, no dependency, and spreads short strings evenly, which
//is all a palette of nine needs from it
function hashName(name: string): number {
  let hash = 0x811c9dc5
  for (const character of name) {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * The background for this name. Case and surrounding spaces do not change it,
 * so `Ana` and ` ana ` are one player to the eye as well.
 */
export function getAvatarColor(name: string | null | undefined): string {
  const key = (name ?? "").trim().toLocaleLowerCase()
  return AVATAR_FALLBACK_COLORS[
    hashName(key) % AVATAR_FALLBACK_COLORS.length
  ]
}
