import { cn } from "@repo/nativ/utils"
import type { ReactNode } from "react"

export type ReservedProps = {
  className?: string
  children: ReactNode
}

/**
 * Every variant in one grid cell: as tall as the tallest of them, whichever one
 * is showing.
 *
 * The alternative is a height per block, and that height is a different number
 * in every language — "Sign in to play online" is one line and its German is
 * two, and the same is true of every message a status line can say. A stack
 * measures itself, at whatever width and in whatever language it is handed.
 *
 * The variants that are not showing stay in the cell `invisible`, so they hold
 * their height without being read or reached.
 */
export function Reserved({ className, children }: ReservedProps) {
  return (
    <div className={cn("grid *:col-start-1 *:row-start-1", className)}>
      {children}
    </div>
  )
}
