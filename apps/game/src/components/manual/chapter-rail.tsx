import type { MouseEvent } from "react"
import { useLayoutEffect, useRef, useState } from "react"
import type { ManualChapter } from "@/components/manual/chapter"

export type ChapterRailProps = {
  /** The page's short title, which names the contents. */
  label: string
  chapters: ManualChapter[]
  /** The chapter being read, marked on the rail. */
  activeId: string
  onJump: (id: string) => void
}

type Bar = { top: number; height: number }

/**
 * The contents beside the chapters on a desktop (the `rules-redesign`
 * document on TUD-893, §5), sticky so it is there from the first chapter to
 * the last. The chapter being read is white with a brand bar beside it; the
 * bar is one element that glides to the next row rather than a bar per row
 * blinking on and off.
 */
export function ChapterRail({
  label,
  chapters,
  activeId,
  onJump,
}: ChapterRailProps) {
  const listRef = useRef<HTMLOListElement>(null)
  const [bar, setBar] = useState<Bar>({ top: 0, height: 0 })

  // Measured, not computed: a long title in another language takes two rows.
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const measure = () => {
      const link = list.querySelector<HTMLElement>(
        `[data-chapter="${activeId}"]`,
      )
      if (!link) return
      setBar({ top: link.offsetTop, height: link.offsetHeight })
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [activeId])

  return (
    <nav aria-label={label} className="sticky top-6">
      <ol ref={listRef} className="relative flex flex-col">
        <span
          aria-hidden
          className="absolute top-0 left-0 w-0.5 rounded-full bg-brand ease-out motion-safe:transition-transform motion-safe:duration-200"
          style={{
            height: bar.height,
            transform: `translateY(${bar.top}px)`,
          }}
        />
        {chapters.map((chapter) => (
          <li key={chapter.id}>
            <a
              href={`#${chapter.id}`}
              data-chapter={chapter.id}
              data-active={chapter.id === activeId}
              aria-current={
                chapter.id === activeId ? "location" : undefined
              }
              onClick={(event: MouseEvent) => {
                event.preventDefault()
                onJump(chapter.id)
              }}
              className="flex min-h-9 items-baseline gap-x-3 py-2 pl-4 text-[15px] leading-[1.4] text-balance text-muted transition-colors hover:text-subtle data-[active=true]:text-foreground"
            >
              {chapter.number && (
                <span
                  aria-hidden
                  className="font-display text-sm font-semibold tabular-nums"
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
