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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const aspect = diagramAspect(diagram)

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // The box is the stylesheet's; this only fills it with pixels.
    const { width, height } = canvas.getBoundingClientRect()
    if (width <= 0 || height <= 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingQuality = "high"

    drawDiagram(ctx, { width, height, marbleDesign, ...diagram })
  }, [diagram, marbleDesign])

  useLayoutEffect(() => {
    paint()
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", paint)
      return () => window.removeEventListener("resize", paint)
    }
    // Painting sets only the backing store, never the box, so the observer
    // hears about the column and nothing else.
    const observer = new ResizeObserver(paint)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [paint])

  // The box is sized here, in the server markup, not by the first paint: a link
  // to a chapter (/rules#sumito) is followed before the page hydrates, and a
  // diagram that grew afterwards would push the chapter down (TUD-933).
  return (
    <div className={cn("flex w-full justify-center", className)}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className="block"
        style={{
          width: `min(100%, ${MAX_HEIGHT * aspect}px)`,
          aspectRatio: aspect,
        }}
      />
    </div>
  )
}
