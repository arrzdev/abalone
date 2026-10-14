import { cn } from "@repo/nativ/utils"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import type { GuideStep } from "@/utils/first-game-guide"
import {
  GUIDE_STEP_COUNT,
  guideStepNumber,
} from "@/utils/first-game-guide"

export type FirstGameGuideProps = {
  step: GuideStep
  onNext: () => void
  onSkip: () => void
  /**
   * `card` is the full card under the scoreboard beside the board. `bar` is
   * the phone's: one row in the move history's slot, so the board keeps its
   * size while the guide is open.
   */
  layout?: "card" | "bar"
  className?: string
}

/**
 * One step of the first-game guide, in the panel beside or under the board.
 *
 * A labelled region rather than a dialog: no backdrop and no focus trap, and it
 * never covers the board, because the presses it teaches have to reach the
 * board. Each step fades up as it arrives (`motion-safe`, so not at all for
 * someone who asked for less motion).
 *
 * On steps 1 and 2 the board is the action, so nothing here looks like one:
 * Next is a text button like Skip. Got it, on the last step, is the one fill.
 */
export function FirstGameGuide({
  step,
  onNext,
  onSkip,
  layout = "card",
  className,
}: FirstGameGuideProps) {
  const { t } = useTranslation()
  const isLast = guideStepNumber(step) === GUIDE_STEP_COUNT

  const actions = (
    <>
      <Button variant="ghost" size="sm" onClick={onSkip}>
        {t("game:guide.skip")}
      </Button>
      <Button
        variant={isLast ? "primary" : "ghost"}
        size="sm"
        onClick={onNext}
      >
        {isLast ? t("game:guide.done") : t("game:guide.next")}
      </Button>
    </>
  )

  if (layout === "bar") {
    return (
      // The slot it stands in is the size container: the body line shows only
      // when the slot already has the height for it, and never makes it taller.
      // A slot that tall reads from the top, like the move list it stands in for.
      <section
        aria-label={t("game:guide.title")}
        className={cn(
          "flex min-w-0 flex-1 flex-col justify-center rounded-xl bg-surface-2 py-1 ps-3 pe-1",
          "[@container(min-height:7.75rem)]:justify-start [@container(min-height:7.75rem)]:pt-2",
          className,
        )}
      >
        <div
          key={step}
          className="flex items-center gap-1 motion-safe:animate-guide-in"
        >
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-xs font-semibold text-brand-light">
              {t("game:guide.step", {
                current: guideStepNumber(step),
                total: GUIDE_STEP_COUNT,
              })}
            </p>
            <h2 className="truncate font-display text-sm font-semibold text-white">
              {t(`game:guide.${step}_title`)}
            </h2>
          </div>
          {actions}
        </div>
        <p className="mt-1 hidden pe-2 text-sm text-subtle [@container(min-height:7.75rem)]:line-clamp-3">
          {t(`game:guide.${step}_body`)}
        </p>
      </section>
    )
  }

  return (
    <section
      aria-label={t("game:guide.title")}
      className={cn("mx-4 mt-2 rounded-xl bg-surface-2 p-3", className)}
    >
      <div key={step} className="motion-safe:animate-guide-in">
        <p className="text-xs font-semibold text-brand-light">
          {t("game:guide.step", {
            current: guideStepNumber(step),
            total: GUIDE_STEP_COUNT,
          })}
        </p>
        <h2 className="mt-1 font-display text-base font-semibold text-white">
          {t(`game:guide.${step}_title`)}
        </h2>
        <p className="mt-1 text-sm text-subtle">
          {t(`game:guide.${step}_body`)}
        </p>
      </div>
      <div className="mt-3 flex justify-end gap-2">{actions}</div>
    </section>
  )
}
