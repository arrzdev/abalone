import { useTranslation } from "react-i18next"
import { GroupIcon, RobotIcon, WifiIcon } from "@/components/icons"
import { PlayOption } from "@/components/play-option"
import { Sheet } from "@/components/ui/sheet"
import { usePlayActions } from "@/hooks/use-play-actions"

export type PlaySheetProps = {
  open: boolean
  onClose: () => void
}

/**
 * The Play tab's choice: the three games there actually are.
 *
 * Not the home page's two. "Offline" is not an opponent — it is a pair of them,
 * and a row that means "now pick again on the next screen" is a row that costs a
 * press to say nothing. Splitting it here means the sheet answers the question
 * the tab asked, and the setup panel opens on the mode you chose rather than on
 * whichever one it defaults to.
 *
 * Online stays first: it is the one that needs an account, and the only one this
 * sheet cannot start on its own.
 */
export function PlaySheet({ open, onClose }: PlaySheetProps) {
  const { t } = useTranslation()
  const { playOnline, playOffline } = usePlayActions()

  const choose = (go: () => void) => {
    onClose()
    go()
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("common:play.title")}>
      <div className="flex flex-col gap-y-3">
        <PlayOption
          icon={WifiIcon}
          tone="brand"
          title={t("common:home.play_online")}
          hint={t("common:play.online_hint")}
          onClick={() => choose(playOnline)}
        />

        <PlayOption
          icon={RobotIcon}
          title={t("game:controls.mode_ai")}
          hint={t("common:play.bot_hint")}
          onClick={() => choose(() => playOffline("ai"))}
        />

        <PlayOption
          icon={GroupIcon}
          title={t("game:controls.mode_local")}
          hint={t("common:play.local_hint")}
          onClick={() => choose(() => playOffline("local"))}
        />
      </div>
    </Sheet>
  )
}
