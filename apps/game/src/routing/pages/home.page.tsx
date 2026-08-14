import { Screen } from "@repo/nativ/components"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { DemoBoard } from "@/components/demo-board"
import { GroupIcon, InfoIcon, WifiIcon } from "@/components/icons"
import { PlayOption } from "@/components/play-option"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/ui/reveal"
import { useIsDesktop } from "@/hooks/use-is-desktop"
import { usePlayActions } from "@/hooks/use-play-actions"

export const Route = createFileRoute("/_shell/")({
  component: HomePage,
})

/**
 * The front door: what the game is on one side, the game playing itself on the
 * other, and nothing under either.
 *
 * One screenful, deliberately — no scroller, on a phone as much as on a desktop.
 * A front door that scrolls is a page, and a page invites reading; this one is a
 * poster. Everything a visitor might scroll for lives a press away in the
 * chrome: the Play menu above on a desktop, the Play tab below on a phone, and
 * the rules behind the third button.
 *
 * The board is the smaller half on purpose. It is the argument, not the offer:
 * given the whole width it reads as a game already in progress that you are
 * watching rather than joining. On a phone it is not there at all — there is one
 * column and the two ways in fill it, and a board squeezed under them would be
 * the thing that costs the screen its last row.
 */
function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { playOnline, playOffline } = usePlayActions()

  //not `hidden lg:block`: the demo plays itself out of a rAF loop, and a hidden
  //board is a loop nobody is watching
  const isDesktop = useIsDesktop()

  return (
    <Screen inset="safe-x" className="relative">
      {/* Its own layer, not a class on the column: the texture is masked, and a
          mask on the column would fade the hero out with it. */}
      <div className="hex-texture pointer-events-none absolute inset-0 [--hex-size:88px]" />

      <div className="relative mx-auto flex w-full min-h-0 max-w-6xl flex-1 flex-col gap-y-6 px-4 py-6 lg:flex-row lg:gap-x-16 lg:py-10">
        <Reveal className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center text-center lg:items-start lg:text-left">
          {/* Said before the name, because the name means nothing to anyone who
              has not played it: two people, one board, and you can see the
              board from here. */}
          <p className="text-xs font-bold tracking-[0.2em] text-brand-lighter uppercase">
            {t("common:home.eyebrow")}
          </p>

          <h1 className="mt-3 text-6xl font-extrabold tracking-tight text-white lg:text-8xl">
            Abalone
          </h1>

          {/* And the rule that makes the board beside it legible: what winning
              is. It is the only sentence on the screen, so it is the one that
              has to earn the two rows under it. */}
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-white/60 lg:text-xl">
            {t("common:home.tagline")}
          </p>

          <div className="mt-8 flex w-full max-w-lg flex-col gap-3 lg:mt-10">
            <PlayOption
              icon={WifiIcon}
              tone="brand"
              size="lg"
              title={t("common:home.play_online")}
              hint={t("common:play.online_hint")}
              onClick={playOnline}
            />

            <PlayOption
              icon={GroupIcon}
              size="lg"
              title={t("common:home.play_offline")}
              hint={t("common:play.offline_hint")}
              //wrapped, so the click event is not read as a mode
              onClick={() => playOffline()}
            />
          </div>

          {/* Third rung, and quieter than the other two on purpose: the rules
              are where somebody goes when neither row is yet appealing. */}
          <Button
            variant="ghost"
            className="mt-3"
            onClick={() => navigate({ to: "/rules" })}
          >
            <InfoIcon size={18} />
            {t("common:home.rules_link")}
          </Button>
        </Reveal>

        {isDesktop && (
          <div className="flex min-h-0 w-2/5 min-w-0 shrink-0 flex-col">
            <DemoBoard />
          </div>
        )}
      </div>
    </Screen>
  )
}
