/**
 * A chapter title as the manual prints it: the number in its own column, the
 * words under the heading.
 *
 * The strategy tips carry their number in the copy ("1. Control the center"),
 * the rules do not. The page prints one numeral per chapter either way, so a
 * title that already has one gives it up here instead of showing it twice.
 *
 * Stub (TUD-910): the tests in `chapter-number.test.ts` describe it.
 */
export type ChapterTitle = {
  /** The number the copy starts with, or null when it has none. */
  number: number | null
  /** The title with that number and its separator taken off. */
  title: string
}

export function splitChapterNumber(title: string): ChapterTitle {
  return { number: null, title }
}

/** A chapter's numeral as the page prints it: two digits, `01` to `09`. */
export function formatChapterNumber(_number: number): string {
  return ""
}
