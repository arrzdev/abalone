import type { SetupKey } from "@repo/abalone-engine/board-setups"
import { PLAYABLE_SETUPS } from "@repo/abalone-engine/board-setups"
import { cn } from "@repo/nativ/utils"
import type { ReactNode } from "react"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons"
import { TapButton } from "@/components/ui/tap-button"
import { getSetupName } from "@/i18n/game-text"

/** Order shown in the carousel; 'custom' is intentionally excluded. */
export const SETUP_ORDER: readonly SetupKey[] = PLAYABLE_SETUPS

const NAV_CLASS =
  "flex size-11 hit-[2px] shrink-0 items-center justify-center rounded-[10px] text-muted transition " +
  "hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"

export type SetupCarouselProps = {
  setupType: SetupKey
  onChange: (setupType: SetupKey) => void
  /**
   * A board to show under the name, for the screens that have no board of
   * their own. It takes the dots' place: with a picture of the position there,
   * the row of eight dots is a second way of saying where you are in the list.
   */
  preview?: ReactNode
}

/**
 * Setup picker. On the game screen there is no thumbnail — stepping through the
 * setups repaints the full-size board next to it, which is the real preview. In
 * an overlay there is no board to repaint, so one comes with it.
 */
export function SetupCarousel({
  setupType,
  onChange,
  preview,
}: SetupCarouselProps) {
  const { t } = useTranslation()
  const index = Math.max(0, SETUP_ORDER.indexOf(setupType))

  const step = useCallback(
    (delta: number) => {
      const next =
        (index + delta + SETUP_ORDER.length) % SETUP_ORDER.length
      onChange(SETUP_ORDER[next])
    },
    [index, onChange],
  )

  return (
    <div
      className={cn(preview && "overflow-hidden rounded-xl bg-surface-2")}
    >
      {/* An arrow is a direction and nothing else, so both of these say where
          they go under the pointer as well as to a screen reader. */}
      <div
        className={cn(
          "flex items-center gap-1 p-1",
          !preview && "rounded-xl bg-surface-2",
        )}
      >
        <TapButton
          className={NAV_CLASS}
          aria-label={t("game:controls.prev_setup")}
          title={t("game:controls.prev_setup")}
          onClick={() => step(-1)}
        >
          <ChevronLeftIcon size={20} />
        </TapButton>

        <span className="flex-1 truncate text-center font-display text-base font-semibold text-white">
          {getSetupName(setupType)}
        </span>

        <TapButton
          className={NAV_CLASS}
          aria-label={t("game:controls.next_setup")}
          title={t("game:controls.next_setup")}
          onClick={() => step(1)}
        >
          <ChevronRightIcon size={20} />
        </TapButton>
      </div>

      {/* Flex and a fixed height, because the board sizes itself from the box
          it is given: it stretches to this one and scales to fit.

          On the dialog shape only. A phone sheet has the height of the screen
          and no more, and with the board in it the sheet's own button falls
          below the fold; the name on the row above says which opening it is,
          as it does in the pregame panel. */}
      {preview && (
        <div className="hidden h-32 items-center justify-center border-t border-border-subtle bg-well p-2 lg:flex">
          {preview}
        </div>
      )}

      {/* Where you are in the list, and nothing to press. A dot you can tap
          needs a 44px box, and nine of those are wider than a phone; the arrows
          above are thumb-sized and get anywhere in four steps. The name on the
          row is what a screen reader hears, so the dots are hidden from it. */}
      {!preview && (
        <div aria-hidden="true" className="mt-1 flex justify-center">
          {SETUP_ORDER.map((key, i) => (
            <span key={key} className="flex h-5 items-center px-1">
              <span
                className={
                  i === index
                    ? "h-1.5 w-4 rounded-full bg-brand transition"
                    : "h-1.5 w-1.5 rounded-full bg-white/20 transition"
                }
              />
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
