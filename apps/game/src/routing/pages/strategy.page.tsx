import { cn } from "@repo/nativ/utils"
import { createFileRoute, Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { Trans, useTranslation } from "react-i18next"
import { buttonClassName } from "@/components/ui/button"
import { Card, Page, PageTitle } from "@/components/ui/page"
import { SubpageHeader } from "@/components/ui/subpage-header"
import { seoPageHead } from "@/routing/seo-pages"

export const Route = createFileRoute("/_subpage/strategy")({
  head: () => seoPageHead("/strategy"),
  component: StrategyPage,
})

/**
 * Seven habits that win games, as text (the `strategy-page-final` document on
 * TUD-632).
 *
 * Built like the rules: one card per section, each heading a link target
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

const STRONG = <strong className="font-semibold text-white" />

/**
 * The way out to a board. Full width on a phone, where full width is a
 * thumb's width, and where the longer label in some languages takes two
 * lines: the height grows with it rather than clipping it.
 */
const CTA_CLASS =
  "h-auto min-h-[54px] w-full py-3 text-center text-balance sm:w-auto sm:px-8 sm:whitespace-nowrap"

const TEXT_LINK_CLASS =
  "font-semibold text-brand-light underline underline-offset-2 hover:text-white"

/** One section: its heading, a link target, and what it says. */
function Section({
  id,
  title,
  children,
  actions,
}: {
  id: string
  title: string
  children?: ReactNode
  /** Under the text, and free of its reading measure. */
  actions?: ReactNode
}) {
  return (
    <Card>
      <div className="min-w-0 max-w-[70ch]">
        {/* `scroll-mt` so a link to the heading does not land it flush
            against the top of the scroller. */}
        <h2
          id={id}
          className="scroll-mt-6 text-lg font-bold text-brand-light"
        >
          {title}
        </h2>
        {children && (
          <div className="mt-2 flex flex-col gap-y-2 text-sm leading-relaxed text-subtle">
            {children}
          </div>
        )}
      </div>
      {actions}
    </Card>
  )
}

function StrategyPage() {
  const { t } = useTranslation()

  return (
    <>
      {/* The page's own heading is on a phone too, so the bar's title is a
          label: one `<h1>` on the page. */}
      <SubpageHeader title={t("game:strategy.title")} titleAs="p" />

      <Page className="lg:max-w-[760px]">
        <PageTitle
          onPhone
          description={
            <span className="block max-w-[70ch]">
              <Trans
                i18nKey="game:strategy.intro"
                components={{
                  offline: (
                    <Link to="/offline" className={TEXT_LINK_CLASS} />
                  ),
                  rules: <Link to="/rules" className={TEXT_LINK_CLASS} />,
                }}
              />
            </span>
          }
        >
          {t("game:strategy.heading")}
        </PageTitle>

        <div className="flex flex-col gap-y-4">
          {TIPS.map(([id, key]) => (
            <Section
              key={id}
              id={id}
              title={t(`game:strategy.tips.${key}.title`)}
            >
              <p>
                <Trans
                  i18nKey={`game:strategy.tips.${key}.body`}
                  components={{ strong: STRONG }}
                />
              </p>
            </Section>
          ))}

          <Section id="mistakes" title={t("game:strategy.mistakes.title")}>
            <ul className="flex list-disc flex-col gap-y-1.5 pl-5 marker:text-faint">
              {MISTAKES.map((item) => (
                <li key={item}>
                  {t(`game:strategy.mistakes.items.${item}`)}
                </li>
              ))}
            </ul>
          </Section>

          {/* Links rather than buttons: they go somewhere, and a crawler
              follows an `href`. */}
          <Section
            id="practise"
            title={t("game:strategy.practise.title")}
            actions={
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  to="/offline"
                  className={cn(
                    buttonClassName("primary", "lg"),
                    CTA_CLASS,
                  )}
                >
                  {t("game:strategy.practise.cta_computer")}
                </Link>
                <Link
                  to="/"
                  className={cn(
                    buttonClassName("secondary", "lg"),
                    CTA_CLASS,
                  )}
                >
                  {t("game:strategy.practise.cta_friend")}
                </Link>
              </div>
            }
          />
        </div>
      </Page>
    </>
  )
}
