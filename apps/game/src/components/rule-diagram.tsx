import { cn } from "@repo/nativ/utils"
import { useCallback, useLayoutEffect, useRef } from "react"
import type { Diagram } from "@/render/draw-diagram"
import { diagramAspect, drawDiagram } from "@/render/draw-diagram"

/**
 * One rules illustration: a canvas that redraws itself to whatever width the
 * column gives it. The diagrams are read on a phone as often as on a desktop, so
 * they are laid out from the box rather than baked at a fixed size.
 *
 * The height comes from the diagram, not from the page — a row of six spaces and
 * a flower of seven want very different boxes, and picking a ratio by hand for
 * each one only ever leaves a band of empty space beside it.
 *
 * `label` is the whole accessible content — a canvas has none of its own, and a
 * player using a screen reader needs the position in words, not a caption that
 * says "diagram".
 */

/** Past this a diagram stops growing with the column and simply centres. */
const MAX_HEIGHT = 260

export type RuleDiagramProps = {
  diagram: Diagram
  marbleDesign?: string
  label: string
  className?: string
}

export function RuleDiagram({
  diagram,
  marbleDesign = "default",
  label,
  className,
}: RuleDiagramProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lastWidthRef = useRef(0)

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const wrapper = wrapperRef.current
    if (!canvas || !wrapper) return

    const width = wrapper.clientWidth
    if (width <= 0) return
    const height = Math.round(
      Math.min(width / diagramAspect(diagram), MAX_HEIGHT),
    )
    lastWidthRef.current = width

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingQuality = "high"

    drawDiagram(ctx, { width, height, marbleDesign, ...diagram })
  }, [diagram, marbleDesign])

  useLayoutEffect(() => {
    paint()
    const wrapper = wrapperRef.current
    if (!wrapper || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", paint)
      return () => window.removeEventListener("resize", paint)
    }
    // The canvas sets its own height, which resizes this box in turn. Only a
    // change in width is news; reacting to the height it just caused would have
    // the observer chasing its own tail.
    const observer = new ResizeObserver(() => {
      if (wrapperRef.current?.clientWidth !== lastWidthRef.current) paint()
    })
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [paint])

  return (
    <div
      ref={wrapperRef}
      className={cn("flex w-full justify-center", className)}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className="block"
      />
    </div>
  )
}
