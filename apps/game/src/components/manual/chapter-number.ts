/**
 * A chapter title as the manual prints it: the number in its own column, the
 * words under the heading.
 *
 * The strategy tips carry their number in the copy ("1. Control the center"),
 * the rules do not. The page prints one numeral per chapter either way, so a
 * title that already has one gives it up here instead of showing it twice.
 */
export type ChapterTitle = {
  /** The number the copy starts with, or null when it has none. */
  number: number | null
  /** The title with that number and its separator taken off. */
  title: string
}

/** "1. ": the number, its full stop, the space after it, as every locale writes it. */
const LEADING_NUMBER = /^(\d+)\.\s+/

export function splitChapterNumber(title: string): ChapterTitle {
  const match = LEADING_NUMBER.exec(title)
  if (!match) return { number: null, title }
  return {
    number: Number(match[1]),
    title: title.slice(match[0].length),
  }
}

/** A chapter's numeral as the page prints it: two digits, `01` to `09`. */
export function formatChapterNumber(number: number): string {
  return String(number).padStart(2, "0")
}
