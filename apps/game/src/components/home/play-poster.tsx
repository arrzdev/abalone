import { cn } from "@repo/nativ/utils"
import { Link } from "@tanstack/react-router"
import { Trans, useTranslation } from "react-i18next"
import { BotFace } from "@/components/bot-face"
import { DemoBoard } from "@/components/demo-board"
import { GroupIcon, RobotIcon, WifiIcon } from "@/components/icons"
import { PlayOption } from "@/components/play-option"
import { Reveal } from "@/components/ui/reveal"
import { useIsDesktop } from "@/hooks/use-is-desktop"
import { COMPUTER_GAME, usePlayActions } from "@/hooks/use-play-actions"
import { BOT_LEVELS } from "@/i18n/bots"

/**
 * The front door for anyone without an account: what the game is on one side,
 * the game playing itself on the other, and nothing under either.
 *
 * One screenful, deliberately — no scroller, on a phone as much as on a desktop.
 * A front door that scrolls is a page, and a page invites reading; this one is a
 * poster.
 *
 * It answers the two questions a search for "play abalone free" brings, before
 * anything is pressed: is it free, and do I need an account (the
 * `play-free-first-screen` document on TUD-2287). The heading says both, on a
 * phone too, and the line under it says there is nothing to sign up for or
 * download.
 *
 * Then one way in that asks for nothing, named as the action rather than the
 * opponent: Play now, against the computer. It is a link, so it opens a game
 * before the page has hydrated. The other two are a quieter pair under it: one
 * needs somebody sitting next to you, and one needs an account and says so on
 * its own line, so nobody learns that from a sign-in wall.
 *
 * The board is the smaller half on purpose. It is the argument, not the offer:
 * given the whole width it reads as a game already in progress that you are
 * watching rather than joining. On a phone it takes the room above the rows for
 * the same reason — the ways in stay at the bottom, where a thumb is — and when
 * that room is too small for a board it is left empty rather than holding a
 * board too small to read.
 */
const TEXT_LINK_CLASS =
  "inline-flex min-h-11 items-center rounded-sm px-2.5 text-brand-lighter underline underline-offset-[3px] transition-colors duration-200 ease-out hover:text-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"

export function PlayPoster() {
  const { t } = useTranslation()
  const { playOnline, playOffline } = usePlayActions()
  //a language without the line yet keeps an empty one: no line beats an
  //english one in the middle of a translated page
  const trust = t("common:home.trust")

  //the eight faces are eight pictures, and a phone never shows them: mounted
  //behind `hidden` they are eight requests spent on nothing
  const isDesktop = useIsDesktop()

  return (
    //three blocks: the heading, the ways in, the board. below `lg` a column,
    //the board between the other two by `order`, so the document keeps one
    //order for a screen reader. above it a grid: the heading and the ways in
    //down the left, centred together, and the board on the right
    <div className="relative mx-auto flex w-full min-h-0 max-w-[1264px] flex-1 flex-col px-4 pt-3.5 pb-safe-offset-4 lg:grid lg:grid-cols-[minmax(0,1fr)_540px] lg:grid-rows-[1fr_auto_auto_1fr] lg:gap-x-14 lg:px-12 lg:py-8">
      <Reveal className="flex min-w-0 shrink-0 flex-col items-stretch lg:row-start-2 lg:items-start">
        {/* What the page is, in the words a search result shows, at every
            width: free and no account are what a phone searcher came to
            check. The paragraph is the desktop's; a phone gets one short line
            in its place, and the paragraph stays for a screen reader. */}
        <h1 className="font-display leading-[0.98] font-extrabold tracking-[-0.035em] text-balance text-white max-lg:text-[28px] max-[374px]:text-[26px] lg:text-[clamp(2.75rem,1rem+3.2vw,4.25rem)]">
          {t("common:home.heading")}
        </h1>
        {trust !== "" && (
          <p className="mt-2 text-[15px] leading-snug text-pretty text-white/70 lg:hidden">
            {trust}
          </p>
        )}
        {/* the no sign-up words brighter than the rest, so they read first */}
        <p className="max-w-[500px] text-[17px] leading-relaxed text-pretty text-muted max-lg:sr-only lg:mt-5">
          <Trans
            i18nKey="common:home.lede"
            components={{ trust: <span className="text-white/70" /> }}
          />
        </p>
      </Reveal>

      <Reveal className="flex min-w-0 shrink-0 flex-col items-stretch max-lg:order-last lg:row-start-3 lg:items-start">
        <div className="flex w-full flex-col gap-2.5 lg:mt-9 lg:max-w-[500px]">
          <PlayOption
            icon={RobotIcon}
            tone="brand"
            title={t("common:home.play_now")}
            hint={t("common:home.play_now_hint")}
            link={COMPUTER_GAME}
          />
          <div className="grid grid-cols-2 gap-2.5">
            <PlayOption
              icon={GroupIcon}
              tone="neutral"
              size="pair"
              title={t("game:controls.mode_local")}
              hint={t("common:home.local_hint")}
              onClick={() => playOffline("local")}
            />
            <PlayOption
              icon={WifiIcon}
              tone="neutral"
              size="pair"
              title={t("common:home.online_title")}
              hint={t("common:home.online_hint")}
              onClick={playOnline}
            />
          </div>
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
          {/* desktop only: on a phone the Friend online tile right above
              goes the same way, and its line is the room the heading needs */}
          <span aria-hidden="true" className="max-lg:hidden">
            ·
          </span>
          <Link
            to="/play-online"
            className={cn(TEXT_LINK_CLASS, "max-lg:hidden")}
          >
            {t("common:home.play_online_link")}
          </Link>
        </p>
      </Reveal>

      {/* Last in the document: the rows are what somebody came for, and the
          board is the argument for them. On a phone the slot is a size
          container, what is left of the screen between the heading and the
          rows, and it holds the board only when that is a board's worth
          (140px). Under it a board is a blob that reads as a broken picture,
          so the slot stays empty. CSS rather than a measurement, so the
          prerendered page is already right. */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center pt-3 pb-3.5 max-lg:[container-type:size] lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:w-[540px] lg:flex-none lg:gap-6 lg:self-center lg:py-0">
        {/* Flex, not a plain block: the canvas sizes itself from the box it is
            handed, and a block parent leaves it measuring a zero-height one
            and drawing at its fallback size. */}
        <div className="flex min-h-0 w-full max-w-[300px] flex-1 flex-col max-lg:[@container(max-height:139.98px)]:hidden lg:h-[472px] lg:max-w-none lg:flex-none">
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
