import { Screen, ScrollView } from "@repo/nativ/components"
import { cn } from "@repo/nativ/utils"
import type { ReactNode } from "react"
import { useRef } from "react"
import type { ManualChapter } from "@/components/manual/chapter"
import { MANUAL_GRID_CLASS } from "@/components/manual/chapter"
import { ChapterRail } from "@/components/manual/chapter-rail"
import { ContentsList } from "@/components/manual/contents-list"
import { useActiveChapter } from "@/hooks/use-active-chapter"

export type ManualPageProps = {
  /** The page's short title, which names the rail and the contents list. */
  title: string
  hero: ReactNode
  chapters: ManualChapter[]
  /** Whether the chapters carry diagrams, which earns them a plate column. */
  plates?: boolean
  children: ReactNode
}

/**
 * A page laid out as a printed game manual (the `rules-redesign` document on
 * TUD-893): numbered chapters with no card around them, the contents as a rail
 * beside them on a desktop and as a list under the hero on a phone.
 *
 * Takes the place of `Page` and `PageTitle` on the rules and the strategy. It
 * owns the scroller, because the rail reads which chapter is being read from it.
 */
export function ManualPage({
  title,
  hero,
  chapters,
  plates = false,
  children,
}: ManualPageProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { activeId, jumpTo } = useActiveChapter(
    scrollRef,
    chapters.map((chapter) => chapter.id),
  )

  return (
    <Screen>
      <ScrollView
        ref={scrollRef}
        className="px-safe"
        directionalLockEnabled
      >
        <div
          data-plates={plates}
          className="group/manual mx-auto flex w-full max-w-[960px] px-5 pt-6 pb-safe-offset-10 data-[plates=true]:max-w-[1200px] md:px-8 lg:gap-x-12 lg:px-12 lg:pt-12"
        >
          <aside className="hidden w-[200px] shrink-0 lg:block">
            <ChapterRail
              label={title}
              chapters={chapters}
              activeId={activeId}
              onJump={jumpTo}
            />
          </aside>

          <div className="min-w-0 flex-1">
            {hero}
            <ContentsList
              label={title}
              chapters={chapters}
              onJump={jumpTo}
            />
            {children}
          </div>
        </div>
      </ScrollView>
    </Screen>
  )
}

export type ManualHeroProps = {
  heading: ReactNode
  intro: ReactNode
  /** The way to the board under the intro. */
  actions: ReactNode
  /** An image of the game: beside the heading on a desktop, under the actions on a phone. */
  plate?: ReactNode
  /** Where the plate shows; a board too small to read on a phone stays off it. */
  plateClassName?: string
}

/** The page's one `<h1>`, what the page is for, and the way to the board. */
export function ManualHero({
  heading,
  intro,
  actions,
  plate,
  plateClassName,
}: ManualHeroProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-y-8 pb-10 lg:pb-16",
        MANUAL_GRID_CLASS,
      )}
    >
      <div className="flex min-w-0 max-w-[62ch] flex-col gap-y-6">
        <div className="flex flex-col gap-y-3">
          <h1 className="font-display text-[clamp(1.875rem,1.25rem+3vw,2.5rem)] leading-[1.1] font-extrabold tracking-tight text-balance text-foreground lg:text-[clamp(2.5rem,1rem+2.4vw,3.5rem)]">
            {heading}
          </h1>
          <p className="max-w-[60ch] text-[17px] leading-[1.6] text-pretty text-subtle lg:text-lg">
            {intro}
          </p>
        </div>
        {actions}
      </div>

      {plate && (
        <div className={cn("min-w-0 lg:self-start", plateClassName)}>
          {plate}
        </div>
      )}
    </div>
  )
}
