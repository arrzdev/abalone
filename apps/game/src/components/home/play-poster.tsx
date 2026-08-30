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
import { brandName } from "@/utils/brand"

/**
 * The front door for anyone without an account: what the game is on one side,
 * the game playing itself on the other, and nothing under either.
 *
 * One screenful, deliberately — no scroller, on a phone as much as on a desktop.
 * A front door that scrolls is a page, and a page invites reading; this one is a
 * poster.
 *
 * The three ways in are three rows rather than one row and a menu, because the
 * difference between them is the whole decision: one needs an account, one needs
 * nobody, and one needs somebody sitting next to you. Naming them costs three
 * lines and saves a press and a guess.
 *
 * The board is the smaller half on purpose. It is the argument, not the offer:
 * given the whole width it reads as a game already in progress that you are
 * watching rather than joining. On a phone it takes the room above the rows for
 * the same reason — the three ways in stay at the bottom, where a thumb is.
 */
export function PlayPoster() {
  const { t } = useTranslation()
  const { playOnline, playOffline } = usePlayActions()

  //the eight faces are eight pictures, and a phone never shows them: mounted
  //behind `hidden` they are eight requests spent on nothing
  const isDesktop = useIsDesktop()

  return (
    <div className="relative mx-auto flex w-full min-h-0 max-w-[1264px] flex-1 flex-col px-4 pt-3.5 pb-safe-offset-4 lg:flex-row lg:items-center lg:gap-x-14 lg:px-12 lg:py-8">
      <Reveal className="flex min-w-0 flex-col items-stretch max-lg:shrink-0 lg:min-h-0 lg:flex-1 lg:items-start">
        {/* The name and the rule, and only where there is room for them. On a
            phone the header two rows up already says "Abalone", and a 104px
            repeat of it is the screenful the buttons need. */}
        <h1 className="hidden font-display text-[104px] leading-[0.92] font-extrabold tracking-[-0.045em] text-white lg:block">
          {brandName()}
        </h1>
        {/* One line, in every language. 19px is the frame's size and fits the
            English string with room to spare; Portuguese is the longest of the
            thirteen and overruns the column by 4px at that size, so the whole
            line is set a point smaller rather than left to wrap in some
            languages and not others. */}
        <p className="hidden text-[18px] leading-relaxed whitespace-nowrap text-muted lg:mt-5 lg:block">
          {t("common:home.tagline")}
        </p>

        <div className="flex w-full flex-col gap-2.5 lg:mt-9 lg:max-w-[500px]">
          <PlayOption
            icon={WifiIcon}
            tone="brand"
            title={t("common:home.play_online")}
            hint={t("common:home.online_hint")}
            onClick={playOnline}
          />

          {/* Below `lg` the two offline modes are rows like the first, because
              a column has the width to name them. Above it they are a pair, so
              the row that needs an account keeps the emphasis. */}
          <div className="flex flex-col gap-2.5 lg:flex-row lg:gap-2.5">
            <PlayOption
              icon={RobotIcon}
              className="lg:hidden"
              title={t("game:controls.mode_ai")}
              hint={t("common:home.bot_hint_long")}
              onClick={() => playOffline("ai")}
            />
            <PlayOption
              icon={GroupIcon}
              className="lg:hidden"
              title={t("game:controls.mode_local")}
              hint={t("common:home.local_hint_long")}
              onClick={() => playOffline("local")}
            />

            <PlayOption
              icon={RobotIcon}
              size="tile"
              className="hidden min-w-0 flex-1 lg:flex"
              title={t("game:controls.mode_ai")}
              hint={t("common:home.bot_hint_short")}
              onClick={() => playOffline("ai")}
            />
            <PlayOption
              icon={GroupIcon}
              size="tile"
              className="hidden min-w-0 flex-1 lg:flex"
              title={t("game:controls.mode_local")}
              hint={t("common:home.local_hint_short")}
              onClick={() => playOffline("local")}
            />
          </div>
        </div>

        {/* Phone only. A desktop carries Rules in the header, and a second way
            to the same page under the three rows is a fourth thing to read on
            the one screen that has to be read at a glance.

            A line rather than a row: the rows above are the offer, and giving
            the rules the same box makes it a fourth way to play. */}
        <p className="flex justify-center py-0.5 lg:hidden">
          <span className="inline-flex min-h-11 items-center gap-1.5 px-3.5 text-sm text-faint">
            {t("common:home.rules_prompt")}
            <Link
              to="/rules"
              className="rounded-sm text-brand-lighter underline underline-offset-[3px] transition-colors duration-200 ease-out hover:text-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {t("common:home.rules_link")}
            </Link>
          </span>
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
