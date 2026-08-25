import { cn } from "@repo/nativ/utils"
import { useTranslation } from "react-i18next"
import type { SyncState } from "@/utils/sync-state"

export type SyncNoticeProps = {
  /** How current the screen this sits on is. See `SyncState`. */
  state: SyncState
  className?: string
}

/**
 * One line saying whether the screen around it can be believed yet.
 *
 * The app paints from a saved cache, so the first thing a slow network shows is
 * the last state this device was given, silently, and then a swap when the
 * answer lands. The swap is not the problem; being told nothing before it is.
 * This is the telling.
 *
 * Nothing is rendered while the screen is current, and nothing while it is
 * empty either — a first load has no saved copy to warn about, and the screen
 * it lands on says it is loading in its own words.
 *
 * A live region, because this is the one thing here that changes without
 * anybody touching it.
 */
export function SyncNotice({ state, className }: SyncNoticeProps) {
  const { t } = useTranslation()

  if (state === "fresh" || state === "loading") return null

  return (
    <output
      className={cn(
        //the animation carries a delay, which is what keeps a fast load from
        //blinking a notice it did not need. see `--animate-sync-in`.
        "block shrink-0 animate-sync-in text-center text-xs leading-5",
        state === "syncing" ? "text-faint" : "text-warning",
        className,
      )}
    >
      {state === "syncing" && t("common:sync.updating")}
      {state === "offline" && t("common:sync.offline")}
      {state === "stale" && t("common:sync.unreachable")}
    </output>
  )
}
