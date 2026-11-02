import { createFileRoute, Link } from "@tanstack/react-router"
import { Trans, useTranslation } from "react-i18next"
import type { ManualChapter } from "@/components/manual/chapter"
import { Chapter } from "@/components/manual/chapter"
import { FaqList } from "@/components/manual/faq-list"
import { ManualHero, ManualPage } from "@/components/manual/manual-page"
import { RelatedGuides } from "@/components/manual/related-guides"
import { PlayBlock } from "@/components/play-block"
import { SubpageHeader } from "@/components/ui/subpage-header"
import { COMPUTER_GAME } from "@/hooks/use-play-actions"
import { routeLanguage } from "@/routing/route-language"
import { seoPageHead } from "@/routing/seo-pages"

export const Route = createFileRoute("/_subpage/how-to-play")({
  head: ({ match }) =>
    seoPageHead("/how-to-play", routeLanguage(match.context)),
  component: HowToPlayPage,
})

/**
 * How to play, for somebody who has never played: the rules in five steps, a
 * first game against the computer, and a few beginner questions. Built like the
 * other guides, with link targets for each step (/how-to-play#push) that the
 * HowTo markup points at (`structured-data.ts`).
 */

/** The rule steps, in the order the HowTo markup lists them. */
const RULE_STEPS = ["setup", "move", "kinds", "push", "win"] as const

const GAME_STEPS = ["open", "pick", "direction", "stuck", "push"] as const

const FAQ_ITEMS = ["start", "first_move", "win", "free"] as const

const TEXT_LINK_CLASS =
  "font-semibold text-brand-light underline underline-offset-2 hover:text-white"

const STEP_LIST_CLASS =
  "flex list-decimal flex-col gap-y-3 pl-6 marker:font-semibold marker:text-faint"

function HowToPlayPage() {
  const { t } = useTranslation()

  const chapters: ManualChapter[] = [
    { id: "rules-in-five-steps", title: t("game:howto.steps.title") },
    { id: "first-game", title: t("game:howto.first_game.title") },
    { id: "faq", title: t("game:howto.faq.title") },
    { id: "play", title: t("game:howto.try.title") },
  ]

  const playBlock = (
    <PlayBlock
      cta={t("game:howto.play.cta")}
      more={t("game:howto.play.more")}
    />
  )

  return (
    <>
      {/* The page's own heading is on a phone too, so the bar's title is a
          label: one `<h1>` on the page. */}
      <SubpageHeader title={t("game:howto.title")} titleAs="p" />

      <ManualPage
        title={t("game:howto.title")}
        chapters={chapters}
        hero={
          <ManualHero
            heading={t("game:howto.heading")}
            intro={
              <Trans
                i18nKey="game:howto.intro"
                components={{
                  offline: (
                    <Link {...COMPUTER_GAME} className={TEXT_LINK_CLASS} />
                  ),
                  rules: <Link to="/rules" className={TEXT_LINK_CLASS} />,
                }}
              />
            }
            actions={playBlock}
          />
        }
      >
        <Chapter {...chapters[0]}>
          <ol className={STEP_LIST_CLASS}>
            {RULE_STEPS.map((step) => (
              <li key={step} id={step} className="scroll-mt-6 pl-1">
                <strong className="font-semibold text-white">
                  {t(`game:howto.steps.${step}.title`)}.
                </strong>{" "}
                {t(`game:howto.steps.${step}.body`)}
              </li>
            ))}
          </ol>
        </Chapter>

        <Chapter {...chapters[1]}>
          <p>{t("game:howto.first_game.intro")}</p>
          <ol className={STEP_LIST_CLASS}>
            {GAME_STEPS.map((step) => (
              <li key={step} className="pl-1">
                <strong className="font-semibold text-white">
                  {t(`game:howto.first_game.steps.${step}.title`)}.
                </strong>{" "}
                {t(`game:howto.first_game.steps.${step}.body`)}
              </li>
            ))}
          </ol>
        </Chapter>

        <Chapter {...chapters[2]}>
          <FaqList
            items={FAQ_ITEMS.map((item) => ({
              id: item,
              question: t(`game:howto.faq.items.${item}.question`),
              answer: t(`game:howto.faq.items.${item}.answer`),
            }))}
          />
        </Chapter>

        <Chapter {...chapters[3]}>
          {playBlock}
          <p>
            <Trans
              i18nKey="game:howto.try.more_reading"
              components={{
                openings: (
                  <Link to="/opening-moves" className={TEXT_LINK_CLASS} />
                ),
                strategy: (
                  <Link to="/strategy" className={TEXT_LINK_CLASS} />
                ),
              }}
            />
          </p>
        </Chapter>

        <RelatedGuides current="/how-to-play" />
      </ManualPage>
    </>
  )
}
