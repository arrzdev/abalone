import { createFileRoute, Link } from "@tanstack/react-router"
import { Trans, useTranslation } from "react-i18next"
import type { ManualChapter } from "@/components/manual/chapter"
import { Chapter } from "@/components/manual/chapter"
import {
  formatChapterNumber,
  splitChapterNumber,
} from "@/components/manual/chapter-number"
import { FaqList } from "@/components/manual/faq-list"
import { ManualHero, ManualPage } from "@/components/manual/manual-page"
import { PlayBlock } from "@/components/play-block"
import { SubpageHeader } from "@/components/ui/subpage-header"
import { COMPUTER_GAME } from "@/hooks/use-play-actions"
import { seoPageHead } from "@/routing/seo-pages"

export const Route = createFileRoute("/_subpage/strategy")({
  head: () => seoPageHead("/strategy"),
  component: StrategyPage,
})

/**
 * Seven habits that win games, as text (the `strategy-page-final` document on
 * TUD-632).
 *
 * Built like the rules, as a manual: each heading a link target
 * (/strategy#tempo). The rules say what a move is; this page says which one to
 * make, and it ends where the habits get practised, at a board.
 */

/** The tips in reading order: anchor, then copy key. */
const TIPS = [
  ["center", "center"],
  ["groups-of-three", "groups_of_three"],
  ["edge", "edge"],
  ["count", "count"],
  ["opening", "opening"],
  ["attack-as-a-group", "attack_as_a_group"],
  ["tempo", "tempo"],
] as const

const MISTAKES = ["lone_edge", "split_three", "leave_hole"] as const

/** The bots from weakest to strongest; each band maps to `ai/profiles.ts`. */
const BOT_BANDS = ["low", "middle", "high"] as const

const FAQ_ITEMS = ["solved", "first_move", "levels"] as const

const STRONG = <strong className="font-semibold text-white" />

const TEXT_LINK_CLASS =
  "font-semibold text-brand-light underline underline-offset-2 hover:text-white"

function StrategyPage() {
  const { t } = useTranslation()

  const chapters: ManualChapter[] = [
    ...TIPS.map(([id, key]) => {
      const { number, title } = splitChapterNumber(
        t(`game:strategy.tips.${key}.title`),
      )
      return {
        id,
        title,
        number: number === null ? undefined : formatChapterNumber(number),
      }
    }),
    { id: "mistakes", title: t("game:strategy.mistakes.title") },
    { id: "computer", title: t("game:strategy.computer.title") },
    { id: "faq", title: t("game:strategy.faq.title") },
    { id: "practise", title: t("game:strategy.practise.title") },
  ]

  const playBlock = (
    <PlayBlock
      cta={t("game:strategy.play.cta")}
      more={t("game:strategy.play.more")}
    />
  )

  return (
    <>
      {/* The page's own heading is on a phone too, so the bar's title is a
          label: one `<h1>` on the page. */}
      <SubpageHeader title={t("game:strategy.title")} titleAs="p" />

      {/* No plates: the tips are habits, not positions. The titles carry their
          own number ("1. Control the center"); it moves to the numeral column,
          printed once, like the rules (TUD-910, open point 1). */}
      <ManualPage
        title={t("game:strategy.title")}
        chapters={chapters}
        hero={
          <ManualHero
            heading={t("game:strategy.heading")}
            intro={
              <Trans
                i18nKey="game:strategy.intro"
                components={{
                  offline: (
                    <Link {...COMPUTER_GAME} className={TEXT_LINK_CLASS} />
                  ),
                  rules: <Link to="/rules" className={TEXT_LINK_CLASS} />,
                }}
              />
            }
            //a way to the board under the intro and in "Practise"; none
            //between the tips, where it broke up the reading
            actions={playBlock}
          />
        }
      >
        {TIPS.map(([id, key], index) => (
          <Chapter key={id} {...chapters[index]}>
            <p>
              <Trans
                i18nKey={`game:strategy.tips.${key}.body`}
                components={{
                  strong: STRONG,
                  openings: (
                    <Link
                      to="/opening-moves"
                      className={TEXT_LINK_CLASS}
                    />
                  ),
                }}
              />
            </p>
          </Chapter>
        ))}

        <Chapter id="mistakes" title={t("game:strategy.mistakes.title")}>
          <ul className="flex list-disc flex-col gap-y-1.5 pl-5 marker:text-faint">
            {MISTAKES.map((item) => (
              <li key={item}>
                {t(`game:strategy.mistakes.items.${item}`)}
              </li>
            ))}
          </ul>
        </Chapter>

        {/* Who the tips are tried against. Every claim about a bot maps to a
            trait in `ai/profiles.ts`; change one and this copy is the other
            place to change. */}
        <Chapter id="computer" title={t("game:strategy.computer.title")}>
          <p>{t("game:strategy.computer.intro")}</p>
          <ul className="mt-2 flex list-disc flex-col gap-y-1.5 pl-5 marker:text-faint">
            {BOT_BANDS.map((band) => (
              <li key={band}>
                <Trans
                  i18nKey={`game:strategy.computer.${band}`}
                  components={{ strong: STRONG }}
                />
              </li>
            ))}
          </ul>
        </Chapter>

        <Chapter id="faq" title={t("game:strategy.faq.title")}>
          <FaqList
            items={FAQ_ITEMS.map((item) => ({
              id: item,
              question: t(`game:strategy.faq.items.${item}.question`),
              answer: (
                <Trans
                  i18nKey={`game:strategy.faq.items.${item}.answer`}
                  components={{
                    openings: (
                      <Link
                        to="/opening-moves"
                        className={TEXT_LINK_CLASS}
                      />
                    ),
                  }}
                />
              ),
            }))}
          />
        </Chapter>

        <Chapter id="practise" title={t("game:strategy.practise.title")}>
          {playBlock}
        </Chapter>
      </ManualPage>
    </>
  )
}
