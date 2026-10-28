import { createFileRoute, Link } from "@tanstack/react-router"
import { Trans, useTranslation } from "react-i18next"
import type { ManualChapter } from "@/components/manual/chapter"
import { Chapter, Plate } from "@/components/manual/chapter"
import { ManualHero, ManualPage } from "@/components/manual/manual-page"
import { PlayBlock } from "@/components/play-block"
import { RuleDiagram } from "@/components/rule-diagram"
import { SubpageHeader } from "@/components/ui/subpage-header"
import { useMarbleDesign } from "@/hooks/use-marble-design"
import { COMPUTER_GAME } from "@/hooks/use-play-actions"
import type { Diagram } from "@/render/draw-diagram"
import { BELGIAN_DAISY, GERMAN_DAISY, START } from "@/render/start-diagram"
import { routeLanguage } from "@/routing/route-language"
import { seoPageHead } from "@/routing/seo-pages"

export const Route = createFileRoute("/_subpage/starting-positions")({
  head: ({ match }) =>
    seoPageHead("/starting-positions", routeLanguage(match.context)),
  component: StartingPositionsPage,
})

/**
 * The three starting positions a player meets most, side by side: a table,
 * then one chapter and one board per layout, then how the two daisies differ.
 * Built like the opening moves page, with plates for the boards, and link
 * targets for each layout (/starting-positions#belgian-daisy).
 */

/** The table's rows and columns, in reading order. */
const LAYOUTS = ["standard", "belgian_daisy", "german_daisy"] as const
const COLUMNS = ["layout", "shape", "first_push", "best_for"] as const

/** The layouts that get a chapter and a board: anchor, copy key, board. */
const LAYOUT_CHAPTERS: ReadonlyArray<
  readonly [string, (typeof LAYOUTS)[number], Diagram]
> = [
  ["standard", "standard", START],
  ["belgian-daisy", "belgian_daisy", BELGIAN_DAISY],
  ["german-daisy", "german_daisy", GERMAN_DAISY],
]

/** The FAQ items, in the order the FAQPage markup lists them. */
const FAQ_ITEMS = [
  "marbles",
  "first",
  "belgian",
  "difference",
  "beginners",
  "why_daisy",
] as const

const STRONG = <strong className="font-semibold text-white" />

const TEXT_LINK_CLASS =
  "font-semibold text-brand-light underline underline-offset-2 hover:text-white"

const OPENING_LINK = (
  <Link to="/opening-moves" className={TEXT_LINK_CLASS} />
)

