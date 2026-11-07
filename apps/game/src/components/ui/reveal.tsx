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
 * Shown by default, so the server-rendered page paints it before any script has
 * loaded: content on the first screen never waits for hydration. Only once
 * React runs, and only if the element is still below the fold, is it hidden
 * (instantly, off screen) to fade in when it scrolls up.
 *
 * `transform` and `opacity` only, so the whole thing runs on the compositor and
 * a section arriving cannot stutter the scroll that brought it. `motion-safe`
 * carries the reduced-motion case: with motion turned down the content is simply
 * there, which is the correct amount of animation for someone who asked for none.
 */
export function Reveal({ children, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(true)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    //already painted on the first screen: hiding it now would flash it out
    if (element.getBoundingClientRect().top < window.innerHeight) return

    setShown(false)
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
        //the transition only on the way in, so hiding below the fold is instant
        "motion-safe:data-[shown=false]:translate-y-4 motion-safe:data-[shown=false]:opacity-0",
        "motion-safe:data-[shown=true]:transition-[opacity,transform] motion-safe:data-[shown=true]:duration-500 motion-safe:data-[shown=true]:ease-out",
        className,
      )}
    >
      {children}
    </div>
  )
}
