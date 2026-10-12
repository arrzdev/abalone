import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { BotFace } from "@/components/bot-face"
import { DemoBoard } from "@/components/demo-board"
import { GroupIcon, RobotIcon, WifiIcon } from "@/components/icons"
import { PlayOption } from "@/components/play-option"
import { Reveal } from "@/components/ui/reveal"
import { useIsDesktop } from "@/hooks/use-is-desktop"
import { usePlayActions } from "@/hooks/use-play-actions"
import { BOT_LEVELS } from "@/i18n/bots"

/**
 * The front door for anyone without an account: what the game is on one side,
 * the game playing itself on the other, and nothing under either.
 *
 * One screenful, deliberately — no scroller, on a phone as much as on a desktop.
 * A front door that scrolls is a page, and a page invites reading; this one is a
 * poster.
 *
 * The three ways in are three rows rather than one row and a menu, because the
 * difference between them is the whole decision: one needs nobody, one needs
 * somebody sitting next to you, and one needs an account. Naming them costs three
 * lines and saves a press and a guess.
 *
 * The computer comes first and is the one filled row: it is the way in that asks
 * for nothing, so it is the one to press without reading. Online comes last and
 * says on its own line that it needs an account, so nobody learns that from a
 * sign-in wall. One line each, the same at every size, so no width picks its own
 * copy.
 *
 * The board is the smaller half on purpose. It is the argument, not the offer:
 * given the whole width it reads as a game already in progress that you are
 * watching rather than joining. On a phone it takes the room above the rows for
 * the same reason — the three ways in stay at the bottom, where a thumb is.
 */
const TEXT_LINK_CLASS =
  "inline-flex min-h-11 items-center rounded-sm px-2.5 text-brand-lighter underline underline-offset-[3px] transition-colors duration-200 ease-out hover:text-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"

export function PlayPoster() {
  const { t } = useTranslation()
  const { playOnline, playOffline } = usePlayActions()

  //the eight faces are eight pictures, and a phone never shows them: mounted
  //behind `hidden` they are eight requests spent on nothing
  const isDesktop = useIsDesktop()

  return (
    <div className="relative mx-auto flex w-full min-h-0 max-w-[1264px] flex-1 flex-col px-4 pt-3.5 pb-safe-offset-4 lg:flex-row lg:items-center lg:gap-x-14 lg:px-12 lg:py-8">
      <Reveal className="flex min-w-0 flex-col items-stretch max-lg:shrink-0 lg:min-h-0 lg:flex-1 lg:items-start">
        {/* What the page is, in the words a search result shows (the
            `page-copy` document on TUD-626), and what the game is under it.
            Only for a screen reader on a phone: the header two rows up
            already says "Abalone", and a title and a paragraph there are the
            screenful the buttons need. */}
        <h1 className="font-display leading-[0.98] font-extrabold tracking-[-0.035em] text-balance text-white max-lg:sr-only lg:text-[clamp(2.75rem,1rem+3.2vw,4.25rem)]">
          {t("common:home.heading")}
        </h1>
        <p className="max-w-[500px] text-[17px] leading-relaxed text-pretty text-muted max-lg:sr-only lg:mt-5">
          {t("common:home.lede")}
        </p>

        <div className="flex w-full flex-col gap-2.5 lg:mt-9 lg:max-w-[500px]">
          <PlayOption
            icon={RobotIcon}
            tone="brand"
            title={t("game:controls.mode_ai")}
            hint={t("common:home.bot_hint")}
            onClick={() => playOffline("ai")}
          />
          <PlayOption
            icon={GroupIcon}
            tone="neutral"
            title={t("game:controls.mode_local")}
            hint={t("common:home.local_hint")}
            onClick={() => playOffline("local")}
          />
          <PlayOption
            icon={WifiIcon}
            tone="neutral"
            title={t("common:home.play_online")}
            hint={t("common:home.online_hint")}
            onClick={playOnline}
          />
        </div>

        {/* Somewhere to read before playing, named the way it would be
            searched for. A line rather than a row: the rows above are the
            offer, and giving the rules the same box makes it a fourth way to
            play. On a desktop too, where the header has the rules but not
            the tips. */}
        <p className="flex flex-wrap items-center justify-center text-sm text-faint lg:mt-4 lg:-ms-2.5 lg:justify-start">
          <Link to="/rules" className={TEXT_LINK_CLASS}>
            {t("common:home.rules_link")}
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/strategy" className={TEXT_LINK_CLASS}>
            {t("common:home.strategy_link")}
          </Link>
        </p>
      </Reveal>

      {/* Second in the document and first on the screen below `lg`: the rows
          are what somebody came for, and the board is the argument for them.
          Above `lg` the two sit side by side and the board takes the right. */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center pb-3.5 max-lg:order-first lg:w-[540px] lg:flex-none lg:gap-6 lg:pb-0">
        {/* Flex, not a plain block: the canvas sizes itself from the box it is
            handed, and a block parent leaves it measuring a zero-height one
            and drawing at its fallback size. */}
        <div className="flex min-h-0 w-full max-w-[300px] flex-1 flex-col drop-shadow-[0_26px_46px_rgba(0,0,0,0.55)] lg:h-[472px] lg:max-w-none lg:flex-none lg:drop-shadow-[0_34px_60px_rgba(0,0,0,0.55)]">
          <DemoBoard />
        </div>

        {/* The eight of them, because "eight strengths" is a claim and eight
            faces is the evidence. Overlapped, and the row padded by the same
            amount so the last one's tail does not pull it off centre. */}
        {isDesktop && (
          <div className="flex flex-col items-center gap-2.5">
            <div className="flex pe-2">
              {BOT_LEVELS.map((level) => (
                <BotFace key={level} level={level} className="-me-2" />
              ))}
            </div>
            <span className="text-[13px] text-faint">
              {t("common:home.bots_caption")}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
