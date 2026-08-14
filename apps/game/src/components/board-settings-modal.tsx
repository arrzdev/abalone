import { useTranslation } from "react-i18next"
import { LanguageSelect } from "@/components/language-switcher"
import { Modal } from "@/components/ui/modal"
import type { SelectOption } from "@/components/ui/select"
import { Select } from "@/components/ui/select"
import { Toggle } from "@/components/ui/toggle"
import { VolumeSlider } from "@/components/ui/volume-slider"
import type { MarbleDesign } from "@/render/marble-renderer"

export type BoardSettingsModalProps = {
  open: boolean
  onClose: () => void
  marbleDesign: MarbleDesign
  onMarbleDesignChange: (design: MarbleDesign) => void
  animationsEnabled: boolean
  onAnimationsChange: (enabled: boolean) => void
  showCoordinates: boolean
  onShowCoordinatesChange: (show: boolean) => void
  showEvalBar: boolean
  onShowEvalBarChange: (show: boolean) => void
  autoRotate: boolean
  onAutoRotateChange: (enabled: boolean) => void
  showAutoRotate: boolean
  soundVolume: number
  onSoundVolumeChange: (volume: number) => void
  soundMuted: boolean
  onSoundMutedChange: (muted: boolean) => void
}

/**
 * Language, marble design, sound, animations, coordinates and board rotation.
 *
 * Language lives here rather than in the game header: it is set once and then
 * forgotten, and a flag button in the header pushed the page title off centre.
 */
export function BoardSettingsModal({
  open,
  onClose,
  marbleDesign,
  onMarbleDesignChange,
  animationsEnabled,
  onAnimationsChange,
  showCoordinates,
  onShowCoordinatesChange,
  showEvalBar,
  onShowEvalBarChange,
  autoRotate,
  onAutoRotateChange,
  showAutoRotate,
  soundVolume,
  onSoundVolumeChange,
  soundMuted,
  onSoundMutedChange,
}: BoardSettingsModalProps) {
  const { t } = useTranslation()

  const designOptions: SelectOption<MarbleDesign>[] = [
    { value: "default", label: t("game:controls.marble_design_classic") },
    { value: "3d", label: t("game:controls.marble_design_3d") },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("game:controls.settings")}
    >
      <div className="space-y-5">
        <div>
          <span className="mb-2 block text-sm font-medium text-white">
            {t("common:language.select")}
          </span>
          <LanguageSelect />
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-white">
            {t("game:controls.marble_design")}
          </span>
          <Select
            label={t("game:controls.marble_design")}
            value={marbleDesign}
            onChange={onMarbleDesignChange}
            options={designOptions}
          />
        </div>

        <div className="border-t border-white/10 pt-5">
          <VolumeSlider
            label={t("game:controls.sound")}
            description={t("game:controls.sound_hint")}
            muteLabel={t(
              soundMuted ? "game:controls.unmute" : "game:controls.mute",
            )}
            volume={soundVolume}
            muted={soundMuted}
            onVolumeChange={onSoundVolumeChange}
            onMutedChange={onSoundMutedChange}
          />
        </div>

        <div className="space-y-4 border-t border-white/10 pt-5">
          <Toggle
            label={t("game:controls.show_coordinates")}
            description={t("game:controls.show_coordinates_hint")}
            checked={showCoordinates}
            onChange={onShowCoordinatesChange}
          />

          {/* Shown in both modes, on and off. There is nothing to evaluate in a
              hot-seat game — the bar would be reading the position out to both
              players at once — so the setting stays where it was left and the
              description is what says when it applies, rather than the option
              disappearing and leaving you to wonder where it went. */}
          <Toggle
            label={t("game:controls.show_eval_bar")}
            description={t("game:controls.show_eval_bar_hint")}
            checked={showEvalBar}
            onChange={onShowEvalBarChange}
          />

          <Toggle
            label={t("game:controls.move_animations")}
            description={t("game:controls.move_animations_hint")}
            checked={animationsEnabled}
            onChange={onAnimationsChange}
          />

          {showAutoRotate && (
            <Toggle
              label={t("game:controls.rotate_board")}
              description={t("game:controls.rotate_board_hint")}
              checked={autoRotate}
              onChange={onAutoRotateChange}
            />
          )}
        </div>
      </div>
    </Modal>
  )
}
