import { Screen, ScrollView } from "@repo/nativ/components"
import { cn } from "@repo/nativ/utils"
import type { ReactNode } from "react"

/**
 * One column, one width, one rhythm. Every screen inside the shell uses it, so
 * the title of one page lands where the title of the last one did.
 */
const PAGE_COLUMN_CLASS =
  "mx-auto flex w-full max-w-2xl flex-col gap-y-6 px-4 pt-6 pb-10"

export type PageProps = {
  children: ReactNode
  /** Extra classes for the column, not the scroller. */
  className?: string
}

/**
 * A scrolling page inside the app shell.
 *
 * The scroller is full-bleed and the column inside it is what has the margins,
 * so a page can still run something to the edge of the screen when it wants to.
 *
 * No `edgeFades`: the band they paint is a solid colour, and the shell's
 * background is a gradient — the fade would cut two flat strips across it.
 */
export function Page({ children, className }: PageProps) {
  return (
    <Screen>
      <ScrollView className="px-safe" directionalLockEnabled>
        <div className={cn(PAGE_COLUMN_CLASS, className)}>{children}</div>
      </ScrollView>
    </Screen>
  )
}

export type PageTitleProps = {
  children: ReactNode
  /** A line under the title, for what the screen is for. */
  description?: ReactNode
}

/** The one large heading a page opens with. */
export function PageTitle({ children, description }: PageTitleProps) {
  return (
    <header className="flex flex-col gap-y-1.5">
      {/* Above `lg` only. Every page that uses this sits under a
          `SubpageHeader` on a phone, which already carries the title — a second
          copy of it at four times the size is the first screenful spent saying
          what the bar above it just said. The line under it stays: that one
          says what the screen is for, which the bar has no room for. */}
      <h1 className="min-w-0 text-4xl font-extrabold tracking-tight text-white max-lg:hidden">
        {children}
      </h1>
      {description && (
        <p className="text-sm leading-relaxed text-white/50">
          {description}
        </p>
      )}
    </header>
  )
}

export type CardProps = {
  children: ReactNode
  className?: string
}

/** The surface a section's content sits on. */
export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl bg-surface-2 p-5 shadow-xl shadow-black/20",
        className,
      )}
    >
      {children}
    </div>
  )
}
