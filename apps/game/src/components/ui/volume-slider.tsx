import { cn } from "@repo/nativ/utils"
import type { CSSProperties } from "react"
import { useId } from "react"
import { VolumeOffIcon, VolumeUpIcon } from "@/components/icons"
import { TapButton } from "@/components/ui/tap-button"
import { playMoveSound } from "@/utils/sound"

/** The keys a range responds to, which is what a preview should follow. */
const MOVES_IT = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
])

export type VolumeSliderProps = {
  label: string
  description?: string
  muteLabel: string
  volume: number
  muted: boolean
  onVolumeChange: (volume: number) => void
  onMutedChange: (muted: boolean) => void
}

/**
 * Volume, with a mute button beside it.
 *
 * The two are one control between them: mute is for silencing the board without
 * losing the level you had set, so the slider keeps its position while muted and
 * only goes dim — and reaching for it is taken as wanting the sound back, which
 * is what the button would have been the long way round to say.
 *
 * Letting go of the slider plays a marble, because a volume you can only hear by
 * making a move is a volume you have to guess at.
 */
export function VolumeSlider({
  label,
  description,
  muteLabel,
  volume,
  muted,
  onVolumeChange,
  onMutedChange,
}: VolumeSliderProps) {
  const id = useId()

  return (
    <div className="space-y-3">
      <label htmlFor={id} className="block cursor-pointer select-none">
        <span className="block text-sm font-medium text-white">
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-xs text-muted">
            {description}
          </span>
        )}
      </label>

      <div className="flex items-center gap-3">
        <TapButton
          onClick={() => onMutedChange(!muted)}
          aria-pressed={muted}
          aria-label={muteLabel}
          title={muteLabel}
          className={cn(
            "shrink-0 rounded-lg p-1.5 transition focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2",
            muted
              ? "bg-elevated-2 text-white"
              : "bg-surface-4 text-subtle hover:text-white",
          )}
        >
          {muted ? (
            <VolumeOffIcon size={18} />
          ) : (
            <VolumeUpIcon size={18} />
          )}
        </TapButton>

        <input
          id={id}
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(event) => onVolumeChange(Number(event.target.value))}
          // On release rather than on every step: dragging across the range
          // fires a change per pixel, and a marble per pixel is a rattle. From
          // the keyboard, only off the keys that actually move it — tabbing in
          // releases a key over this too, and arriving somewhere is not a change.
          onPointerUp={() => playMoveSound(1)}
          onKeyUp={(event) => {
            if (MOVES_IT.has(event.key)) playMoveSound(1)
          }}
          aria-label={label}
          // Where the track changes colour. The gradient that reads it lives in
          // the stylesheet — see `.volume-range`.
          style={{ "--fill": `${volume * 100}%` } as CSSProperties}
          className={cn(
            "volume-range w-full cursor-pointer transition-opacity",
            muted && "opacity-40",
          )}
        />
      </div>
    </div>
  )
}
