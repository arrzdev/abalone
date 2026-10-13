import type { MouseEvent } from "react"
import type { ManualChapter } from "@/components/manual/chapter"

export type ContentsListProps = {
  /** The page's short title, which names the contents. */
  label: string
  chapters: ManualChapter[]
  onJump: (id: string) => void
}

/**
 * The chapters as a list under the hero, on a phone and a tablet (the
 * `rules-redesign` document on TUD-893, §6). One thumb-sized row each; from
 * `md` two columns, read down the first and then the second.
 */
export function ContentsList({
  label,
  chapters,
  onJump,
}: ContentsListProps) {
  return (
    <nav
      data-manual-contents
      aria-label={label}
      className="pb-10 lg:hidden"
    >
      <ol className="md:columns-2 md:gap-x-8">
        {chapters.map((chapter) => (
          <li
            key={chapter.id}
            className="break-inside-avoid border-t border-border"
          >
            <a
              href={`#${chapter.id}`}
              onClick={(event: MouseEvent) => {
                event.preventDefault()
                onJump(chapter.id)
              }}
              className="flex min-h-11 items-center gap-x-3 py-2 text-base text-foreground"
            >
              {chapter.number && (
                <span
                  aria-hidden
                  className="w-5 shrink-0 font-display text-sm font-semibold tabular-nums text-muted"
                >
                  {chapter.number}
                </span>
              )}
              <span>{chapter.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
