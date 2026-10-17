import { createFileRoute, Link } from "@tanstack/react-router"
import { Trans, useTranslation } from "react-i18next"
import type { ManualChapter } from "@/components/manual/chapter"
import { Chapter } from "@/components/manual/chapter"
import { ManualHero, ManualPage } from "@/components/manual/manual-page"
import { PlayBlock } from "@/components/play-block"
import { SubpageHeader } from "@/components/ui/subpage-header"
import { COMPUTER_GAME } from "@/hooks/use-play-actions"
import { seoPageHead } from "@/routing/seo-pages"

export const Route = createFileRoute("/_subpage/opening-moves")({
  head: () => seoPageHead("/opening-moves"),
  component: OpeningMovesPage,
})

/**
 * Opening moves for a beginner, as text: the starting position, safe first
 * moves and what the daisy layouts change. Built like the strategy page, as a
 * manual with link targets (/opening-moves#daisy), ending at a board.
 */

/** The sections in reading order: anchor, then copy key. */
const SECTIONS = [
  ["starting-position", "start"],
  ["safe-first-moves", "safe"],
  ["side-steps", "sidestep"],
  ["daisy", "daisy"],
  ["other-layouts", "others"],
] as const

const MISTAKES = ["lone_runner", "rush_edge", "ignore_daisy"] as const

const STRONG = <strong className="font-semibold text-white" />

const TEXT_LINK_CLASS =
  "font-semibold text-brand-light underline underline-offset-2 hover:text-white"

function OpeningMovesPage() {
  const { t } = useTranslation()

  const chapters: ManualChapter[] = [
    ...SECTIONS.map(([id, key]) => {
      return { id, title: t(`game:openings.${key}.title`) }
    }),
    { id: "mistakes", title: t("game:openings.mistakes.title") },
    { id: "practise", title: t("game:openings.practise.title") },
  ]

  const playBlock = (
    <PlayBlock
      cta={t("game:openings.play.cta")}
      more={t("game:openings.play.more")}
    />
  )

  return (
    <>
      {/* The page's own heading is on a phone too, so the bar's title is a
          label: one `<h1>` on the page. */}
      <SubpageHeader title={t("game:openings.title")} titleAs="p" />

      {/* No plates: the sections are advice and the layouts are on the rules
          page, so the page prints no board. */}
      <ManualPage
        title={t("game:openings.title")}
        chapters={chapters}
        hero={
          <ManualHero
            heading={t("game:openings.heading")}
            intro={
              <Trans
                i18nKey="game:openings.intro"
                components={{
                  offline: (
                    <Link {...COMPUTER_GAME} className={TEXT_LINK_CLASS} />
                  ),
                  rules: <Link to="/rules" className={TEXT_LINK_CLASS} />,
                  strategy: (
                    <Link to="/strategy" className={TEXT_LINK_CLASS} />
                  ),
                }}
              />
            }
            //a way to the board under the intro and in "Practise"; none
            //between the sections, where it broke up the reading
            actions={playBlock}
          />
        }
      >
        {SECTIONS.map(([id, key], index) => (
          <Chapter key={id} {...chapters[index]}>
            <p>
              <Trans
                i18nKey={`game:openings.${key}.body`}
                components={{ strong: STRONG }}
              />
            </p>
          </Chapter>
        ))}

        <Chapter id="mistakes" title={t("game:openings.mistakes.title")}>
          <ul className="flex list-disc flex-col gap-y-1.5 pl-5 marker:text-faint">
            {MISTAKES.map((item) => (
              <li key={item}>
                {t(`game:openings.mistakes.items.${item}`)}
              </li>
            ))}
          </ul>
        </Chapter>

        <Chapter id="practise" title={t("game:openings.practise.title")}>
          {playBlock}
        </Chapter>
      </ManualPage>
    </>
  )
}
