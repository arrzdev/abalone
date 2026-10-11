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
}

/**
 * One step of the first-game guide, in the panel beside or under the board.
 *
 * A labelled region rather than a dialog: no backdrop and no focus trap, and it
 * never covers the board, because the presses it teaches have to reach the
 * board. Each step fades up as it arrives (`motion-safe`, so not at all for
 * someone who asked for less motion).
 */
export function FirstGameGuide({
  step,
  onNext,
  onSkip,
}: FirstGameGuideProps) {
  const { t } = useTranslation()
  const isLast = guideStepNumber(step) === GUIDE_STEP_COUNT

  return (
    <section
      aria-label={t("game:guide.title")}
      className="mx-3 mt-2 rounded-xl bg-surface-2 p-3 ring-1 ring-border"
    >
      <div key={step} className="motion-safe:animate-guide-in">
        <p className="text-xs font-semibold text-brand">
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
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onSkip}>
          {t("game:guide.skip")}
        </Button>
        <Button variant="primary" size="sm" onClick={onNext}>
          {isLast ? t("game:guide.done") : t("game:guide.next")}
        </Button>
      </div>
    </section>
  )
}
