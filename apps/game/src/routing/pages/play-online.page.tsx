import { createFileRoute, Link } from "@tanstack/react-router"
import { Trans, useTranslation } from "react-i18next"
import type { ManualChapter } from "@/components/manual/chapter"
import { Chapter } from "@/components/manual/chapter"
import { ManualHero, ManualPage } from "@/components/manual/manual-page"
import { PlayBlock } from "@/components/play-block"
import { SubpageHeader } from "@/components/ui/subpage-header"
import { usePlayActions } from "@/hooks/use-play-actions"
import { seoPageHead } from "@/routing/seo-pages"

export const Route = createFileRoute("/_subpage/play-online")({
  head: () => seoPageHead("/play-online"),
  component: PlayOnlinePage,
})

/**
 * The public page for online play (the `audit` document on TUD-1688, page
 * design on TUD-1820): what a search for "play abalone online free" or
 * "abalone with friends" lands on. `/online` is the signed-in hub and stays out
 * of the index; this page says how playing a friend works and opens the way in.
 *
 * Built on the manual, with two chapters and no numbers: two chapters do not
 * make a numbered manual.
 *
 * The button is the sign-in gate, not a link to `/online`: a visitor sent there
 * signed out is bounced home. For the same reason the FAQ names the Online page
 * without linking it.
 */

const STEPS = ["account", "invite", "send", "accept"] as const

const FAQ_ITEMS = [
  "free",
  "sign_up",
  "friend",
  "private",
  "same_time",
  "code",
] as const

const TEXT_LINK_CLASS =
  "font-semibold text-brand-light underline underline-offset-2 hover:text-white"

//the read-more row, as home has it under its three ways to play
const READ_MORE_LINK_CLASS =
  "inline-flex min-h-11 items-center rounded-sm px-2.5 text-brand-lighter underline underline-offset-[3px] transition-colors duration-200 ease-out hover:text-brand-hover"

function PlayOnlinePage() {
  const { t } = useTranslation()
  const { playOnline } = usePlayActions()

  const chapters: ManualChapter[] = [
    { id: "with-a-friend", title: t("game:playOnline.steps.title") },
    { id: "faq", title: t("game:rules.faq.title") },
  ]

  const playBlock = (
    <PlayBlock
      cta={t("common:home.play_online")}
      more={t("game:rules.play.more")}
      onPlay={playOnline}
    />
  )

  return (
    <>
      {/* The page's own heading is on a phone too, so the bar's title is a
          label: one `<h1>` on the page. */}
      <SubpageHeader title={t("common:home.play_online")} titleAs="p" />

      {/* 16px less above the hero and between its rows under 375, so the
          button ends inside a 320x460 first screen (TUD-1820 §3). This page
          only: its intro is the longest of the manuals. */}
      <ManualPage
        title={t("common:home.play_online")}
        chapters={chapters}
        className="max-[374px]:pt-4"
        hero={
          <ManualHero
            heading={t("game:playOnline.heading")}
            intro={t("game:playOnline.intro")}
            actions={playBlock}
            className="max-[374px]:gap-y-5"
          />
        }
      >
        <Chapter {...chapters[0]}>
          <ol className="flex flex-col gap-y-4">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-x-3">
                <span
                  aria-hidden
                  className="w-5 shrink-0 font-display text-sm leading-[1.7] font-semibold tabular-nums text-muted lg:leading-[1.9]"
                >
                  {index + 1}
                </span>
                <span>{t(`game:playOnline.steps.items.${step}`)}</span>
              </li>
            ))}
          </ol>
        </Chapter>

        <Chapter {...chapters[1]}>
          <dl className="flex flex-col">
            {FAQ_ITEMS.map((item) => (
              <div
                key={item}
                className="border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0"
              >
                <dt className="text-[17px] font-semibold text-foreground">
                  {t(`game:playOnline.faq.items.${item}.question`)}
                </dt>
                <dd className="mt-1">
                  <p>
                    <Trans
                      i18nKey={`game:playOnline.faq.items.${item}.answer`}
                      components={{
                        offline: (
                          <Link
                            to="/offline"
                            className={TEXT_LINK_CLASS}
                          />
                        ),
                      }}
                    />
                  </p>
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-6 -ms-2.5 flex flex-wrap items-center text-sm text-faint">
            <Link to="/rules" className={READ_MORE_LINK_CLASS}>
              {t("common:home.rules_link")}
            </Link>
            <span aria-hidden="true">·</span>
            <Link to="/strategy" className={READ_MORE_LINK_CLASS}>
              {t("common:home.strategy_link")}
            </Link>
          </p>
        </Chapter>

        <div className="border-t border-border pt-10 lg:pt-16">
          {playBlock}
        </div>
      </ManualPage>
    </>
  )
}
