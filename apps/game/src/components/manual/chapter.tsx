import { cn } from "@repo/nativ/utils"
import type { ReactNode } from "react"

/** A chapter as the contents name it: its anchor, its title, its number. */
export type ManualChapter = {
  id: string
  title: string
  /** "01" … "09"; a chapter outside the count (common mistakes) has none. */
  number?: string
}

/**
 * The text column, and the plate column beside it on a page that has plates
 * (the `rules-redesign` document on TUD-893, §5). The hero and every chapter
 * sit on it, so a chapter with no diagram keeps the measure of one with a
 * diagram and its empty plate column is the margin of a printed page.
 */
export const MANUAL_GRID_CLASS =
  "group-data-[plates=true]/manual:lg:grid group-data-[plates=true]/manual:lg:grid-cols-[minmax(0,62ch)_minmax(320px,1fr)] group-data-[plates=true]/manual:lg:gap-x-12"

export type ChapterProps = ManualChapter & {
  children?: ReactNode
  /** The diagrams the chapter is about, beside it on a desktop. */
  plate?: ReactNode
}

/**
 * One chapter: a hairline, its number, its title, what it says.
 *
 * No card. A chapter is where the hairline above it starts, and the space
 * around it is what tells one idea from the next.
 *
 * On a desktop the plate stays beside the text while a long chapter is read
 * (sticky inside the section). On a phone it follows the text it illustrates.
 *
 * A numbered heading lands 40px down rather than the anchor's usual 24px, so a
 * link to it (/rules#sumito) does not hide its number above the scroller.
 */
export function Chapter({
  id,
  number,
  title,
  children,
  plate,
}: ChapterProps) {
  return (
    <section
      data-chapter
      aria-labelledby={id}
      className={cn(
        //the padding under the text, not under the section, so a plate can
        //stay beside the text to the next chapter's hairline. On a desktop the
        //last chapter is a screen tall, so the rail's jump to it brings its
        //heading to the top like any other
        "border-t border-border py-10 lg:pt-16 lg:pb-0 lg:last-of-type:min-h-[calc(100dvh-8rem)]",
        MANUAL_GRID_CLASS,
      )}
    >
      <div className="min-w-0 max-w-[62ch] lg:pb-16">
        {number && (
          <div
            data-chapter-number
            aria-hidden
            className="mb-2 font-display text-sm font-semibold tabular-nums text-muted"
          >
            {number}
          </div>
        )}
        <h2
          id={id}
          className={cn(
            "font-display text-2xl leading-[1.2] font-bold text-balance text-foreground lg:text-[30px] lg:leading-[1.15]",
            number ? "scroll-mt-10" : "scroll-mt-6",
          )}
        >
          {title}
        </h2>
        {children && (
          <div className="mt-3 flex flex-col gap-y-3 text-base leading-[1.7] text-pretty text-subtle lg:text-[17px]">
            {children}
          </div>
        )}
      </div>

      {plate && (
        <div
          data-plate
          className="min-w-0 max-lg:mt-6 lg:sticky lg:top-6 lg:self-start"
        >
          {plate}
        </div>
      )}
    </section>
  )
}

export type PlateProps = {
  children: ReactNode
  className?: string
}

/** The dark surface a chapter's diagrams sit on; two of them stack inside one. */
export function Plate({ children, className }: PlateProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-y-6 rounded-2xl border border-border bg-surface p-4 lg:p-6",
        className,
      )}
    >
      {children}
    </div>
  )
}

/** A band between two chapters, for the play block in the middle of a page. */
export function ChapterBreak({ children }: { children: ReactNode }) {
  return (
    <div className="mb-10 rounded-2xl bg-surface p-5 lg:mb-16 lg:p-8">
      {children}
    </div>
  )
}