function StartingPositionsPage() {
  const { t } = useTranslation()

  // The boards are the player's own marbles, as on the rules page.
  const [marbleDesign] = useMarbleDesign()

  const chapters: ManualChapter[] = [
    { id: "at-a-glance", title: t("game:positions.glance.title") },
    ...LAYOUT_CHAPTERS.map(([id, key]) => ({
      id,
      title: t(`game:positions.${key}.title`),
    })),
    { id: "belgian-vs-german", title: t("game:positions.compare.title") },
    { id: "other-layouts", title: t("game:positions.others.title") },
    { id: "faq", title: t("game:positions.faq.title") },
    { id: "try-them", title: t("game:positions.try.title") },
  ]
  const chapter = Object.fromEntries(
    chapters.map((entry) => [entry.id, entry]),
  ) as Record<string, ManualChapter>

  const playBlock = (
    <PlayBlock
      cta={t("game:positions.play.cta")}
      more={t("game:positions.play.more")}
    />
  )

  return (
    <>
      {/* The page's own heading is on a phone too, so the bar's title is a
          label: one `<h1>` on the page. */}
      <SubpageHeader title={t("game:positions.title")} titleAs="p" />

      <ManualPage
        title={t("game:positions.title")}
        chapters={chapters}
        plates
        hero={
          <ManualHero
            heading={t("game:positions.heading")}
            intro={
              <Trans
                i18nKey="game:positions.intro"
                components={{
                  rules: <Link to="/rules" className={TEXT_LINK_CLASS} />,
                  opening: OPENING_LINK,
                }}
              />
            }
            //no board in the hero: the intro is the answer, and the way to the
            //board under it stays on the first screen of a phone
            actions={playBlock}
          />
        }
      >
        <Chapter {...chapter["at-a-glance"]}>
          {/* A table from `sm`; on a phone each layout is a block of its own,
              its column names written beside each value, so nothing scrolls
              sideways or squeezes four columns into 280px. The header row
              stays for a screen reader. */}
          <table className="w-full border-collapse max-sm:block text-left text-[15px] leading-normal">
            <caption className="sr-only">
              {t("game:positions.glance.caption")}
            </caption>
            <thead className="max-sm:sr-only">
              <tr className="border-b border-border">
                {COLUMNS.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="py-2 pr-3 align-bottom font-semibold text-foreground"
                  >
                    {t(`game:positions.glance.columns.${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="max-sm:block">
              {LAYOUTS.map((layout) => (
                <tr
                  key={layout}
                  className="border-b border-border max-sm:block max-sm:py-3 max-sm:first:pt-0"
                >
                  <th
                    scope="row"
                    className="py-2 pr-3 align-top font-semibold text-foreground max-sm:block max-sm:py-0"
                  >
                    {t(`game:positions.glance.rows.${layout}.layout`)}
                  </th>
                  {COLUMNS.slice(1).map((column) => (
                    <td
                      key={column}
                      className="py-2 pr-3 align-top max-sm:block max-sm:py-0.5"
                    >
                      <span
                        aria-hidden
                        className="font-semibold text-foreground sm:hidden"
                      >
                        {t(`game:positions.glance.columns.${column}`)}{" "}
                      </span>
                      {t(`game:positions.glance.rows.${layout}.${column}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Chapter>

        {LAYOUT_CHAPTERS.map(([id, key, diagram]) => (
          <Chapter
            key={id}
            {...chapter[id]}
            plate={
              <Plate>
                <figure>
                  <RuleDiagram
                    diagram={diagram}
                    marbleDesign={marbleDesign}
                    label={t(`game:positions.${key}.label`)}
                  />
                </figure>
              </Plate>
            }
          >
            <p>
              <Trans
                i18nKey={`game:positions.${key}.body`}
                components={{ strong: STRONG }}
              />
            </p>
            {key === "standard" && (
              <p>
                <Trans
                  i18nKey="game:positions.standard.next"
                  components={{ opening: OPENING_LINK }}
                />
              </p>
            )}
            {key === "belgian_daisy" && (
              <p>{t("game:positions.belgian_daisy.history")}</p>
            )}
          </Chapter>
        ))}

        <Chapter {...chapter["belgian-vs-german"]}>
          <p>
            <Trans
              i18nKey="game:positions.compare.body"
              components={{
                strong: STRONG,
                offline: (
                  <Link {...COMPUTER_GAME} className={TEXT_LINK_CLASS} />
                ),
              }}
            />
          </p>
        </Chapter>

        <Chapter {...chapter["other-layouts"]}>
          <p>{t("game:positions.others.body")}</p>
        </Chapter>

        <Chapter {...chapter.faq}>
          <dl className="flex flex-col">
            {FAQ_ITEMS.map((item) => (
              <div
                key={item}
                className="border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0"
              >
                <dt className="text-[17px] font-semibold text-foreground">
                  {t(`game:positions.faq.items.${item}.question`)}
                </dt>
                <dd className="mt-1">
                  <p>{t(`game:positions.faq.items.${item}.answer`)}</p>
                </dd>
              </div>
            ))}
          </dl>
        </Chapter>

        <Chapter {...chapter["try-them"]}>
          {playBlock}
          <p>
            <Trans
              i18nKey="game:positions.try.more_reading"
              components={{
                strategy: (
                  <Link to="/strategy" className={TEXT_LINK_CLASS} />
                ),
              }}
            />
          </p>
        </Chapter>
      </ManualPage>
    </>
  )
}
