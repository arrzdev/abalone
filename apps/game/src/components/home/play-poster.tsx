import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { BotFace } from "@/components/bot-face"
import { DemoBoard } from "@/components/demo-board"
import {
  ChevronRightIcon,
  GroupIcon,
  InfoIcon,
  RobotIcon,
  WifiIcon,
} from "@/components/icons"
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
 * difference between them is the whole decision: one needs an account, one needs
 * nobody, and one needs somebody sitting next to you. Naming them costs three
 * lines and saves a press and a guess.
 *
 * The board is the smaller half on purpose. It is the argument, not the offer:
 * given the whole width it reads as a game already in progress that you are
 * watching rather than joining. On a phone it is not there at all — there is one
 * column, and a board squeezed under the rows would be the thing that costs the
 * screen its last one.
 */
export function PlayPoster() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { playOnline, playOffline } = usePlayActions()

  //not `hidden lg:block`: the demo plays itself out of a rAF loop, and a hidden
  //board is a loop nobody is watching
  const isDesktop = useIsDesktop()

  return (
    <div className="relative mx-auto flex w-full min-h-0 max-w-[1264px] flex-1 flex-col justify-center gap-y-6 px-4 py-6 lg:flex-row lg:items-center lg:gap-x-14 lg:px-12 lg:py-8">
      {/* `justify-center` on the row centres the two columns against each
          other, which is the desktop job. On a phone this column is the only
          one and it grows to the full height, so it has to centre its own
          contents or the rows sit under the header with the screen empty
          beneath them. */}
      <Reveal className="flex min-h-0 min-w-0 flex-1 flex-col items-stretch max-lg:justify-center lg:items-start">
        {/* The name and the rule, and only where there is room for them. On a
            phone the header two rows up already says "Abalone", and a 104px
            repeat of it is the screenful the buttons need. */}
        <h1 className="hidden font-display text-[104px] leading-[0.92] font-extrabold tracking-[-0.045em] text-white lg:block">
          Abalone
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

        {/* Phone only, both of them. A desktop already carries Rules in the
            header, and the account note explains a choice the three rows above
            have just made for themselves — on the width that shows all three at
            once it is a paragraph under a decision nobody is still making. */}
        <button
          type="button"
          onClick={() => navigate({ to: "/rules" })}
          className="mt-4 flex h-13 w-full items-center gap-3 rounded-xl px-5 text-left ring-1 ring-border-outline transition-colors duration-200 ease-out hover:bg-surface hover:ring-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:hidden"
        >
          <InfoIcon size={18} className="shrink-0 text-faint" />
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-muted">
            {t("common:home.rules_link")}
          </span>
          <ChevronRightIcon size={18} className="shrink-0 text-faint" />
        </button>
      </Reveal>

      {isDesktop && (
        <div className="flex min-h-0 w-[540px] shrink-0 flex-col items-center gap-6">
          {/* Flex, not a plain block: the canvas sizes itself from the box it is
              handed, and a block parent leaves it measuring a zero-height one
              and drawing at its fallback size. */}
          <div className="flex h-[472px] w-full flex-col drop-shadow-[0_34px_60px_rgba(0,0,0,0.55)]">
            <DemoBoard />
          </div>

          {/* The eight of them, because "eight strengths" is a claim and eight
              faces is the evidence. Overlapped, and the row padded by the same
              amount so the last one's tail does not pull it off centre. */}
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
        </div>
      )}
    </div>
  )
}
