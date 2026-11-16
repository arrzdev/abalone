import { cn } from "@repo/nativ/utils"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { BotFace } from "@/components/bot-face"
import {
  PLAY_BUTTON_CLASS,
  TEXT_LINK_CLASS,
} from "@/components/play-block"
import { COMPUTER_GAME } from "@/hooks/use-play-actions"
import { BOT_LEVELS } from "@/i18n/bots"

export type EndPlayCtaProps = {
  /** The headline's anchor: the id the page's last chapter had, so the old link still lands here. */
  id: string
  /** What the page just taught, as a reason to play it. */
  headline: string
  /** The button's label: it opens the computer game. */
  cta: string
  /** The link's label: it goes home, to the choice of ways to play. */
  more: string
  /** Reading that belongs to the end of the page, under the panel. */
  children?: ReactNode
}

/**
 * The end of a guide: one block that asks the reader to play (the `design`
 * document on TUD-5812, §2).
 *
 * The hero's `PlayBlock` is the same button, so at the end of the article it
 * read as one more chapter. This one stops the reader: the eight bots say
 * somebody is waiting, the headline says what to try, and the line under the
 * button says it costs nothing and asks for no account.
 *
 * Not a `Chapter`: it has no number and no hairline of its own on a phone. The
 * panel is a band from edge to edge there, where the button keeps one line at
 * 320, and a card from `sm`. The page's column pads by 20px up to `sm`, which
 * is what the band's negative margin takes back.
 *
 * Static and a plain link, so it works before the page has hydrated.
 */
export function EndPlayCta({
  id,
  headline,
  cta,
  more,
  children,
}: EndPlayCtaProps) {
  const { t } = useTranslation()

  return (
    <section
      data-end-cta
      aria-labelledby={id}
      className="py-10 sm:border-t sm:border-border sm:py-16"
    >
      <div
        data-end-cta-panel
        className="-mx-5 flex flex-col gap-4 border-y border-border bg-surface px-5 py-7 sm:mx-0 sm:max-w-[62ch] sm:gap-5 sm:rounded-2xl sm:border sm:p-8"
      >
        {/* The eight of them: "eight bots" is a claim, the faces are the
            evidence. Overlapped, and the row padded by the overlap so the last
            face's tail does not push the caption off. */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <div className="flex pe-2">
            {BOT_LEVELS.map((level) => (
              <BotFace
                key={level}
                level={level}
                className="-me-2 ring-2 ring-surface"
              />
            ))}
          </div>
          <span className="text-sm text-faint">
            {t("common:home.bots_caption")}
          </span>
        </div>

        <h2
          id={id}
          className="scroll-mt-6 pb-0.5 font-display text-2xl leading-[1.2] font-bold text-balance text-foreground lg:text-[30px] lg:leading-[1.15]"
        >
          {headline}
        </h2>

        {/* One column on a phone: the button, the trust line, the link. From
            `sm` the button and the link are a row and the trust line is under
            both, which is why the three are placed rather than flowed. */}
        <div className="flex flex-col gap-y-1 sm:grid sm:grid-cols-[auto_1fr] sm:items-center sm:gap-x-6 sm:gap-y-4">
          <Link
            {...COMPUTER_GAME}
            className={cn(
              PLAY_BUTTON_CLASS,
              //20px a side under `sm`: "Play against the computer" is 238px
              //wide and the band's button is 280, so it keeps one line at 320
              "px-5 sm:col-start-1 sm:row-start-1 sm:px-8",
            )}
          >
            {cta}
          </Link>
          <p className="py-2 text-center text-[15px] text-subtle sm:col-span-2 sm:row-start-2 sm:py-0 sm:text-left">
            {t("game:end_cta.trust")}
          </p>
          <Link
            to="/"
            className={cn(
              TEXT_LINK_CLASS,
              "inline-flex min-h-11 items-center self-center sm:col-start-2 sm:row-start-1 sm:justify-self-start",
            )}
          >
            {more}
          </Link>
        </div>
      </div>

      {children && (
        <div className="mt-6 max-w-[62ch] text-base leading-[1.7] text-pretty text-subtle lg:text-[17px]">
          {children}
        </div>
      )}
    </section>
  )
}
