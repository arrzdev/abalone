import { useId } from "react"
import { useTranslation } from "react-i18next"
import { BoardThemePicker } from "@/components/board-theme-picker"
import { LanguageSelect } from "@/components/language-select"
import { MarbleDesignPicker } from "@/components/marble-design-picker"
import { Sheet } from "@/components/ui/sheet"
import { Toggle } from "@/components/ui/toggle"
import { VolumeSlider } from "@/components/ui/volume-slider"
import {
  useAnimationsEnabled,
  useAutoRotateBoard,
  useShowCoordinates,
  useShowEvalBar,
  useSoundPreferences,
} from "@/hooks/use-app-preferences"
import { useBoardTheme } from "@/hooks/use-board-theme"
import { useMarbleDesign } from "@/hooks/use-marble-design"

export type AppSettingsSheetProps = {
  open: boolean
  onClose: () => void
}

/**
 * Every setting in the app, in one sheet, reachable from the header on any
 * screen.
 *
 * The board used to keep its own — coordinates, the evaluation bar, rotation —
 * on the argument that they are about the game in front of you. Two settings
 * screens with four options in common is worse than one setting somebody has to
 * go looking for, and all of these are now saved preferences rather than
 * something a board holds, so there is nothing left to divide them.
 *
 * Language leads it. It is set once and then forgotten, which is what a setting
 * is — and as a flag button in the header it cost a square of chrome on every
 * screen to say something you only ever say once.
 *
 * It owns its own state rather than taking it as props: every one of these is a
 * saved preference, so the only thing a caller has to say is whether the sheet
 * is up.
 */
export function AppSettingsSheet({
  open,
  onClose,
}: AppSettingsSheetProps) {
  const { t } = useTranslation()
  const [marbleDesign, setMarbleDesign] = useMarbleDesign()
  const [boardTheme, setBoardTheme] = useBoardTheme()
  const themeHintId = useId()
  const [animationsEnabled, setAnimationsEnabled] = useAnimationsEnabled()
  const [showCoordinates, setShowCoordinates] = useShowCoordinates()
  const [showEvalBar, setShowEvalBar] = useShowEvalBar()
  const [autoRotate, setAutoRotate] = useAutoRotateBoard()
  const sound = useSoundPreferences()

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("game:controls.settings")}
      className="lg:max-w-[476px]"
    >
      <div className="flex flex-col gap-y-5">
        {/* Label and select on one row: the marble tiles below took the room
            this had beside it, and the sheet has to fit a 375x667 phone
            without scrolling. */}
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-sm font-semibold text-white">
            {t("common:language.select")}
          </span>
          <LanguageSelect className="w-1/2 shrink-0" />
        </div>

        {/* Tiles like the board theme below, so each design shows its own
            marbles rather than a name you have to try to know. */}
        <div>
          <span className="mb-2 block text-sm font-semibold text-white">
            {t("game:controls.marble_design")}
          </span>
          <MarbleDesignPicker
            value={marbleDesign}
            onChange={setMarbleDesign}
          />
        </div>

        <div>
          <span className="mb-2 block text-sm font-semibold text-white">
            {t("game:controls.board_theme")}
          </span>
          <BoardThemePicker
            value={boardTheme}
            onChange={setBoardTheme}
            describedBy={themeHintId}
          />
          {/* Read with the group rather than shown: there is no line to spare
              in the sheet, and the tiles already show what changes. */}
          <span id={themeHintId} className="sr-only">
            {t("game:controls.board_theme_hint")}
          </span>
        </div>

        {/* Sound is one row now, so it leads the list of switches rather than
            taking a section of its own: the sheet fits a 375x667 phone. */}
        <div className="flex flex-col gap-y-2 border-t border-border pt-5">
          <VolumeSlider
            label={t("game:controls.sound")}
            description={t("game:controls.sound_hint")}
            muteLabel={t(
              sound.muted ? "game:controls.unmute" : "game:controls.mute",
            )}
            volume={sound.volume}
            muted={sound.muted}
            onVolumeChange={sound.setVolume}
            onMutedChange={sound.setMuted}
          />

          <Toggle
            label={t("game:controls.show_coordinates")}
            description={t("game:controls.show_coordinates_hint")}
            checked={showCoordinates}
            onChange={setShowCoordinates}
          />

          {/* Both of these apply to one mode each and are shown in every one.
              There is nothing to evaluate in a hot-seat game and nothing to
              turn the board for in a game against a bot, and an option that
              vanishes with the screen it applies to is an option you go
              looking for. The description is what says when it counts. */}
          <Toggle
            label={t("game:controls.show_eval_bar")}
            description={t("game:controls.show_eval_bar_hint")}
            checked={showEvalBar}
            onChange={setShowEvalBar}
          />

          <Toggle
            label={t("game:controls.rotate_board")}
            description={t("game:controls.rotate_board_hint")}
            checked={autoRotate}
            onChange={setAutoRotate}
          />

          <Toggle
            label={t("game:controls.move_animations")}
            description={t("game:controls.move_animations_hint")}
            checked={animationsEnabled}
            onChange={setAnimationsEnabled}
          />
        </div>
      </div>
    </Sheet>
  )
}
