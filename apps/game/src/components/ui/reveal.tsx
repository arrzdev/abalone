import { cn } from "@repo/nativ/utils"
import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"

export type RevealProps = {
  children: ReactNode
  className?: string
}

/**
 * Fades its content up as it scrolls into view, once.
 *
 * `transform` and `opacity` only, so the whole thing runs on the compositor and
 * a section arriving cannot stutter the scroll that brought it. `motion-safe`
 * carries the reduced-motion case: with motion turned down the content is simply
 * there, which is the correct amount of animation for someone who asked for none.
 */
export function Reveal({ children, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setShown(true)
        observer.disconnect()
      },
      //a fifth of the way up the screen: enough that it has clearly arrived,
      //early enough that the fade finishes before it is being read
      { rootMargin: "0px 0px -20% 0px" },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      data-shown={shown}
      className={cn(
        "motion-safe:translate-y-4 motion-safe:opacity-0 motion-safe:transition-[opacity,transform] motion-safe:duration-500 motion-safe:ease-out",
        "motion-safe:data-[shown=true]:translate-y-0 motion-safe:data-[shown=true]:opacity-100",
        className,
      )}
    >
      {children}
    </div>
  )
}
