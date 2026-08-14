import { cn } from "@repo/nativ/utils"
import { useEffect, useRef } from "react"
import type { Player } from "@/engine/types"
import { renderMarble } from "@/render/marble-renderer"

/** The two fills the board renderers understand. */
const MARBLE_FILL: Record<Player, string> = {
  black: "#333",
  white: "#fff",
}

export type MarbleGlyphProps = {
  color: Player
  design?: string
  size?: number
  className?: string
  title?: string
}

/**
 * One marble, drawn by the very same renderer the board uses, at a size that
 * suits running text. Wherever the UI has to say *which* marble something
 * happened to — a capture in the move list, the pieces taken on a player card —
 * it shows the design the player actually chose.
 *
 * The marble is drawn out to the edge of its box. Anything inset — a CSS ring
 * around a smaller marble, say — reads as a hole with a ball floating in it once
 * the glyph is only a dozen pixels across; the renderer's own outline is what
 * keeps a #333 marble off a #333 panel.
 */
export function MarbleGlyph({
  color,
  design = "default",
  size = 12,
  className,
  title,
}: MarbleGlyphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let active = true

    const paint = () => {
      const canvas = canvasRef.current
      if (!canvas || !active) return

      // Oversampled well past the device ratio: these are a dozen pixels across
      // and never repaint on their own, so page zoom must not turn them to mush.
      const scale = Math.max(4, (window.devicePixelRatio || 1) * 2)
      canvas.width = Math.round(size * scale)
      canvas.height = Math.round(size * scale)

      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      ctx.clearRect(0, 0, size, size)

      // Outlines are stroked centred on the radius, so half a line width of
      // inset puts the outer edge of the stroke exactly on the box edge.
      const lineWidth = Math.max(1, size / 14)
      renderMarble(
        design,
        ctx,
        size / 2,
        size / 2,
        size / 2 - lineWidth / 2,
        MARBLE_FILL[color] ?? MARBLE_FILL.black,
        false,
        false,
        lineWidth,
      )
    }

    paint()

    return () => {
      active = false
    }
  }, [color, design, size])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : "true"}
      title={title}
      className={cn("shrink-0 rounded-full", className)}
    />
  )
}
