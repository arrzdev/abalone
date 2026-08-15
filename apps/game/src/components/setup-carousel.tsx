import type { SetupKey } from "@repo/abalone-engine/board-setups"
import { PLAYABLE_SETUPS } from "@repo/abalone-engine/board-setups"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons"
import { TapButton } from "@/components/ui/tap-button"
import { getSetupName } from "@/i18n/game-text"

/** Order shown in the carousel; 'custom' is intentionally excluded. */
export const SETUP_ORDER: readonly SetupKey[] = PLAYABLE_SETUPS

const NAV_CLASS =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/60 transition " +
  "hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"

export type SetupCarouselProps = {
  setupType: SetupKey
  onChange: (setupType: SetupKey) => void
}

/**
 * Setup picker. There is no thumbnail — stepping through the setups repaints
 * the full-size board next to it, which is the real preview.
 */
export function SetupCarousel({
  setupType,
  onChange,
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
    <div>
      {/* An arrow is a direction and nothing else, so both of these say where
          they go under the pointer as well as to a screen reader — and the dots
          below name the setup they jump to, which the row itself only shows one
          of at a time. */}
      <div className="flex items-center gap-1 rounded-xl bg-surface-4 p-1">
        <TapButton
          className={NAV_CLASS}
          aria-label={t("game:controls.prev_setup")}
          title={t("game:controls.prev_setup")}
          onClick={() => step(-1)}
        >
          <ChevronLeftIcon size={20} />
        </TapButton>

        <span className="flex-1 truncate text-center font-semibold text-white">
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

      {/* Dots are 6px tall but sit in a 20px tall button so they stay tappable. */}
      <div className="mt-1 flex justify-center">
        {SETUP_ORDER.map((key, i) => (
          <TapButton
            key={key}
            aria-label={getSetupName(key)}
            title={getSetupName(key)}
            aria-current={i === index}
            onClick={() => onChange(key)}
            className="group flex h-5 items-center px-1 focus-visible:outline-none"
          >
            <span
              className={
                i === index
                  ? "h-1.5 w-4 rounded-full bg-brand transition group-focus-visible:ring-2 group-focus-visible:ring-brand"
                  : "h-1.5 w-1.5 rounded-full bg-white/20 transition group-hover:bg-white/40 group-focus-visible:ring-2 group-focus-visible:ring-brand"
              }
            />
          </TapButton>
        ))}
      </div>
    </div>
  )
}
