import { useTranslation } from "react-i18next"
import type { SelectOption } from "@/components/ui/select"
import { Select } from "@/components/ui/select"
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
import { useMarbleDesign } from "@/hooks/use-marble-design"
import type { MarbleDesign } from "@/render/marble-renderer"

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
 * Language is the one thing not here: it is one press away in the header on
 * every screen, and a setting you can already see is not worth burying.
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
  const [animationsEnabled, setAnimationsEnabled] = useAnimationsEnabled()
  const [showCoordinates, setShowCoordinates] = useShowCoordinates()
  const [showEvalBar, setShowEvalBar] = useShowEvalBar()
  const [autoRotate, setAutoRotate] = useAutoRotateBoard()
  const sound = useSoundPreferences()

  const designOptions: SelectOption<MarbleDesign>[] = [
    { value: "default", label: t("game:controls.marble_design_classic") },
    { value: "3d", label: t("game:controls.marble_design_3d") },
  ]

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("game:controls.settings")}
      className="lg:max-w-lg"
    >
      <div className="flex flex-col gap-y-5">
        <div>
          <span className="mb-2 block text-sm font-medium text-white">
            {t("game:controls.marble_design")}
          </span>
          <Select
            label={t("game:controls.marble_design")}
            value={marbleDesign}
            onChange={setMarbleDesign}
            options={designOptions}
          />
        </div>

        <div className="border-t border-white/10 pt-5">
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
        </div>

        <div className="flex flex-col gap-y-4 border-t border-white/10 pt-5">
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
