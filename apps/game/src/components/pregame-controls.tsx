import { cn } from "@repo/nativ/utils"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import type { ColorChoiceValue } from "@/components/color-choice"
import { ColorChoice } from "@/components/color-choice"
import { GroupIcon, RobotIcon } from "@/components/icons"
import { MarbleGlyph } from "@/components/marble-glyph"
import { SetupCarousel } from "@/components/setup-carousel"
import { Button } from "@/components/ui/button"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { TapButton } from "@/components/ui/tap-button"
import type { SetupKey } from "@/engine/board-setups"
import type { GameMode } from "@/engine/game-state"
import type { Player } from "@/engine/types"
import { avatarSrc, blurbKey, titleKey } from "@/i18n/bots"
import { BOT_LEVELS, getBotName } from "@/i18n/game-text"

/** Black first, because black moves first. */
const LOCAL_SIDES: Player[] = ["black", "white"]

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold tracking-wider text-white/40 uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

export type PregameControlsProps = {
  mode: GameMode
  onModeChange: (mode: GameMode) => void
  difficulty: number
  onDifficultyChange: (difficulty: number) => void
  setupType: SetupKey
  onSetupChange: (setupType: SetupKey) => void
  colorChoice: ColorChoiceValue
  onColorChange: (choice: ColorChoiceValue) => void
  names: Record<Player, string>
  onNameChange: (color: Player, name: string) => void
  marbleDesign?: string
  onPlay: () => void
  preview?: ReactNode
}

/**
 * Side panel for setting a game up. Everything here previews on the board next
 * to it — setup, side and mode all repaint it as they change.
 *
 * There is no board beside the panel on a phone, so `preview` (a bare,
 * non-playable board) is dropped straight under the setup picker it belongs to.
 */
export function PregameControls({
  mode,
  onModeChange,
  difficulty,
  onDifficultyChange,
  setupType,
  onSetupChange,
  colorChoice,
  onColorChange,
  names,
  onNameChange,
  marbleDesign,
  onPlay,
  preview,
}: PregameControlsProps) {
  const { t } = useTranslation()
  const isLocal = mode === "local"

  return (
    <div className="panel-scroll flex-1 space-y-6 overflow-y-auto px-4 py-4">
      <SegmentedControl
        ariaLabel={t("game:controls.game_mode")}
        value={mode}
        onChange={onModeChange}
        options={[
          {
            value: "ai",
            label: t("game:controls.mode_ai"),
            icon: <RobotIcon size={18} />,
          },
          {
            value: "local",
            label: t("game:controls.mode_local"),
            icon: <GroupIcon size={18} />,
          },
        ]}
      />

      {/* Above the opponent, not below it: this is the one setting that applies
          to both modes, so it belongs on the mode switch's side of the split
          rather than stranded under a block that comes and goes with it. */}
      <Section title={t("game:controls.board_setup")}>
        <SetupCarousel setupType={setupType} onChange={onSetupChange} />

        {preview && (
          <div className="mt-3 flex aspect-[8/7] items-center justify-center lg:hidden">
            {preview}
          </div>
        )}
      </Section>

      {isLocal ? (
        <>
          <div className="rounded-xl bg-surface-4 p-4">
            <h3 className="font-bold text-white">
              {t("game:local.title")}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-white/60">
              {t("game:local.description")}
            </p>
          </div>

          <Section title={t("game:local.names")}>
            {/* One field per side rather than "player 1 / player 2": the cards
                these end up on already carry a marble, and the marble here is
                what ties the two together. Left empty they stay the colour
                names the cards used before this existed, so the placeholder is
                the real default rather than a hint about one. */}
            <div className="space-y-2">
              {LOCAL_SIDES.map((color) => (
                <div
                  key={color}
                  className="flex items-center gap-2.5 rounded-xl bg-surface-4 px-3"
                >
                  <MarbleGlyph
                    color={color}
                    design={marbleDesign}
                    size={14}
                  />
                  <input
                    type="text"
                    value={names[color]}
                    onChange={(event) =>
                      onNameChange(color, event.target.value)
                    }
                    placeholder={t(`game:local.${color}`)}
                    aria-label={t(`game:local.${color}`)}
                    maxLength={20}
                    autoComplete="off"
                    spellCheck={false}
                    className={cn(
                      "min-w-0 flex-1 bg-transparent py-3 text-sm font-medium text-white",
                      "placeholder:text-white/35 focus:outline-none",
                    )}
                  />
                </div>
              ))}
            </div>
          </Section>
        </>
      ) : (
        <>
          <Section title={t("game:controls.opponent")}>
            {/* Every tile carries its own name and level. The panel used to
                describe the selected bot in a paragraph above the grid, which
                was a different number of lines for each of the eight — so
                picking an opponent shuffled everything below it. */}
            <div className="grid grid-cols-4 gap-2">
              {BOT_LEVELS.map((level) => {
                const selected = level === difficulty
                const who = `${getBotName(level)} — ${t(titleKey(level))}`
                return (
                  <TapButton
                    key={level}
                    // A tile is a face, a name and a number, and the face is the
                    // part that says who this is — which is nothing you can read
                    // off a 48px portrait. So the tile carries the character:
                    // what they are called, what they are, and their own line
                    // about how they play. The same text the panel shows beside
                    // their portrait once the game has started, so an opponent
                    // is introduced the same way in both places.
                    title={`${who}\n${t(blurbKey(level))}`}
                    aria-label={`${who} — ${t("game:controls.level", { level })}`}
                    aria-pressed={selected}
                    onClick={() => onDifficultyChange(level)}
                    className={cn(
                      "group rounded-xl p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                      // Filled, not outlined: the tile you picked is a solid
                      // block of the accent, the rest are the panel's own grey.
                      // The tile itself stays opaque either way — it is the
                      // portrait that steps back, not the card it sits on.
                      selected
                        ? "bg-brand"
                        : "bg-surface-4 hover:bg-surface-5",
                    )}
                  >
                    <span
                      className={cn(
                        "relative block overflow-hidden rounded-lg transition",
                        !selected && "opacity-70 group-hover:opacity-100",
                      )}
                    >
                      <img
                        src={avatarSrc(level)}
                        alt=""
                        className="block h-full w-full"
                      />
                      {/* The level is a rank, so it belongs on the portrait
                          rather than competing with the name underneath. */}
                      <span className="absolute top-0.5 left-0.5 rounded bg-black/55 px-1 text-[0.625rem] leading-4 font-bold text-white/90 tabular-nums">
                        {level}
                      </span>
                    </span>
                    {/* Two lines, always: the names run from "Sharp Sam" to
                        "Grandmaster Gus" and the row must not jump when the
                        longer ones wrap. */}
                    <span
                      className={cn(
                        "mt-1 flex h-7 items-center justify-center text-center text-[0.625rem] leading-tight font-semibold",
                        selected ? "text-white" : "text-white/60",
                      )}
                    >
                      {getBotName(level)}
                    </span>
                  </TapButton>
                )
              })}
            </div>
          </Section>

          <Section title={t("game:controls.play_as")}>
            <ColorChoice
              value={colorChoice}
              onChange={onColorChange}
              marbleDesign={marbleDesign}
            />
          </Section>
        </>
      )}

      {/* The three-bullet summary that used to sit here said too little to
          teach the game and took up the panel's whole tail doing it. The rules
          have their own illustrated page now, linked from the home screen. */}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={onPlay}
      >
        {t("game:controls.play_button")}
      </Button>
    </div>
  )
}
